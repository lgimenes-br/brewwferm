import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { MQTT_BROKER } from '../config';
import { useAuth } from './AuthContext';
import { useFermenters } from '../hooks/useFermenters';
import { FermenterStatus, DeviceMode } from '../types';

interface BrewContextType {
    connectionStatus: 'connected' | 'disconnected';
    sendCommand: (serialCode: string, type: string, payload: any) => void;
}

const BrewContext = createContext<BrewContextType | undefined>(undefined);

export const BrewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { token } = useAuth();
    const { updateFermenterLocal, refetch } = useFermenters();
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
    const clientRef = useRef<MqttClient | null>(null);

    // --- MQTT ---
    useEffect(() => {
        if (!token) return;
        if (clientRef.current) clientRef.current.end();

        console.log("Connecting MQTT to", MQTT_BROKER);
        const client = mqtt.connect(MQTT_BROKER, {
            clientId: 'brew_' + Math.random().toString(16).substr(2, 8),
            protocol: 'wss',
            username: 'esp32user',
            password: 'esp32',
            keepalive: 60,
            reconnectPeriod: 5000,
            clean: true,
            wsOptions: { binaryType: 'arraybuffer' }
        });

        clientRef.current = client;

        client.on('connect', () => {
            setConnectionStatus('connected');
            console.log("MQTT Connected");
            client.subscribe('brewbrother/+/data'); // Telemetry
            client.subscribe('brewbrother/global/update'); // Global refresh trigger
        });

        client.on('message', (topic, message) => {
            const msgStr = message.toString();

            if (topic === 'brewbrother/global/update') {
                refetch();
                return;
            }

            try {
                const payload = JSON.parse(msgStr);
                const serial = topic.split('/')[1]; // brewbrother/SERIAL/data

                // Logic isolated directly referencing payload values
                let newStatus = undefined;
                let target = 20;
                const statusStr = (payload.statOp || '').toUpperCase();
                
                if (statusStr.includes('FERMENT')) newStatus = FermenterStatus.ACTIVE;
                else if (statusStr.includes('CRASH')) newStatus = FermenterStatus.COLD_CRASH;
                else if (statusStr.includes('DIACETYL')) newStatus = FermenterStatus.DIACETYL_REST;
                else if (statusStr.includes('IDLE')) newStatus = FermenterStatus.IDLE;
                else if (payload.fermRun) newStatus = FermenterStatus.ACTIVE; 

                if (payload.opm === 2) target = payload.csp;
                else if (payload.opm === 0 && payload.steps && payload.steps[payload.currStep]) {
                    target = payload.steps[payload.currStep]?.t || 20;
                } else if (payload.fsm) {
                    target = payload.fsm;
                }

                let profileUpdate = undefined;
                let currentStepIndexUpdate = undefined;
                let isPausedUpdate = undefined;

                if (payload.steps && Array.isArray(payload.steps) && payload.steps.length > 0) {
                    profileUpdate = payload.steps
                        .filter((step: any) => step.t > 0 || step.d > 0)
                        .map((step: any, index: number) => ({
                            id: `step_${index}`,
                            name: step.n || `Etapa ${index + 1}`,
                            temperature: parseFloat(step.t) || 18,
                            duration: parseInt(step.d) || 1
                        }));
                    currentStepIndexUpdate = parseInt(payload.currStep) || 0;
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

                // Call local React Query update which triggers re-render via useFermenters without refetching
                // We don't have the previous f object explicitly here unless we fetch it, 
                // but localUpdate will do a spread on the old data.
                updateFermenterLocal(serial, {
                    ...(newStatus ? { status: newStatus } : {}),
                    ...(currentModeUpdate ? { mode: currentModeUpdate } : {}),
                    ...(payload.ip ? { ipAddress: payload.ip } : {}),
                    ...(payload.amb !== undefined ? { currentFridgeTemp: parseFloat(payload.amb) } : {}),
                    targetTemp: parseFloat(target as any),
                    ...(profileUpdate ? { profile: profileUpdate } : {}),
                    ...(currentStepIndexUpdate !== undefined ? { currentStepIndex: currentStepIndexUpdate } : {}),
                    ...(isPausedUpdate !== undefined ? { isPaused: isPausedUpdate } : {}),
                    currentDevice: {
                        temperature: parseFloat(payload.ferm),
                        gravity: parseFloat(payload.is_sg),
                        battery: parseFloat(payload.is_bat),
                        rssi: parseFloat(payload.rssi),
                        lastUpdate: new Date().toISOString(),
                        statOp: statusStr || 'INATIVO',
                        logInterval: payload.wi ? payload.wi / 1000 : undefined,
                        compressorDelay: payload.cds,
                        version: payload.ver // Firmware version
                    } as any, // Use as any to rely on prior state spread inside updateFermenterLocal
                    newReading: {
                        timestamp: new Date().toISOString(),
                        beerTemp: parseFloat(payload.ferm) || 0,
                        fridgeTemp: parseFloat(payload.amb) || 0,
                        targetTemp: parseFloat(target as any) || 20,
                        gravity: parseFloat(payload.is_sg) || 0
                    }
                    // Note: Ideally readings should be updated here, doing it in local hook might be tricky without previous state
                    // We can augment updateFermenterLocal to receive a callback to access old state.
                });

                // Workaround for readings array
                // The queryClient.setQueryData handles the update
                // We'll trust the hook's implementation to just overwrite simple fields
            } catch (e) {
                console.error("MQTT Parse Error", e);
            }
        });

        client.on('close', () => setConnectionStatus('disconnected'));
        client.on('error', (err) => console.error("MQTT Error", err));

        return () => {
            if (clientRef.current) clientRef.current.end();
        };
    }, [token, refetch, updateFermenterLocal]);


    const sendCommand = (serialCode: string, type: string, payload: any) => {
        if (clientRef.current && serialCode) {
            clientRef.current.publish(`brewbrother/${serialCode}/comando`, JSON.stringify({ type, ...payload }));
        }
    };

    return (
        <BrewContext.Provider value={{
            connectionStatus,
            sendCommand
        }}>
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
