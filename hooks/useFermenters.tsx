import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Fermenter, FermenterStatus, DeviceMode, BeerStyle } from '../types';

// Store latest live MQTT updates per device in memory so in-flight HTTP queries never overwrite real-time MQTT telemetry
const liveDeviceState = new Map<string, Partial<Fermenter>>();

export const clearLiveDeviceState = () => {
    liveDeviceState.clear();
};

const applyUpdateToFermenter = (f: Fermenter, updates: Partial<Fermenter>): Fermenter => {
    const rest = { ...updates };

    // If the device has no active batch, do NOT allow MQTT to override
    // status/profile/steps — only allow sensor telemetry through
    let filteredRest: Partial<Fermenter> = rest;
    if (!f.batchId) {
        const { status, profile, currentStepIndex, isPaused, ...safeUpdates } = rest;
        filteredRest = safeUpdates;
    }

    let updatedReadings = f.readings;
    const isLivePacket = Boolean((filteredRest.currentDevice as any)?.lastUpdate);

    // Mesclar currentDevice com segurança para manter dados do iSpindel (como gravity) que demoram a chegar
    let updatedCurrentDevice = filteredRest.currentDevice ? { ...(filteredRest.currentDevice as any) } : undefined;
    if (updatedCurrentDevice && f.currentDevice) {
        // Remove undefined keys so we don't clobber existing values (like lastUpdate when a retained message arrives)
        Object.keys(updatedCurrentDevice).forEach(key => {
            if (updatedCurrentDevice[key] === undefined) {
                delete updatedCurrentDevice[key];
            }
        });
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

        // Adicionar nova leitura ao grafico local apenas em pacotes ao vivo (não retidos)
        if (isLivePacket && filteredRest.currentDevice && filteredRest.currentDevice.temperature !== undefined && !isNaN(filteredRest.currentDevice.temperature)) {
            const activeStepTemp = f.profile && f.profile.length > 0 && f.currentStepIndex !== undefined
                ? f.profile[f.currentStepIndex]?.temperature
                : undefined;
            const newReading: any = {
                timestamp: new Date().toISOString(),
                beerTemp: filteredRest.currentDevice.temperature,
                fridgeTemp: filteredRest.currentFridgeTemp ?? f.currentFridgeTemp ?? 0,
                targetTemp: filteredRest.targetTemp ?? activeStepTemp ?? f.targetTemp ?? 0,
                gravity: filteredRest.currentDevice.gravity,
                extra_sensors: filteredRest.currentDevice.extSens
            };
            updatedReadings = [...(updatedReadings || []), newReading].slice(-300);
        }
    }

    return { ...f, ...filteredRest, readings: updatedReadings } as Fermenter;
};

