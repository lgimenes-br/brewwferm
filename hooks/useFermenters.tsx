import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Fermenter, FermenterStatus, DeviceMode, normalizeGravity, parseBeerStyle } from '../types';

// Store latest live MQTT updates per device in memory so in-flight HTTP queries never overwrite real-time MQTT telemetry
const liveDeviceState = new Map<string, Partial<Fermenter>>();

export const clearLiveDeviceState = () => {
    liveDeviceState.clear();
};

const safeNum = (val: any, fallback: number): number => {
    if (val === null || val === undefined || val === '') return fallback;
    const n = parseFloat(String(val));
    return !isNaN(n) && isFinite(n) ? n : fallback;
};

const applyUpdateToFermenter = (f: Fermenter, updates: Partial<Fermenter>, appendReading = true): Fermenter => {
    const rest = { ...updates };

    // If the device has no active batch, do NOT allow MQTT to override
    // status/profile/steps — only allow sensor telemetry through
    let filteredRest: Partial<Fermenter> = rest;
    if (!f.batchId) {
        const { status, profile, currentStepIndex, isPaused, ...safeUpdates } = rest;
        filteredRest = safeUpdates;
    }

    // Remove undefined top-level keys (except batchId when explicitly clearing batch) so we never clobber existing properties with undefined
    Object.keys(filteredRest).forEach(k => {
        if (k !== 'batchId' && (filteredRest as any)[k] === undefined) {
            delete (filteredRest as any)[k];
        }
    });

    let updatedReadings = f.readings;
    const isLivePacket = Boolean((filteredRest.currentDevice as any)?.lastUpdate);

    // Mesclar currentDevice com segurança para manter dados do iSpindel (como gravity) que demoram a chegar
    let updatedCurrentDevice = filteredRest.currentDevice ? { ...(filteredRest.currentDevice as any) } : undefined;
    if (updatedCurrentDevice) {
        // Remove undefined keys so we don't clobber existing values (like lastUpdate when a retained message arrives)
        Object.keys(updatedCurrentDevice).forEach(key => {
            if (updatedCurrentDevice[key] === undefined) {
                delete updatedCurrentDevice[key];
            }
        });
        updatedCurrentDevice = { ...(f.currentDevice || {}), ...updatedCurrentDevice };
        // Se SG vier zerado ou NaN no pacote atual, mantem o antigo (se houver lote ativo)
        if (f.batchId && (!updatedCurrentDevice.gravity || isNaN(updatedCurrentDevice.gravity))) {
            if (f.currentDevice?.gravity > 0) {
                updatedCurrentDevice.gravity = f.currentDevice.gravity;
            } else {
                updatedCurrentDevice.gravity = 0;
            }
        }
        filteredRest.currentDevice = updatedCurrentDevice;

        // Adicionar nova leitura ao grafico local apenas em pacotes ao vivo (não retidos)
        if (appendReading && isLivePacket && filteredRest.currentDevice && filteredRest.currentDevice.temperature !== undefined && !isNaN(filteredRest.currentDevice.temperature)) {
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

    // Preserve triggerGravity from existing profile when ESP32 telemetry sends raw steps ({ n, t, d })
    if (Array.isArray(filteredRest.profile) && Array.isArray(f.profile) && f.profile.length > 0) {
        filteredRest.profile = filteredRest.profile.map((step, idx) => {
            if (step.triggerGravity === undefined && f.profile[idx]?.triggerGravity !== undefined) {
                return { ...step, triggerGravity: f.profile[idx].triggerGravity };
            }
            return step;
        });
    }

    return { ...f, ...filteredRest, readings: updatedReadings } as Fermenter;
};

// Helper to map backend devices to frontend Fermenter interface
// (This was previously inside BrewContext.tsx fetchDevices)
const mapDevices = (apiData: any[], prevFermenters: Fermenter[]): Fermenter[] => {
    if (!Array.isArray(apiData)) return [];
    const prevMap = new Map(prevFermenters.map(f => [(f.id || '').toUpperCase(), f]));

    return apiData.map((d: any): Fermenter => {
        const serialKey = String(d.serial_code || '').trim().toUpperCase();
        const prevDev = prevMap.get(serialKey);

        let status = FermenterStatus.IDLE;
        if (d.active_batch_id) status = FermenterStatus.ACTIVE;

        const safeReadings = (d.active_batch_id && prevDev?.batchId === d.active_batch_id && Array.isArray(prevDev?.readings))
            ? prevDev!.readings
            : [];
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
        const parsedSavedStepTime = savedStepTime !== null ? parseFloat(savedStepTime) : NaN;
        const safeCurrentDevice = hasLiveDeviceData ? prevDev!.currentDevice : {
            gravity: safeNum(d.last_gravity, 0),
            temperature: safeNum(d.last_temp, 0),
            battery: safeNum(d.last_battery, 0),
            angle: 0,
            rssi: d.last_rssi !== null && d.last_rssi !== undefined ? (parseInt(String(d.last_rssi), 10) || 0) : 0,
            lastUpdate: '',
            statOp: d.last_status || d.status_op || d.stat_op || 'INATIVO',
            logInterval: d.wi ? d.wi / 1000 : 30, // Default 30s
            compressorDelay: d.cds ?? 310,
            version: d.firmware_version || undefined,
            stepTime: !isNaN(parsedSavedStepTime) ? parsedSavedStepTime : undefined,
            extSens: parsedExtraSensors
        };

        const rawOg = normalizeGravity(d.active_batch_og, 0);
        const rawFg = normalizeGravity(d.active_batch_fg, 1.010);

        return {
            id: d.serial_code,
            name: d.device_name,
            ipAddress: d.ip || d.serial_code || '',
            sensor1_name: d.sensor1_name,
            sensor2_name: d.sensor2_name,
            sensor_sg_name: d.sensor_sg_name,
            mode: (() => {
                if (prevDev?.mode) return prevDev.mode;
                const saved = localStorage.getItem(`device_mode_${serialKey}`) || localStorage.getItem(`device_mode_${d.serial_code}`);
                if (saved === DeviceMode.FRIDGE) return DeviceMode.FRIDGE;
                if (saved === DeviceMode.KEGERATOR) return DeviceMode.KEGERATOR;
                if (saved === DeviceMode.FERMENTER) return DeviceMode.FERMENTER;
                return DeviceMode.FERMENTER;
            })(),
            status: status,
            beerName: d.active_batch_name || '',
            chopp_name: d.chopp_name,
            style: parseBeerStyle(d.active_batch_style || d.style),
            startDate: d.active_batch_start || d.start_date || '',
            stepStartDate: d.active_batch_step_start || '',
            batchId: d.active_batch_id || undefined,
            og: rawOg,
            fg: rawFg,
            volume: safeNum(d.active_batch_volume, prevDev ? prevDev.volume : 20),
            targetTemp: (hasLiveDeviceData && prevDev?.targetTemp !== undefined) ? prevDev.targetTemp : safeNum(d.last_target, 20),
            readings: safeReadings,
            currentDevice: safeCurrentDevice,
            currentFridgeTemp: (hasLiveDeviceData && prevDev?.currentFridgeTemp !== undefined) ? prevDev.currentFridgeTemp : safeNum(d.last_temp2, 20),
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
                        const trigGrav = normalizeGravity(step.triggerGravity ?? step.g, 0);
                        return {
                            id: step.id || `step_${index}`,
                            name: step.name || step.n || `Etapa ${index + 1}`,
                            temperature: !isNaN(parsedTemp) ? parsedTemp : 18,
                            duration: step.duration !== undefined ? parseFloat(step.duration) : (step.d !== undefined ? parseFloat(step.d) / 24 : 1),
                            ...(trigGrav > 0 ? { triggerGravity: trigGrav } : {})
                        };
                    });

                    // Deep compare to avoid breaking reference
                    if (prevDev?.profile && JSON.stringify(prevDev.profile) === JSON.stringify(newProfile)) {
                        return prevDev.profile;
                    }
                    return newProfile;
                }
                
                return d.active_batch_id ? (prevDev?.profile || []) : [];
            })(),
            currentStepIndex: d.active_batch_current_step !== null && d.active_batch_current_step !== undefined
                ? (parseInt(String(d.active_batch_current_step), 10) || 0)
                : (prevDev ? prevDev.currentStepIndex : 0),
            isPaused: prevDev ? prevDev.isPaused : false,
            kegeratorConfig: prevDev?.kegeratorConfig || (() => {
                try {
                    const saved = localStorage.getItem(`kegerator_${serialKey}`) || localStorage.getItem(`kegerator_${d.serial_code}`);
                    if (saved) return JSON.parse(saved);
                } catch (e) {}
                return undefined;
            })(),
            events: (() => {
                if (!d.active_batch_id) return [];
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
                if (prevDev?.batchId === d.active_batch_id && prevDev?.events && prevDev.events.length > 0) return prevDev.events;
                try {
                    const stored = localStorage.getItem(`events_${serialKey}`) || localStorage.getItem(`events_${d.serial_code}`);
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (Array.isArray(parsed)) return parsed;
                    }
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
                if (Array.isArray(batchesRes)) {
                    mapped = mapped.map(f => {
                        if (f.batchId) {
                            const batchData = batchesRes.find((b: any) => b.id === f.batchId);
                            if (batchData) {
                                let parsedBatchProfile = f.profile;
                                if ((!parsedBatchProfile || parsedBatchProfile.length === 0) && batchData.profile) {
                                    try {
                                        const rawProf = typeof batchData.profile === 'string' ? JSON.parse(batchData.profile) : batchData.profile;
                                        if (Array.isArray(rawProf)) {
                                            parsedBatchProfile = rawProf.map((step: any, index: number) => {
                                                const parsedTemp = parseFloat(step.t ?? step.temperature);
                                                const trigGrav = normalizeGravity(step.triggerGravity ?? step.g, 0);
                                                return {
                                                    id: step.id || `step_${index}`,
                                                    name: step.n || step.name || `Etapa ${index + 1}`,
                                                    temperature: !isNaN(parsedTemp) ? parsedTemp : 18,
                                                    duration: step.duration !== undefined ? parseFloat(step.duration) : (step.d !== undefined ? parseFloat(step.d) / 24 : 1),
                                                    ...(trigGrav > 0 ? { triggerGravity: trigGrav } : {})
                                                };
                                            });
                                        }
                                    } catch (e) {}
                                }
                                return {
                                    ...f,
                                    startDate: batchData.start_date || batchData.started_at || f.startDate,
                                    profile: parsedBatchProfile
                                };
                            }
                        }
                        return f;
                    });
                }
            } catch (err) {
                console.error('Failed to fetch batches metadata', err);
            }

            const devicesWithBatches = (Array.isArray(apiData) ? apiData : []).filter((d: any) => d.active_batch_id);
            for (const device of devicesWithBatches) {
                try {
                    const backendEvents = await api.fetchEvents(device.active_batch_id);
                    const mappedEvents = (Array.isArray(backendEvents) ? backendEvents : []).map((e: any) => ({
                        id: e.id?.toString() || Math.random().toString(36).substr(2, 9),
                        type: e.event_type,
                        description: e.description,
                        timestamp: e.recorded_at
                    }));

                    let hasNewReadings = false;
                    let mappedReadings: any[] = [];
                    try {
                        const backendData = await api.fetchBatchData(device.active_batch_id);
                        if (Array.isArray(backendData)) {
                            const prevDev = mapped.find(f => f.id === device.serial_code);
                            if (!prevDev?.readings || prevDev.readings.length === 0 || backendData.length !== prevDev.readings.length) {
                                 // Downsample to max 300 points to prevent browser freeze with Recharts
                                 const step = Math.max(1, Math.floor(backendData.length / 300));
                                 const sampledData = backendData.filter((_: any, i: number) => i % step === 0 || i === backendData.length - 1);

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
                const pendingLive = liveDeviceState.get((f.id || '').trim().toUpperCase()) || liveDeviceState.get(f.id);
                if (pendingLive) {
                    return applyUpdateToFermenter(f, pendingLive, false);
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
        onSuccess: (_, serialCode) => {
            const norm = serialCode.trim().toUpperCase();
            liveDeviceState.delete(serialCode);
            liveDeviceState.delete(norm);
            localStorage.removeItem(`device_mode_${serialCode}`);
            localStorage.removeItem(`device_mode_${norm}`);
            localStorage.removeItem(`device_stepTime_${serialCode}`);
            localStorage.removeItem(`device_stepTime_${norm}`);
            localStorage.removeItem(`kegerator_${serialCode}`);
            localStorage.removeItem(`kegerator_${norm}`);
            localStorage.removeItem(`events_${serialCode}`);
            localStorage.removeItem(`events_${norm}`);
            localStorage.removeItem(`sensors_${serialCode}`);
            localStorage.removeItem(`sensors_${norm}`);
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
        }
    });

    const startBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, name: string, style: string, og: number, fg: number, volume?: number, profile?: any[] }) => 
            api.startBatch(data.serialCode, data.name, data.style, data.og, data.fg, data.profile, data.volume),
        onSuccess: (res, variables) => {
            const norm = variables.serialCode.trim().toUpperCase();
            localStorage.removeItem(`events_${variables.serialCode}`);
            localStorage.removeItem(`events_${norm}`);
            localStorage.setItem(`device_stepTime_${variables.serialCode}`, '0');
            localStorage.setItem(`device_stepTime_${norm}`, '0');
            const firstStepTemp = Array.isArray(variables.profile) && variables.profile.length > 0 && !isNaN(Number(variables.profile[0]?.temperature))
                ? Number(variables.profile[0].temperature)
                : undefined;
            const mappedStyle = parseBeerStyle(variables.style);
            const cachedLive = liveDeviceState.get(norm) || liveDeviceState.get(variables.serialCode);
            if (cachedLive) {
                liveDeviceState.set(norm, {
                    ...cachedLive,
                    status: FermenterStatus.ACTIVE,
                    profile: variables.profile || [],
                    ...(firstStepTemp !== undefined ? { targetTemp: firstStepTemp } : {}),
                    currentStepIndex: 0,
                    isPaused: false,
                    readings: [],
                    ...(cachedLive.currentDevice ? { currentDevice: { ...cachedLive.currentDevice, stepTime: 0 } } : {})
                });
            }
            queryClient.setQueryData<Fermenter[]>(['fermenters'], old => {
                if (!old) return [];
                return old.map(f => (f.id || '').toUpperCase() === norm ? {
                    ...f,
                    status: FermenterStatus.ACTIVE,
                    batchId: res?.batchId ?? f.batchId ?? 1,
                    beerName: variables.name,
                    style: mappedStyle,
                    og: variables.og,
                    fg: variables.fg,
                    volume: variables.volume ?? f.volume ?? 20,
                    ...(firstStepTemp !== undefined ? { targetTemp: firstStepTemp } : {}),
                    profile: variables.profile || [],
                    currentStepIndex: 0,
                    isPaused: false,
                    startDate: new Date().toISOString(),
                    stepStartDate: new Date().toISOString(),
                    events: [],
                    readings: [],
                    currentDevice: f.currentDevice ? { ...f.currentDevice, stepTime: 0 } : f.currentDevice
                } : f);
            });
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
        }
    });

    const finishBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, deviceId: string }) => api.stopBatch(data.serialCode),
        onSuccess: (_, variables) => {
            const norm = variables.deviceId.trim().toUpperCase();
            const cachedLive = liveDeviceState.get(norm) || liveDeviceState.get(variables.deviceId);
            if (cachedLive) {
                const { status, profile, currentStepIndex, isPaused, readings, ...restLive } = cachedLive;
                liveDeviceState.set(norm, restLive);
                liveDeviceState.delete(variables.deviceId);
            }
            // Optimistically update device to IDLE
            queryClient.setQueryData<Fermenter[]>(['fermenters'], old => {
                if (!old) return [];
                return old.map(f => (f.id || '').toUpperCase() === norm ? {
                    ...f,
                    status: FermenterStatus.IDLE,
                    batchId: undefined,
                    beerName: '',
                    og: 0,
                    fg: 0,
                    profile: [],
                    startDate: '',
                    stepStartDate: '',
                    isPaused: false,
                    events: [],
                    readings: []
                } : f);
            });
            localStorage.removeItem(`events_${variables.deviceId}`);
            localStorage.removeItem(`events_${norm}`);
            localStorage.removeItem(`device_stepTime_${variables.deviceId}`);
            localStorage.removeItem(`device_stepTime_${norm}`);
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
            queryClient.invalidateQueries({ queryKey: ['history'] });
        }
    });

    const updateBatchMutation = useMutation({
        mutationFn: (data: { serialCode: string, og?: number, fg?: number, name?: string, profile?: any[] }) =>
            api.updateBatch(data.serialCode, { og: data.og, fg: data.fg, name: data.name, profile: data.profile }),
        onSuccess: (_, variables) => {
            const norm = variables.serialCode.trim().toUpperCase();
            if (variables.profile !== undefined) {
                const cachedLive = liveDeviceState.get(norm) || liveDeviceState.get(variables.serialCode);
                if (cachedLive) {
                    liveDeviceState.set(norm, { ...cachedLive, profile: variables.profile });
                }
            }
            queryClient.invalidateQueries({ queryKey: ['fermenters'] });
        }
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
        const norm = (serialCode || '').trim().toUpperCase();
        if (updates.events !== undefined) {
            try {
                localStorage.setItem(`events_${norm}`, JSON.stringify(updates.events));
                localStorage.setItem(`events_${serialCode}`, JSON.stringify(updates.events));
            } catch (e) {}
        }

        // Persist in liveDeviceState so in-flight HTTP queries never drop or overwrite this MQTT update
        const prevLive = liveDeviceState.get(norm) || liveDeviceState.get(serialCode) || {};
        const mergedCurrentDevice = updates.currentDevice
            ? {
                ...(prevLive.currentDevice || {}),
                ...Object.fromEntries(
                    Object.entries(updates.currentDevice).filter(([, v]) => v !== undefined)
                )
              }
            : prevLive.currentDevice;
        liveDeviceState.set(norm, {
            ...prevLive,
            ...updates,
            ...(mergedCurrentDevice ? { currentDevice: mergedCurrentDevice as any } : {})
        });

        queryClient.setQueryData<Fermenter[]>(['fermenters'], old => {
            if (!old) return [];
            return old.map(f => (f.id || '').trim().toUpperCase() === norm ? applyUpdateToFermenter(f, updates) : f);
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
