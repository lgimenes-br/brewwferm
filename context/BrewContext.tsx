import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { MQTT_BROKER } from '../config';
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
    scanResponses: Record<string, string[]>;
    blockTelemetry: (serialCode: string) => void;
}

const BrewContext = createContext<BrewContextType | undefined>(undefined);

export const BrewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token } = useAuth();
    const { fermenters, updateFermenterLocal, refetch } = useFermenters();
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
    const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
    const [otaProgress, setOtaProgress] = useState<Record<string, number>>({});
    const [scanResponses, setScanResponses] = useState<Record<string, string[]>>({});
    const clientRef = useRef<MqttClient | null>(null);
    const commandCooldownRef = useRef<Record<string, number>>({});
    const fermentersRef = useRef(fermenters);
    const initialPingedDevicesRef = useRef<Set<string>>(new Set());
    const subscribedSerialsRef = useRef<Set<string>>(new Set());

    const subscribeUserDevices = useCallback((client: MqttClient | null, list: typeof fermenters) => {
        if (!client || !client.connected) return;
        const statusMsg = JSON.stringify({ type: 'request_status', cmd: 'request_status' });
        list.forEach(f => {
            if (!f.id) return;
            const rawId = f.id.trim();
            const upperId = rawId.toUpperCase();
            if (!subscribedSerialsRef.current.has(upperId)) {
                subscribedSerialsRef.current.add(upperId);
                client.subscribe(`brewbrother/${rawId}/data`);
                client.subscribe(`brewbrother/${rawId}/ota`);
                client.subscribe(`brewbrother/${rawId}/response`);
                if (upperId !== rawId) {
                    client.subscribe(`brewbrother/${upperId}/data`);
                    client.subscribe(`brewbrother/${upperId}/ota`);
                    client.subscribe(`brewbrother/${upperId}/response`);
                }
            }
            if (!initialPingedDevicesRef.current.has(upperId)) {
                initialPingedDevicesRef.current.add(upperId);
                client.publish(`brewbrother/${rawId}/comando`, statusMsg);
                client.publish(`brewbrother/${rawId}/command`, statusMsg);
            }
        });
    }, []);

    useEffect(() => {
        fermentersRef.current = fermenters;
        subscribeUserDevices(clientRef.current, fermenters);
    }, [fermenters, subscribeUserDevices]);

    // --- MQTT ---
    useEffect(() => {
        initialPingedDevicesRef.current.clear();
        subscribedSerialsRef.current.clear();
        if (!token) {
            setConnectionStatus('disconnected');
            setIsInitialSyncing(false);
            return;
        }
        if (clientRef.current) clientRef.current.end();
        setIsInitialSyncing(true);

        const clientId = 'brew_' + Math.random().toString(16).slice(2, 10);
        
        const client = mqtt.connect(MQTT_BROKER, {
            clientId,
            protocol: 'wss',
            username: 'esp32user',
            password: 'esp32',
            keepalive: 60,
            reconnectPeriod: 5000,
            clean: true
        });

        clientRef.current = client;
        let syncTimer: ReturnType<typeof setTimeout> | null = null;
        let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
        // Hard timeout so initial search never hangs forever if broker or device is unreachable
        const hardSyncTimer = setTimeout(() => {
            setIsInitialSyncing(false);
        }, 2500);

        const broadcastRequestStatus = () => {
            if (!client.connected) return;
            const statusMsg = JSON.stringify({ type: 'request_status', cmd: 'request_status' });
            fermentersRef.current.forEach(f => {
                if (f.id) {
                    client.publish(`brewbrother/${f.id}/comando`, statusMsg);
                    client.publish(`brewbrother/${f.id}/command`, statusMsg);
                }
            });
        };

        client.on('connect', () => {
            setConnectionStatus('connected');
            client.subscribe('brewbrother/global/update'); // Global refresh trigger
            client.subscribe('brewbrother/global/response'); // Global responses (scan sensors)
            subscribeUserDevices(client, fermentersRef.current);
            broadcastRequestStatus();
            if (syncTimer) clearTimeout(syncTimer);
            syncTimer = setTimeout(() => {
                setIsInitialSyncing(false);
            }, 1800);

            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(broadcastRequestStatus, 30000);
        });

        client.on('message', (topic, message, packet) => {
            const msgStr = message.toString();
            const isRetained = Boolean(packet?.retain);
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
                } catch (e) {}
                return;
            }

            if (topic === 'brewbrother/global/response' || topic.endsWith('/response')) {
                if (isRetained) return;
                try {
                    const payload = JSON.parse(msgStr);
                    const respId = payload?.id || topic.split('/')[1];
                    if (payload?.type === 'scan_sensors_response' && respId && ownsSerial(respId)) {
                        setScanResponses(prev => ({ ...prev, [respId]: Array.isArray(payload.macs) ? payload.macs : [] }));
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
                
                // Cooldown: se um comando foi enviado ha menos de 10s, nao sobrescreve estado otimista
                // para evitar que telemetria velha (em transito) desfaca o update otimista
                const isInCooldown = (Date.now() - (commandCooldownRef.current[serial] || 0)) < 10000;

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
                        gravity: payload.is_sg !== undefined && parseFloat(payload.is_sg) > 0 ? parseFloat(payload.is_sg) : undefined,
                        battery: payload.is_bat !== undefined && parseFloat(payload.is_bat) > 0 ? parseFloat(payload.is_bat) : undefined,
                        rssi: !isNaN(parsedRssi) ? parsedRssi : undefined,
                        ...(isRetained ? {} : { lastUpdate: new Date().toISOString() }),
                        statOp: statusStr || 'INATIVO',
                        logInterval: payload.wi ? payload.wi / 1000 : undefined,
                        compressorDelay: payload.cds,
                        version: payload.ver || payload.fw, // Firmware version
                        macCtrl: payload.macCtrl,
                        extSens: payload.ext_s || payload.extSens,
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
                        pwmWindowHeat: payload.pwmWindowHeat ?? payload.pwm_w
                    } as any // Use as any to rely on prior state spread inside updateFermenterLocal
                });
            } catch (e) {
                console.error("MQTT Parse Error", e);
            }
        });

        client.on('close', () => setConnectionStatus('disconnected'));
        client.on('error', (err) => {
            if (err.message && err.message.includes('client disconnecting')) return;
            console.error("MQTT Error", err);
        });

        return () => {
            clearTimeout(hardSyncTimer);
            if (syncTimer) clearTimeout(syncTimer);
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (clientRef.current) clientRef.current.end();
        };
    }, [token, refetch, updateFermenterLocal]);


    const sendCommand = useCallback((serialCode: string, type: string, payload: any) => {
        if (!serialCode) return;
        const normalizedSerial = serialCode.trim().toUpperCase();
        // Ownership guard on client side when fermenter list is loaded
        if (fermentersRef.current.length > 0) {
            const ownsDevice = fermentersRef.current.some(f => (f.id || '').trim().toUpperCase() === normalizedSerial);
            if (!ownsDevice) return;
        }
        // Cooldown: bloqueia telemetria de sobrescrever updates otimistas (exceto comandos de leitura)
        if (type !== 'request_status' && type !== 'scan_sensors') {
            commandCooldownRef.current[normalizedSerial] = Date.now();
        }
        // Publica via MQTT local (e mantém compatibilidade com mocks de testes)
        if (clientRef.current) {
            const msg = JSON.stringify({ ...payload, type, cmd: type });
            clientRef.current.publish(`brewbrother/${serialCode}/comando`, msg);
            clientRef.current.publish(`brewbrother/${serialCode}/command`, msg);
        }
        // Envia também via endpoint autenticado do backend (garante entrega mesmo com broker restrito por ACL)
        if (token && type !== 'request_status') {
            sendDeviceCommand(serialCode, type, payload, token).catch(() => {});
        }
    }, [token]);

    const clearOtaProgress = useCallback(() => {
        setOtaProgress({});
    }, []);

    const blockTelemetry = useCallback((serialCode: string) => {
        if (serialCode) {
            commandCooldownRef.current[serialCode.trim().toUpperCase()] = Date.now();
        }
    }, []);

    return (
        <BrewContext.Provider value={{ connectionStatus, isInitialSyncing, sendCommand, otaProgress, clearOtaProgress, scanResponses, blockTelemetry }}>
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
