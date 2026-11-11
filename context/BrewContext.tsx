import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isIspindelFresh } from '../services/ispindel';
import { connectLive, LiveConnection } from '../services/liveClient';
import { OtaSession, createOtaSession, applyOtaMessage, applyOtaTelemetry } from '../services/otaSession';
import { PendingConfirm, registerCommand, evaluateCooldown } from '../services/telemetryCooldown';
import { useAuth } from './AuthContext';
import { useFermenters } from '../hooks/useFermenters';
import { FermenterStatus, DeviceMode } from '../types';
import { sendDeviceCommand } from '../services/api';

interface BrewContextType {
    connectionStatus: 'connected' | 'disconnected';
    isInitialSyncing: boolean;
    sendCommand: (serialCode: string, type: string, payload: any) => void;
    otaProgress: Record<string, number>;
    clearOtaProgress: () => void;
    /** Sessoes de atualizacao em andamento (chave = serial em MAIUSCULAS) */
    otaSessions: Record<string, OtaSession>;
    /** Abre a sessao no clique (o modal aparece antes de o aparelho responder) */
    startOta: (serial: string, opts: { name?: string; targetVersion?: string }) => void;
    dismissOta: (serial: string) => void;
    scanResponses: Record<string, string[]>;
    /** Detalhes do ultimo scan 1-Wire por aparelho (chave em MAIUSCULAS) */
    scanDetails: Record<string, ScanDetails>;
    blockTelemetry: (serialCode: string) => void;
}

export interface ScanDetails {
    sensors: { mac: string; temp: number | null }[];
    macCtrl?: string;
    mac2?: string;
    receivedAt: number;
}

const BrewContext = createContext<BrewContextType | undefined>(undefined);

