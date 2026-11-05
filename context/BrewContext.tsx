import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { MQTT_BROKER } from '../config';
import { useAuth } from './AuthContext';
import { useFermenters } from '../hooks/useFermenters';
import { FermenterStatus, DeviceMode } from '../types';

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

    useEffect(() => {
        fermentersRef.current = fermenters;
        if (clientRef.current?.connected && fermenters.length > 0) {
            const statusMsg = JSON.stringify({ type: 'request_status', cmd: 'request_status' });
            fermenters.forEach(f => {
                if (f.id) {
                    clientRef.current?.publish(`brewbrother/${f.id}/comando`, statusMsg);
                    clientRef.current?.publish(`brewbrother/${f.id}/command`, statusMsg);
                }
            });
        }
    }, [fermenters]);

    // --- MQTT ---
    useEffect(() => {
        if (!token) {
            setConnectionStatus('disconnected');
            setIsInitialSyncing(false);
            return;
        }
        if (clientRef.current) clientRef.current.end();
        setIsInitialSyncing(true);

        console.log("Connecting MQTT to", MQTT_BROKER);
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
            client.publish('brewbrother/all/command', statusMsg);
            client.publish('brewbrother/all/comando', statusMsg);
            fermentersRef.current.forEach(f => {
                if (f.id) {
                    client.publish(`brewbrother/${f.id}/comando`, statusMsg);
                    client.publish(`brewbrother/${f.id}/command`, statusMsg);
                }
            });
        };

        client.on('connect', () => {
            setConnectionStatus('connected');
            console.log("MQTT Connected");
            client.subscribe('brewbrother/+/ota'); // OTA Progress
            client.subscribe('brewbrother/global/update'); // Global refresh trigger
            client.subscribe('brewbrother/global/response'); // Global responses (scan sensors)
            client.subscribe('brewbrother/+/data', () => {
                // Immediately request live status from all connected ESP32 devices once subscription is active
                broadcastRequestStatus();
                if (syncTimer) clearTimeout(syncTimer);
                syncTimer = setTimeout(() => {
                    setIsInitialSyncing(false);
                }, 1800);
            });

            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(broadcastRequestStatus, 10000);
        });

        client.on('message', (topic, message, packet) => {
            const msgStr = message.toString();
            const isRetained = Boolean(packet?.retain);

            if (topic === 'brewbrother/global/update') {
                if (!isRetained) refetch();
                return;
            }

            if (topic.endsWith('/ota')) {
                if (isRetained) return;
                try {
                    const payload = JSON.parse(msgStr);
                    const serial = topic.split('/')[1];
                    if (payload.progress !== undefined) {
                        setOtaProgress(prev => ({ ...prev, [serial]: payload.progress }));
                    }
                } catch (e) {}
                return;
            }

            if (topic === 'brewbrother/global/response') {
                if (isRetained) return;
                try {
                    const payload = JSON.parse(msgStr);
                    if (payload.type === 'scan_sensors_response') {
                        setScanResponses(prev => ({ ...prev, [payload.id]: payload.macs || [] }));
                    }
                } catch (e) {}
                return;
            }

            try {
                const payload = JSON.parse(msgStr);
                const serial = topic.split('/')[1]; // brewbrother/SERIAL/data

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
                let target = 20;
                const statusStr = (payload.statOp || '').toUpperCase();
                
                if (statusStr.includes('FERMENT')) newStatus = FermenterStatus.ACTIVE;
                else if (statusStr.includes('CRASH')) newStatus = FermenterStatus.COLD_CRASH;
                else if (statusStr.includes('DIACETYL')) newStatus = FermenterStatus.DIACETYL_REST;
                else if (statusStr.includes('IDLE')) newStatus = FermenterStatus.IDLE;
                else if (payload.fermRun) newStatus = FermenterStatus.ACTIVE; 

                if (payload.csp !== undefined) {
                    target = payload.csp; // Always use ESP32's currentSetpoint (csp) as source of truth
                } else if (payload.opm === 0 && payload.steps && payload.steps[payload.currStep]) {
                    const stepTemp = parseFloat(payload.steps[payload.currStep]?.t);
                    target = !isNaN(stepTemp) ? stepTemp : 20;
                } else if (payload.fsm !== undefined) {
                    target = payload.fsm;
                }

                let profileUpdate = undefined;
                let currentStepIndexUpdate = undefined;
                let isPausedUpdate = undefined;

                if (payload.steps && Array.isArray(payload.steps) && payload.steps.length > 0) {
                    profileUpdate = payload.steps
                        .filter((step: any) => step.t > 0 || step.d > 0)
                        .map((step: any, index: number) => {
                            const parsedTemp = parseFloat(step.t);
                            return {
                                id: `step_${index}`,
                                name: step.n || `Etapa ${index + 1}`,
                                temperature: !isNaN(parsedTemp) ? parsedTemp : 18,
                                duration: step.d !== undefined ? (parseFloat(step.d) / 24) : 1
                            };
                        });
                }
                
                if (payload.currStep !== undefined) {
                    currentStepIndexUpdate = parseInt(payload.currStep) || 0;
                }
                
                if (payload.isPaused !== undefined || payload.fermRun !== undefined) {
                    isPausedUpdate = payload.isPaused !== undefined ? payload.isPaused : (payload.fermRun === false || payload.fermRun === 0);
                }

                let currentModeUpdate = undefined;
                if (payload.opm !== undefined) {
                    if (payload.opm === 0) currentModeUpdate = DeviceMode.FERMENTER;
                    else if (payload.opm === 1) currentModeUpdate = DeviceMode.FRIDGE;
                    else if (payload.opm === 2) currentModeUpdate = DeviceMode.KEGERATOR;
                    
                    if (currentModeUpdate) {
                        localStorage.setItem(`device_mode_${serial}`, currentModeUpdate);
                    }
                }
                
                let kegeratorConfigUpdate = undefined;
                if (payload.c_n1 !== undefined || payload.c_n2 !== undefined) {
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

                if (!isRetained && payload.stepTime !== undefined) {
                    localStorage.setItem(`device_stepTime_${serial}`, payload.stepTime.toString());
                }

                // Cooldown: se um comando foi enviado ha menos de 10s, nao sobrescreve targetTemp e mode
                // para evitar que telemetria velha (em transito) desfaca o update otimista
                const isInCooldown = (Date.now() - (commandCooldownRef.current[serial] || 0)) < 10000;

                // Call local React Query update which triggers re-render via useFermenters without refetching
                // Only live (non-retained) MQTT packets update lastUpdate so powered-off devices are never marked online
                updateFermenterLocal(serial, {
                    ...(newStatus ? { status: newStatus } : {}),
                    ...(!isInCooldown && currentModeUpdate ? { mode: currentModeUpdate } : {}),
                    ...(payload.ip ? { ipAddress: payload.ip } : {}),
                    ...(payload.amb !== undefined ? { currentFridgeTemp: parseFloat(payload.amb) } : {}),
                    ...(!isInCooldown ? { targetTemp: parseFloat(target as any) } : {}),
                    ...(profileUpdate ? { profile: profileUpdate } : {}),
                    ...(currentStepIndexUpdate !== undefined ? { currentStepIndex: currentStepIndexUpdate } : {}),
                    ...(isPausedUpdate !== undefined ? { isPaused: isPausedUpdate } : {}),
                    ...(kegeratorConfigUpdate ? { kegeratorConfig: kegeratorConfigUpdate } : {}),
                    currentDevice: {
                        temperature: parseFloat(payload.ferm),
                        gravity: payload.is_sg !== undefined && parseFloat(payload.is_sg) > 0 ? parseFloat(payload.is_sg) : undefined,
                        battery: payload.is_bat !== undefined && parseFloat(payload.is_bat) > 0 ? parseFloat(payload.is_bat) : undefined,
                        rssi: parseFloat(payload.rssi),
                        ...(isRetained ? {} : { lastUpdate: new Date().toISOString() }),
                        statOp: statusStr || 'INATIVO',
                        logInterval: payload.wi ? payload.wi / 1000 : undefined,
                        compressorDelay: payload.cds,
                        version: payload.ver || payload.fw, // Firmware version
                        macCtrl: payload.macCtrl,
                        extSens: payload.ext_s || payload.extSens,
                        stepTime: payload.stepTime !== undefined ? parseFloat(payload.stepTime) : parseFloat(localStorage.getItem(`device_stepTime_${serial}`) || '0')
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


    const sendCommand = (serialCode: string, type: string, payload: any) => {
        if (clientRef.current && serialCode) {
            const msg = JSON.stringify({ type, cmd: type, ...payload });
            clientRef.current.publish(`brewbrother/${serialCode}/comando`, msg);
            if (type === 'request_status') {
                clientRef.current.publish(`brewbrother/${serialCode}/command`, msg);
            }
            // Cooldown: bloqueia telemetria de sobrescrever updates otimistas (exceto comandos de leitura)
            if (type !== 'request_status' && type !== 'scan_sensors') {
                commandCooldownRef.current[serialCode] = Date.now();
            }
        }
    };

    const clearOtaProgress = () => {
        setOtaProgress({});
    };

    const blockTelemetry = (serialCode: string) => {
        commandCooldownRef.current[serialCode] = Date.now();
    };

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
