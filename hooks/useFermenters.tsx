import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Fermenter, FermenterStatus, DeviceMode, BeerStyle } from '../types';

// Helper to map backend devices to frontend Fermenter interface
// (This was previously inside BrewContext.tsx fetchDevices)
const mapDevices = (apiData: any[], prevFermenters: Fermenter[]): Fermenter[] => {
    const prevMap = new Map(prevFermenters.map(f => [f.id, f]));

    return apiData.map((d: any): Fermenter => {
        const prevDev = prevMap.get(d.serial_code);

        let status = FermenterStatus.IDLE;
        if (d.active_batch_id) status = FermenterStatus.ACTIVE;

        const safeReadings = Array.isArray(prevDev?.readings) ? prevDev!.readings : [];
        const safeCurrentDevice = prevDev ? prevDev.currentDevice : {
            gravity: 0,
            temperature: 0,
            battery: 0,
            angle: 0,
            rssi: 0,
            lastUpdate: d.last_seen || new Date().toISOString(),
            statOp: d.status_op || d.stat_op || 'INATIVO',
            logInterval: d.wi ? d.wi / 1000 : 30, // Default 30s
            compressorDelay: d.cds || 310
        };

        return {
            id: d.serial_code,
            name: d.device_name,
            ipAddress: d.ip || d.serial_code || '',
            sensor1_name: d.sensor1_name,
            sensor2_name: d.sensor2_name,
            mode: (() => {
                const saved = localStorage.getItem(`device_mode_${d.serial_code}`);
                if (saved === DeviceMode.FRIDGE) return DeviceMode.FRIDGE;
                if (saved === DeviceMode.KEGERATOR) return DeviceMode.KEGERATOR;
                return prevDev?.mode || DeviceMode.FERMENTER;
            })(),
            status: status,
            beerName: d.active_batch_name || '',
            style: (() => {
                const backendStyle = d.active_batch_style || d.style;
                if (typeof backendStyle === 'string') {
                    const styleUpper = backendStyle.toUpperCase().replace(/\s+/g, '_');
                    if (styleUpper.includes('PALE') && styleUpper.includes('ALE')) return BeerStyle.PALE_ALE;
                    if (styleUpper.includes('IPA')) return BeerStyle.IPA;
                    if (styleUpper.includes('NEIPA')) return BeerStyle.NEIPA;
                    if (styleUpper.includes('STOUT')) return BeerStyle.STOUT;
                    if (styleUpper.includes('LAGER')) return BeerStyle.LAGER;
                    if (styleUpper.includes('WHEAT')) return BeerStyle.WHEAT;
                }
                return BeerStyle.LAGER;
            })(),
            startDate: d.active_batch_start || d.start_date || '',
            batchId: d.active_batch_id || undefined,
            og: d.active_batch_og || 0,
            fg: d.active_batch_fg || 1.010,
            volume: prevDev ? prevDev.volume : 20,
            targetTemp: prevDev ? prevDev.targetTemp : 20,
            readings: safeReadings,
            currentDevice: safeCurrentDevice,
            currentFridgeTemp: prevDev?.currentFridgeTemp || 20,
            profile: (() => {
                // If backend profile is a string, parse it
                let backendProfile = d.active_batch_profile || d.profile;
                if (typeof backendProfile === 'string') {
                    try { backendProfile = JSON.parse(backendProfile); } catch (e) { backendProfile = null; }
                }
                
                // If it's a valid array from backend, we map it
                if (Array.isArray(backendProfile) && backendProfile.length > 0) {
                    const newProfile = backendProfile.map((step: any, index: number) => ({
                        id: step.id || `step_${index}`,
                        name: step.name || step.n || `Etapa ${index + 1}`,
                        temperature: parseFloat(step.temperature || step.t) || 18,
                        duration: parseInt(step.duration || step.d) || 1
                    }));

                    // Deep compare to avoid breaking reference
                    if (prevDev?.profile && JSON.stringify(prevDev.profile) === JSON.stringify(newProfile)) {
                        return prevDev.profile;
                    }
                    return newProfile;
                }
                
                return prevDev?.profile || [];
            })(),
            currentStepIndex: prevDev ? prevDev.currentStepIndex : (d.active_batch_current_step || 0),
            isPaused: prevDev ? prevDev.isPaused : false,
            events: (() => {
                let backendEvents = d.events || d.active_batch_events;
                if (typeof backendEvents === 'string') {
                    try { backendEvents = JSON.parse(backendEvents); } catch (e) { backendEvents = []; }
                }
                const parsedBackendEvents = Array.isArray(backendEvents) ? backendEvents : [];
                if (parsedBackendEvents.length > 0) {
                    if (prevDev?.events && JSON.stringify(prevDev.events) === JSON.stringify(parsedBackendEvents)) {
                        return prevDev.events;
                    }
                    return parsedBackendEvents;
                }
                if (prevDev?.events && prevDev.events.length > 0) return prevDev.events;
                try {
                    const stored = localStorage.getItem(`events_${d.serial_code}`);
                    if (stored) return JSON.parse(stored);
                } catch (e) {}
                return [];
            })()
        };
    });
};