export const BrewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token, role } = useAuth();
    const { fermenters, updateFermenterLocal, refetch } = useFermenters();
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
    const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
    const [otaProgress, setOtaProgress] = useState<Record<string, number>>({});
    const [otaSessions, setOtaSessions] = useState<Record<string, OtaSession>>({});
    const [scanResponses, setScanResponses] = useState<Record<string, string[]>>({});
    const [scanDetails, setScanDetails] = useState<Record<string, ScanDetails>>({});
    const liveRef = useRef<LiveConnection | null>(null);
    const commandCooldownRef = useRef<Record<string, PendingConfirm>>({});
    const fermentersRef = useRef(fermenters);
    const initialPingedDevicesRef = useRef<Set<string>>(new Set());
    const liveOpenRef = useRef(false);

    // Pede uma leitura imediata a cada aparelho (uma vez por conexao), pelo endpoint autenticado
    const pingNewDevices = useCallback((list: typeof fermenters) => {
        if (!token || !liveOpenRef.current) return;
        list.forEach(f => {
            const upperId = (f.id || '').trim().toUpperCase();
            if (!upperId || initialPingedDevicesRef.current.has(upperId)) return;
            initialPingedDevicesRef.current.add(upperId);
            sendDeviceCommand(f.id, 'request_status', {}, token).catch(() => {});
        });
    }, [token]);

    useEffect(() => {
        fermentersRef.current = fermenters;
        pingNewDevices(fermenters);
    }, [fermenters, pingNewDevices]);

    // --- Fluxo ao vivo (SSE do backend; o navegador nao acessa mais o broker MQTT) ---
    useEffect(() => {
        initialPingedDevicesRef.current.clear();
        liveOpenRef.current = false;
        if (!token) {
            setConnectionStatus('disconnected');
            setIsInitialSyncing(false);
            return;
        }
        if (liveRef.current) liveRef.current.close();
        setIsInitialSyncing(true);

        let syncTimer: ReturnType<typeof setTimeout> | null = null;
        // Hard timeout so initial search never hangs forever if backend or device is unreachable
        const hardSyncTimer = setTimeout(() => {
            setIsInitialSyncing(false);
        }, 2500);

        const handleMessage = (topic: string, msgStr: string, isRetained: boolean) => {
            const ownsSerial = (serialCandidate: string) => {
                const norm = (serialCandidate || '').trim().toUpperCase();
                return Boolean(norm) && fermentersRef.current.some(f => (f.id || '').trim().toUpperCase() === norm);
            };

            if (topic === 'brewbrother/global/update') {
                if (!isRetained) {
                    try {
                        const parsed = JSON.parse(msgStr);
                        // If scoped to a specific serial or user, only refetch when relevant
                        if (parsed?.serial && !ownsSerial(parsed.serial)) return;
                    } catch (e) {}
                    refetch();
                }
                return;
            }

            if (topic.endsWith('/ota')) {
                if (isRetained) return;
                try {
                    const payload = JSON.parse(msgStr);
                    const serial = (topic.split('/')[1] || '').trim().toUpperCase();
                    if (serial && ownsSerial(serial) && payload?.progress !== undefined) {
                        setOtaProgress(prev => ({ ...prev, [serial]: payload.progress }));
                    }
                    if (serial && ownsSerial(serial)) {
                        setOtaSessions(prev => {
                            // Atualizacao iniciada fora deste navegador: abre a sessao ao primeiro sinal
                            const base = prev[serial] ?? createOtaSession(serial, {}, Date.now());
                            const next = applyOtaMessage(base, payload, Date.now());
                            return next === prev[serial] ? prev : { ...prev, [serial]: next };
                        });
                    }
                } catch (e) {}
                return;
            }

            if (topic === 'brewbrother/global/response' || topic.endsWith('/response')) {
                if (isRetained) return;
                try {
                    const payload = JSON.parse(msgStr);
                    const respId = payload?.id || topic.split('/')[1];
                    if (payload?.type === 'scan_sensors_response' && respId && ownsSerial(respId)) {
                        const macs: string[] = Array.isArray(payload.macs) ? payload.macs : [];
                        setScanResponses(prev => ({ ...prev, [respId]: macs }));
                        const sensors = Array.isArray(payload.sensors)
                            ? payload.sensors
                                .filter((s: any) => s && typeof s.mac === 'string')
                                .map((s: any) => ({ mac: s.mac, temp: typeof s.temp === 'number' ? s.temp : null }))
                            : macs.map(mac => ({ mac, temp: null }));
                        setScanDetails(prev => ({
                            ...prev,
                            [String(respId).toUpperCase()]: {
                                sensors,
                                macCtrl: typeof payload.macCtrl === 'string' ? payload.macCtrl : undefined,
                                mac2: typeof payload.mac2 === 'string' ? payload.mac2 : undefined,
                                receivedAt: Date.now()
                            }
                        }));
                    }
                } catch (e) {}
                return;
            }

            try {
                const payload = JSON.parse(msgStr);
                if (!payload || typeof payload !== 'object') return;
                const rawSerial = topic.split('/')[1]; // brewbrother/SERIAL/data
                if (!rawSerial) return;
                const serial = rawSerial.trim().toUpperCase();
                if (!ownsSerial(serial)) return;

                // Se recebeu telemetria ao vivo (não retida), significa que reiniciou e já está vivo. Remove o progresso OTA.
                if (!isRetained) {
                    const fw = typeof (payload.fw ?? payload.ver) === 'string' ? String(payload.fw ?? payload.ver) : undefined;
                    setOtaSessions(prev => {
                        const cur = prev[serial];
                        if (!cur) return prev;
                        const next = applyOtaTelemetry(cur, fw, Date.now());
                        return next === cur ? prev : { ...prev, [serial]: next };
                    });
                    setOtaProgress(prev => {
                        if (prev[serial] !== undefined) {
                            const next = { ...prev };
                            delete next[serial];
                            return next;
                        }
                        return prev;
                    });
                }

                // Logic isolated directly referencing payload values
                let newStatus = undefined;
                let target: number | string | undefined = undefined;
                const statusStr = typeof payload.statOp === 'string' ? payload.statOp.toUpperCase() : String(payload.statOp || '').toUpperCase();
                
                if (statusStr.includes('FERMENT')) newStatus = FermenterStatus.ACTIVE;
                else if (statusStr.includes('CRASH')) newStatus = FermenterStatus.COLD_CRASH;
                else if (statusStr.includes('DIACETYL')) newStatus = FermenterStatus.DIACETYL_REST;
                else if (statusStr.includes('IDLE')) newStatus = FermenterStatus.IDLE;
                else if (payload.fermRun) newStatus = FermenterStatus.ACTIVE; 

                if (payload.csp !== undefined && payload.csp !== null) {
                    target = payload.csp; // Always use ESP32's currentSetpoint (csp) as source of truth
                } else if (payload.opm === 0 && payload.steps && payload.steps[payload.currStep]) {
                    const stepTemp = parseFloat(payload.steps[payload.currStep]?.t);
                    if (!isNaN(stepTemp)) target = stepTemp;
                } else if (payload.fsm !== undefined && payload.fsm !== null) {
                    target = payload.fsm;
                }

                let profileUpdate = undefined;
                let currentStepIndexUpdate = undefined;
                let isPausedUpdate = undefined;

                if (payload.steps && Array.isArray(payload.steps) && payload.steps.length > 0) {
                    const validSteps = payload.steps
                        .filter((step: any) => step && (parseFloat(step.t) > 0 || parseFloat(step.d) > 0))
                        .map((step: any, index: number) => {
                            const parsedTemp = parseFloat(step.t);
                            const parsedDur = step.d !== undefined ? (parseFloat(step.d) / 24) : 1;
                            return {
                                id: `step_${index}`,
                                name: step.n || `Etapa ${index + 1}`,
                                temperature: !isNaN(parsedTemp) ? parsedTemp : 18,
                                duration: !isNaN(parsedDur) && parsedDur > 0 ? parsedDur : 1
                            };
                        });
                    if (validSteps.length > 0) {
                        profileUpdate = validSteps;
                    }
                }
                
                // Telemetria velha (em transito) nao pode desfazer o update otimista de um comando.
                // Modo/setpoint: ignorada ate o aparelho CONFIRMAR o valor pedido (normalmente < 1 s);
                // outros comandos: janela curta. Ver services/telemetryCooldown.ts
                const pendingCmd = commandCooldownRef.current[serial];
                const cooldown = evaluateCooldown(pendingCmd, { opm: payload.opm, csp: payload.csp }, Date.now());
                if (pendingCmd && !isRetained && (cooldown.confirmed || !cooldown.inCooldown)) {
                    delete commandCooldownRef.current[serial];
                }
                const isInCooldown = cooldown.inCooldown;

                if (payload.currStep !== undefined) {
                    currentStepIndexUpdate = parseInt(payload.currStep, 10) || 0;
                }
                
                if (payload.isPaused !== undefined || payload.fermRun !== undefined) {
                    isPausedUpdate = payload.isPaused !== undefined ? payload.isPaused : (payload.fermRun === false || payload.fermRun === 0);
                }

                let currentModeUpdate = undefined;
                if (payload.opm !== undefined) {
                    if (payload.opm === 0) currentModeUpdate = DeviceMode.FERMENTER;
                    else if (payload.opm === 1) currentModeUpdate = DeviceMode.FRIDGE;
                    else if (payload.opm === 2) currentModeUpdate = DeviceMode.KEGERATOR;
                    
                    if (!isInCooldown && currentModeUpdate) {
                        localStorage.setItem(`device_mode_${serial}`, currentModeUpdate);
                    }
                }
                
                let kegeratorConfigUpdate = undefined;
                if (!isInCooldown && (payload.c_n1 !== undefined || payload.c_n2 !== undefined)) {
                    kegeratorConfigUpdate = {
                        line1: payload.c_n1 || '',
                        line2: payload.c_n2 || '',
                        style: payload.c_n3 || '',
                        brewery: payload.c_n4 || '',
                        ibu: parseFloat(payload.c_ibu) || 0,
                        abv: parseFloat(payload.c_vol) || 0
                    };
                    try {
                        localStorage.setItem(`kegerator_${serial}`, JSON.stringify(kegeratorConfigUpdate));
                    } catch (e) {}
                }

                if (!isRetained && !isInCooldown && payload.stepTime !== undefined) {
                    localStorage.setItem(`device_stepTime_${serial}`, payload.stepTime.toString());
                }

                // Call local React Query update which triggers re-render via useFermenters without refetching
                // Only live (non-retained) MQTT packets update lastUpdate so powered-off devices are never marked online
                const parsedAmb = payload.amb !== undefined ? parseFloat(payload.amb) : NaN;
                const parsedTarget = target !== undefined ? parseFloat(String(target)) : NaN;
                const parsedFerm = payload.ferm !== undefined ? parseFloat(payload.ferm) : NaN;
                const parsedRssi = payload.rssi !== undefined ? parseFloat(payload.rssi) : NaN;
                const savedStepTimeStr = localStorage.getItem(`device_stepTime_${serial}`);
                const parsedStepTime = (!isRetained && !isInCooldown && payload.stepTime !== undefined)
                    ? parseFloat(payload.stepTime)
                    : (savedStepTimeStr !== null ? parseFloat(savedStepTimeStr) : NaN);

                const ispFresh = isIspindelFresh(payload);
                updateFermenterLocal(serial, {
                    ...(!isInCooldown && newStatus ? { status: newStatus } : {}),
                    ...(!isInCooldown && currentModeUpdate ? { mode: currentModeUpdate } : {}),
                    ...(payload.ip ? { ipAddress: payload.ip } : {}),
                    ...(!isNaN(parsedAmb) ? { currentFridgeTemp: parsedAmb } : {}),
                    ...(!isInCooldown && !isNaN(parsedTarget) ? { targetTemp: parsedTarget } : {}),
                    ...(!isInCooldown && profileUpdate ? { profile: profileUpdate } : {}),
                    ...(!isInCooldown && currentStepIndexUpdate !== undefined ? { currentStepIndex: currentStepIndexUpdate } : {}),
                    ...(!isInCooldown && isPausedUpdate !== undefined ? { isPaused: isPausedUpdate } : {}),
                    ...(kegeratorConfigUpdate ? { kegeratorConfig: kegeratorConfigUpdate } : {}),
                    currentDevice: {
                        temperature: !isNaN(parsedFerm) ? parsedFerm : undefined,
                        // iSpindel desligado: o controlador repete a ultima leitura; velha nao aparece
                        gravity: ispFresh === false ? 0 : payload.is_sg !== undefined && parseFloat(payload.is_sg) > 0 ? parseFloat(payload.is_sg) : undefined,
                        battery: ispFresh === false ? 0 : payload.is_bat !== undefined && parseFloat(payload.is_bat) > 0 ? parseFloat(payload.is_bat) : undefined,
                        rssi: !isNaN(parsedRssi) ? parsedRssi : undefined,
                        ...(isRetained ? {} : { lastUpdate: new Date().toISOString(), lastPacketMs: Date.now() }),
                        statOp: statusStr || 'INATIVO',
                        logInterval: payload.wi ? payload.wi / 1000 : undefined,
                        compressorDelay: payload.cds,
                        version: payload.ver || payload.fw, // Firmware version
                        macCtrl: payload.macCtrl,
                        extSens: payload.ext_s ?? payload.extSens ?? (payload.hum !== undefined ? { hum: payload.hum } : undefined),
                        stepTime: !isNaN(parsedStepTime) ? parsedStepTime : undefined,
                        offsetS1: payload.off_t1 ?? payload.off1,
                        offsetS2: payload.off_t2 ?? payload.off2,
                        offsetSG: payload.off_sg,
                        kp_h: payload.kp_h ?? payload.Kp_h,
                        ki_h: payload.ki_h ?? payload.Ki_h,
                        kd_h: payload.kd_h ?? payload.Kd_h,
                        kp_c: payload.kp_c ?? payload.Kp_c,
                        ki_c: payload.ki_c ?? payload.Ki_c,
                        kd_c: payload.kd_c ?? payload.Kd_c,
                        pwmWindowHeat: payload.pwmWindowHeat ?? payload.pwm_w,
                        rawPayload: payload
                    } as any // Use as any to rely on prior state spread inside updateFermenterLocal
                });
            } catch (e) {
                console.error("Live Parse Error", e);
            }
        };

        liveRef.current = connectLive({
            token,
            onOpen: () => {
                setConnectionStatus('connected');
                liveOpenRef.current = true;
                initialPingedDevicesRef.current.clear();
                pingNewDevices(fermentersRef.current);
                if (syncTimer) clearTimeout(syncTimer);
                syncTimer = setTimeout(() => setIsInitialSyncing(false), 1800);
            },
            onClose: () => {
                liveOpenRef.current = false;
                setConnectionStatus('disconnected');
            },
            onUnauthorized: () => {
                liveOpenRef.current = false;
                setConnectionStatus('disconnected');
                setIsInitialSyncing(false);
            },
            onMessage: handleMessage
        });

        return () => {
            clearTimeout(hardSyncTimer);
            if (syncTimer) clearTimeout(syncTimer);
            liveOpenRef.current = false;
            if (liveRef.current) liveRef.current.close();
            liveRef.current = null;
        };
    }, [token, refetch, updateFermenterLocal, pingNewDevices]);


    const sendCommand = useCallback((serialCode: string, type: string, payload: any) => {
        if (!serialCode) return;
        const normalizedSerial = serialCode.trim().toUpperCase();
        // Ownership guard on client side when fermenter list is loaded (admins can send OTA/commands to any device)
        if (role !== 'admin' && fermentersRef.current.length > 0) {
            const ownsDevice = fermentersRef.current.some(f => (f.id || '').trim().toUpperCase() === normalizedSerial);
            if (!ownsDevice) return;
        }
        // Cooldown: bloqueia telemetria de sobrescrever updates otimistas (exceto comandos de leitura)
        if (type !== 'request_status' && type !== 'scan_sensors') {
            commandCooldownRef.current[normalizedSerial] = registerCommand(commandCooldownRef.current[normalizedSerial], type, payload, Date.now());
        }
        // Unico caminho: endpoint autenticado do backend (valida dono do aparelho e publica no broker)
        if (token) {
            sendDeviceCommand(serialCode, type, payload, token).catch(() => {});
        }
    }, [token, role]);

    const startOta = useCallback((serial: string, opts: { name?: string; targetVersion?: string }) => {
        const key = (serial || '').trim().toUpperCase();
        if (!key) return;
        setOtaSessions(prev => ({ ...prev, [key]: createOtaSession(key, opts, Date.now()) }));
    }, []);

    const dismissOta = useCallback((serial: string) => {
        const key = (serial || '').trim().toUpperCase();
        setOtaSessions(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const clearOtaProgress = useCallback(() => {
        setOtaProgress({});
    }, []);

    const blockTelemetry = useCallback((serialCode: string) => {
        if (serialCode) {
            const key = serialCode.trim().toUpperCase();
            commandCooldownRef.current[key] = registerCommand(commandCooldownRef.current[key], 'block', {}, Date.now());
        }
    }, []);

    return (
        <BrewContext.Provider value={{ connectionStatus, isInitialSyncing, sendCommand, otaProgress, clearOtaProgress, otaSessions, startOta, dismissOta, scanResponses, scanDetails, blockTelemetry }}>
            {children}
        </BrewContext.Provider>
    );
};

export const useBrew = () => {
    const context = useContext(BrewContext);
    if (!context) {
        throw new Error('useBrew must be used within a BrewProvider');
    }
    return context;
};