// Helper to map backend devices to frontend Fermenter interface
// (This was previously inside BrewContext.tsx fetchDevices)
const mapDevices = (apiData: any[], prevFermenters: Fermenter[]): Fermenter[] => {
    const prevMap = new Map(prevFermenters.map(f => [f.id, f]));

    return apiData.map((d: any): Fermenter => {
        const prevDev = prevMap.get(d.serial_code);

        let status = FermenterStatus.IDLE;
        if (d.active_batch_id) status = FermenterStatus.ACTIVE;

        const safeReadings = Array.isArray(prevDev?.readings) ? prevDev!.readings : [];
        const savedStepTime = localStorage.getItem(`device_stepTime_${d.serial_code}`);
        // Purge legacy cached lastUpdate so stale timestamps never mark an offline ESP32 as online
        localStorage.removeItem(`device_lastUpdate_${d.serial_code}`);

        const parsedExtraSensors = (() => {
            try {
                if (d.last_extra_sensors) {
                    if (typeof d.last_extra_sensors === 'string') return JSON.parse(d.last_extra_sensors);
                    return d.last_extra_sensors;
                }
            } catch (e) {}
            return undefined;
        })();

        const hasLiveDeviceData = Boolean(prevDev?.currentDevice?.lastUpdate);
        const safeCurrentDevice = hasLiveDeviceData ? prevDev!.currentDevice : {
            gravity: d.last_gravity !== null && d.last_gravity !== undefined ? parseFloat(d.last_gravity) : 0,
            temperature: d.last_temp !== null && d.last_temp !== undefined ? parseFloat(d.last_temp) : 0,
            battery: d.last_battery !== null && d.last_battery !== undefined ? parseFloat(d.last_battery) : 0,
            angle: 0,
            rssi: d.last_rssi ? parseInt(d.last_rssi) : 0,
            lastUpdate: '',
            statOp: d.last_status || d.status_op || d.stat_op || 'INATIVO',
            logInterval: d.wi ? d.wi / 1000 : 30, // Default 30s
            compressorDelay: d.cds || 310,
            version: d.firmware_version || undefined,
            stepTime: savedStepTime ? parseFloat(savedStepTime) : undefined,
            extSens: parsedExtraSensors
        };

        return {
            id: d.serial_code,
            name: d.device_name,
            ipAddress: d.ip || d.serial_code || '',
            sensor1_name: d.sensor1_name,
            sensor2_name: d.sensor2_name,
            sensor_sg_name: d.sensor_sg_name,
            mode: (() => {
                const saved = localStorage.getItem(`device_mode_${d.serial_code}`);
                if (saved === DeviceMode.FRIDGE) return DeviceMode.FRIDGE;
                if (saved === DeviceMode.KEGERATOR) return DeviceMode.KEGERATOR;
                return prevDev?.mode || DeviceMode.FERMENTER;
            })(),
            status: status,
            beerName: d.active_batch_name || '',
            chopp_name: d.chopp_name,
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
            stepStartDate: d.active_batch_step_start || '',
            batchId: d.active_batch_id || undefined,
            og: d.active_batch_og || 0,
            fg: d.active_batch_fg || 1.010,
            volume: prevDev ? prevDev.volume : 20,
            targetTemp: (hasLiveDeviceData && prevDev?.targetTemp !== undefined) ? prevDev.targetTemp : (d.last_target !== null && d.last_target !== undefined ? parseFloat(d.last_target) : 20),
            readings: safeReadings,
            currentDevice: safeCurrentDevice,
            currentFridgeTemp: (hasLiveDeviceData && prevDev?.currentFridgeTemp !== undefined) ? prevDev.currentFridgeTemp : (d.last_temp2 !== null && d.last_temp2 !== undefined ? parseFloat(d.last_temp2) : 20),
            profile: (() => {
                // If backend profile is a string, parse it
                let backendProfile = d.active_batch_profile || d.profile;
                if (typeof backendProfile === 'string') {
                    try { backendProfile = JSON.parse(backendProfile); } catch (e) { backendProfile = null; }
                }
                
                // If it's a valid array from backend, we map it
                if (Array.isArray(backendProfile) && backendProfile.length > 0) {
                    const newProfile = backendProfile.map((step: any, index: number) => {
                        const parsedTemp = parseFloat(step.temperature ?? step.t);
                        return {
                            id: step.id || `step_${index}`,
                            name: step.name || step.n || `Etapa ${index + 1}`,
                            temperature: !isNaN(parsedTemp) ? parsedTemp : 18,
                            duration: step.duration !== undefined ? parseFloat(step.duration) : (step.d !== undefined ? parseFloat(step.d) / 24 : 1)
                        };
                    });

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
            kegeratorConfig: prevDev?.kegeratorConfig || (() => {
                try {
                    const saved = localStorage.getItem(`kegerator_${d.serial_code}`);
                    if (saved) return JSON.parse(saved);
                } catch (e) {}
                return undefined;
            })(),
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

            // CRITICAL: Get current cache right before mapping to prevent race conditions with MQTT
            const latestFermenters = queryClient.getQueryData<Fermenter[]>(['fermenters']) || [];
            let mapped = mapDevices(apiData, latestFermenters);

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
                                        ? JSON.parse(batchData.profile).map((step: any, index: number) => {
                                            const parsedTemp = parseFloat(step.t ?? step.temperature);
                                            return {
                                                id: step.id || `step_${index}`,
                                                name: step.n || step.name || `Etapa ${index + 1}`,
                                                temperature: !isNaN(parsedTemp) ? parsedTemp : 18,
                                                duration: step.duration !== undefined ? parseFloat(step.duration) : (step.d !== undefined ? parseFloat(step.d) / 24 : 1)
                                            };
                                        })
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
                                timestamp: d.recorded_at ?? d.timestamp,
                                extra_sensors: d.extra_sensors
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

            // Re-apply any live MQTT telemetry that arrived while the HTTP requests above were in flight
            mapped = mapped.map(f => {
                const pendingLive = liveDeviceState.get(f.id);
                if (pendingLive) {
                    return applyUpdateToFermenter(f, pendingLive);
                }
                return f;
            });

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

    const updateDeviceMutation = useMutation({
        mutationFn: (data: { serialCode: string, name: string }) => api.updateDevice(data.serialCode, data.name),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    const deleteDeviceMutation = useMutation({
        mutationFn: (serialCode: string) => api.deleteDevice(serialCode),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    const startBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, name: string, style: string, og: number, fg: number, profile?: any[] }) => 
            api.startBatch(data.serialCode, data.name, data.style, data.og, data.fg, data.profile),
        onSuccess: (res, variables) => {
            localStorage.removeItem(`events_${variables.serialCode}`);
            queryClient.setQueryData<Fermenter[]>(['fermenters'], old => {
                if (!old) return [];
                return old.map(f => f.id === variables.serialCode ? {
                    ...f,
                    status: FermenterStatus.ACTIVE,
                    batchId: res?.batchId || f.batchId,
                    beerName: variables.name,
                    og: variables.og,
                    fg: variables.fg,
                    profile: variables.profile || [],
                    currentStepIndex: 0,
                    isPaused: false,
                    startDate: new Date().toISOString(),
                    events: []
                } : f);
            });
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
        }
    });

    const finishBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, deviceId: string }) => api.stopBatch(data.serialCode),
        onSuccess: (_, variables) => {
            const cachedLive = liveDeviceState.get(variables.deviceId);
            if (cachedLive) {
                const { status, profile, currentStepIndex, isPaused, ...restLive } = cachedLive;
                liveDeviceState.set(variables.deviceId, restLive);
            }
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
                    isPaused: false,
                    events: []
                } : f);
            });
            localStorage.removeItem(`events_${variables.deviceId}`);
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
            queryClient.invalidateQueries({ queryKey: ['history'] });
        }
    });

    const updateBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, og?: number, fg?: number, name?: string, profile?: any[] }) =>
            api.updateBatch(data.serialCode, { og: data.og, fg: data.fg, name: data.name, profile: data.profile }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fermenters'] })
    });

    const saveEventMutation = useMutation({
        mutationFn: (data: { batchId: number, type: string, description: string, date: string }) => 
            api.saveEvent(data.batchId, data.type, data.description, data.date),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
        }
    });

    const deleteEventMutation = useMutation({
        mutationFn: (eventId: string) => api.deleteEvent(eventId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
        }
    });

    // Local manual update for instant UI feedback (or when MQTT message arrives)
    const updateFermenterLocal = useCallback((serialCode: string, updates: Partial<Fermenter> ) => {
        if (updates.events !== undefined) {
            try {
                localStorage.setItem(`events_${serialCode}`, JSON.stringify(updates.events));
            } catch (e) {}
        }

        // Persist in liveDeviceState so in-flight HTTP queries never drop or overwrite this MQTT update
        const prevLive = liveDeviceState.get(serialCode) || {};
        const mergedCurrentDevice = updates.currentDevice
            ? {
                ...(prevLive.currentDevice || {}),
                ...Object.fromEntries(
                    Object.entries(updates.currentDevice).filter(([, v]) => v !== undefined)
                )
              }
            : prevLive.currentDevice;
        liveDeviceState.set(serialCode, {
            ...prevLive,
            ...updates,
            ...(mergedCurrentDevice ? { currentDevice: mergedCurrentDevice as any } : {})
        });

        queryClient.setQueryData<Fermenter[]>(['fermenters'], old => {
            if (!old) return [];
            return old.map(f => f.id === serialCode ? applyUpdateToFermenter(f, updates) : f);
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
        updateDevice: updateDeviceMutation.mutateAsync,
        deleteDevice: deleteDeviceMutation.mutateAsync,
        startBatch: startBatchMutation.mutateAsync,
        finishBatch: finishBatchMutation.mutateAsync,
        updateBatch: updateBatchMutation.mutateAsync,
        saveEvent: saveEventMutation.mutateAsync,
        deleteEvent: deleteEventMutation.mutateAsync
    };
};