export const useFermenters = () => {
    const { token } = useAuth();
    const queryClient = useQueryClient();

    const { data: fermenters = [], isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ['fermenters'],
        queryFn: async () => {
            if (!token) return [];
            const apiData = await api.fetchDevices(token);
            
            // Get current cache to preserve local state like readings/mqtt updates
            const prevFermenters = queryClient.getQueryData<Fermenter[]>(['fermenters']) || [];
            
            // Map the data
            let mapped = mapDevices(apiData, prevFermenters);

            // Fetch batches to supplement metadata
            try {
                const batchesRes = await api.fetchBatches(token);
                mapped = mapped.map(f => {
                    if (f.batchId) {
                        const batchData = batchesRes.find((b: any) => b.id === f.batchId);
                        if (batchData) {
                            return {
                                ...f,
                                startDate: batchData.start_date || batchData.started_at || f.startDate,
                                profile: batchData.profile ? (
                                    typeof batchData.profile === 'string'
                                        ? JSON.parse(batchData.profile).map((step: any, index: number) => ({
                                            id: step.id || `step_${index}`,
                                            name: step.n || step.name || `Etapa ${index + 1}`,
                                            temperature: parseFloat(step.t || step.temperature) || 18,
                                            duration: parseInt(step.d || step.duration) || 1
                                        }))
                                        : batchData.profile
                                ) : f.profile
                            };
                        }
                    }
                    return f;
                });
            } catch (err) {
                console.error('Failed to fetch batches metadata', err);
            }

            const devicesWithBatches = apiData.filter((d: any) => d.active_batch_id);
            for (const device of devicesWithBatches) {
                try {
                    const backendEvents = await api.fetchEvents(device.active_batch_id);
                    const mappedEvents = backendEvents.map((e: any) => ({
                        id: e.id?.toString() || Math.random().toString(36).substr(2, 9),
                        type: e.event_type,
                        description: e.description,
                        timestamp: e.recorded_at
                    }));

                    let hasNewReadings = false;
                    let mappedReadings = [];
                    try {
                        const backendData = await api.fetchBatchData(device.active_batch_id);
                        
                        // optimization: only map if data length is different or no readings yet
                        const prevDev = mapped.find(f => f.id === device.serial_code);
                        if (!prevDev?.readings || backendData.length !== prevDev.readings.length) {
                             // Downsample to max 300 points to prevent browser freeze with Recharts
                             const step = Math.max(1, Math.floor(backendData.length / 300));
                             const sampledData = backendData.filter((_: any, i: number) => i % step === 0);

                             mappedReadings = sampledData.map((d: any) => ({
                                id: d.id,
                                beerTemp: parseFloat(d.temp_ferm ?? d.beerTemp ?? d.temperature ?? d.beer_temp ?? d.ferm ?? 0),
                                fridgeTemp: parseFloat(d.temp_amb ?? d.fridgeTemp ?? d.ambient_temp ?? d.fridge_temp ?? d.amb ?? 0),
                                targetTemp: parseFloat(d.target_temp ?? d.targetTemp ?? d.setpoint ?? 20),
                                gravity: parseFloat(d.gravity ?? d.is_sg ?? 0),
                                timestamp: d.recorded_at ?? d.timestamp
                            }));
                            hasNewReadings = true;
                        }
                    } catch (dErr) {
                        console.error(`Failed to fetch basic readings for ${device.active_batch_id}`, dErr);
                    }

                    mapped = mapped.map(f => f.id === device.serial_code ? { 
                        ...f, 
                        events: mappedEvents,
                        ...(hasNewReadings ? { readings: mappedReadings } : {})
                    } : f);
                } catch (err) {
                    console.error(`Failed to fetch events for ${device.active_batch_id}`);
                }
            }

            return mapped;
        },
        enabled: !!token,
        refetchInterval: 5 * 60 * 1000, // Refetch full structure every 5 mins
        refetchOnWindowFocus: false, // Prevent DB state from overwriting real-time MQTT state when focusing tab
        staleTime: Infinity 
    });

    // Mutations
    const addDeviceMutation = useMutation({
        mutationFn: (data: { serialCode: string, name: string }) => api.addDevice(data.serialCode, data.name),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    const deleteDeviceMutation = useMutation({
        mutationFn: (serialCode: string) => api.deleteDevice(serialCode),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    const startBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, name: string, style: string, og: number, fg: number }) => 
            api.startBatch(data.serialCode, data.name, data.style, data.og, data.fg),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    const finishBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, deviceId: string }) => api.stopBatch(data.serialCode),
        onSuccess: (_, variables) => {
            // Optimistically update device to IDLE
            queryClient.setQueryData<Fermenter[]>(['fermenters'], old => {
                if (!old) return [];
                return old.map(f => f.id === variables.deviceId ? {
                    ...f,
                    status: FermenterStatus.IDLE,
                    batchId: undefined,
                    beerName: '',
                    og: 0,
                    fg: 0,
                    profile: [],
                    startDate: '',
                    currentStepIndex: 0,
                    isPaused: false
                } : f);
            });
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
            queryClient.invalidateQueries({ queryKey: ['history'] });
        }
    });

    const updateBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, og?: number, fg?: number, name?: string }) => 
            api.updateBatch(data.serialCode, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    const saveEventMutation = useMutation({
        mutationFn: (data: { batchId: number, type: string, description: string, date: string }) => 
            api.saveEvent(data.batchId, data.type, data.description, data.date),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    // Local manual update for instant UI feedback (or when MQTT message arrives)
    const updateFermenterLocal = useCallback((serialCode: string, updates: Partial<Fermenter> & { newReading?: any }) => {
        if (updates.events !== undefined) {
            try {
                localStorage.setItem(`events_${serialCode}`, JSON.stringify(updates.events));
            } catch (e) {}
        }

        queryClient.setQueryData<Fermenter[]>(['fermenters'], old => {
            if (!old) return [];
            return old.map(f => {
                if (f.id === serialCode) {
                    const { newReading, ...rest } = updates;

                    // If the device has no active batch, do NOT allow MQTT to override
                    // status/profile/steps — only allow sensor telemetry through
                    let filteredRest = rest;
                    if (!f.batchId) {
                        const { status, profile, currentStepIndex, isPaused, ...safeUpdates } = rest;
                        filteredRest = safeUpdates;
                    }

                    let updatedReadings = f.readings;
                    if (newReading) {
                        // Se for uma leitura sem SG, tenta manter o último SG recebido neste lote (caso exista e seja > 0)
                        if (f.batchId && (!newReading.gravity || newReading.gravity === 0)) {
                            // Pega o SG da leitura anterior, se existir
                            const lastReading = f.readings && f.readings.length > 0 ? f.readings[f.readings.length - 1] : null;
                            if (lastReading && lastReading.gravity > 0) {
                                newReading.gravity = lastReading.gravity;
                            }
                        }
                        updatedReadings = [...(f.readings || []), newReading];
                    }

                    // Mesclar currentDevice com segurança para manter dados do iSpindel (como gravity) que demoram a chegar
                    let updatedCurrentDevice = filteredRest.currentDevice as any;
                    if (updatedCurrentDevice && f.currentDevice) {
                        updatedCurrentDevice = { ...f.currentDevice, ...updatedCurrentDevice };
                        // Se SG vier zerado ou NaN no pacote atual, mantem o antigo (se houver lote ativo)
                        if (f.batchId && (!updatedCurrentDevice.gravity || isNaN(updatedCurrentDevice.gravity))) {
                            if (f.currentDevice.gravity > 0) {
                                updatedCurrentDevice.gravity = f.currentDevice.gravity;
                            } else {
                                updatedCurrentDevice.gravity = 0;
                            }
                        }
                        filteredRest.currentDevice = updatedCurrentDevice;
                    }

                    return { ...f, ...filteredRest, readings: updatedReadings } as Fermenter;
                }
                return f;
            });
        });
    }, [queryClient]);

    return {
        fermenters,
        isLoading,
        isFetching,
        error,
        refetch,
        updateFermenterLocal,
        addDevice: addDeviceMutation.mutateAsync,
        deleteDevice: deleteDeviceMutation.mutateAsync,
        startBatch: startBatchMutation.mutateAsync,
        finishBatch: finishBatchMutation.mutateAsync,
        updateBatch: updateBatchMutation.mutateAsync,
        saveEvent: saveEventMutation.mutateAsync
    };
};
