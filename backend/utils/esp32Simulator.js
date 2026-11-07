// ============================================================================
// BREWW Platform — Motor do ESP32 Virtual (Hardware-in-the-Loop MQTT Simulator)
// Conversa 100% pelo protocolo MQTT oficial das placas físicas ESP32:
//   - Publica telemetria em: brewbrother/<SERIAL>/data
//   - Publica respostas 1-Wire em: brewbrother/<SERIAL>/response e brewbrother/global/response
//   - Publica progresso OTA em: brewbrother/<SERIAL>/ota
//   - Publica ações de tela física em: brewbrother/<SERIAL>/device_action
//   - Escuta todos os comandos em: brewbrother/<SERIAL>/comando e /command
// ============================================================================

const DEFAULT_SERIAL = 'ESP32-VIRTUAL-01';

export const createInitialEsp32State = (serial = DEFAULT_SERIAL) => ({
    serial: String(serial).trim().toUpperCase(),
    enabled: false,
    unlinkedForDiscovery: false,
    autoPhysics: true,
    ferm: 20.2,
    amb: 16.5,
    csp: 19.0,
    fsm: 19.0,
    is_sg: 1.052,
    is_bat: 4.08,
    rssi: -46,
    opm: 0, // 0 = Fermentador, 1 = Geladeira, 2 = Chopeira
    fermRun: true,
    isPaused: false,
    forceRelayMode: 0, // 0 = AUTO, 1 = HEAT, 2 = COOL
    statOp: 'RESFRIANDO',
    steps: [
        { n: 'Fermentação Primária', t: 19.0, d: 120 },
        { n: 'Descanso de Diacetil', t: 22.0, d: 48 },
        { n: 'Cold Crash', t: 2.0, d: 72 }
    ],
    currStep: 0,
    profStat: 'Fermentação Primária',
    stepTime: 2.5,
    c_n1: 'Session IPA',
    c_n2: 'Torneira 1',
    c_n3: 'American IPA',
    c_n4: 'Breww Virtual Lab',
    c_ibu: 42,
    c_vol: 5.4,
    off_t1: 0,
    off_t2: 0,
    off_sg: 0,
    kp_h: 25,
    ki_h: 0.5,
    kd_h: 1.2,
    kp_c: 30,
    ki_c: 0.2,
    kd_c: 2.0,
    pwmWindowHeat: 2000,
    wi: 5000, // 5s no simulador para gravar gráficos e testar gatilhos rapidamente
    cds: 300,
    sgn: 'Gravidade',
    ver: 'V2.5.0-VIRTUAL',
    ip: '192.168.1.250',
    macCtrl: '28:FF:64:1E:8A:16:01',
    availableSensors: [
        '28:FF:64:1E:8A:16:01',
        '28:FF:64:1E:9B:22:02',
        '28:FF:64:1E:CC:33:03'
    ],
    ext_s: [
        { mac: '28:FF:64:1E:9B:22:02', name: 'Sensor Auxiliar Inox', temp: 18.9 }
    ],
    otaInProgress: false,
    otaProgress: 0,
    lastPublishedAt: null,
    commandLog: []
});

export const computeStatOp = (state) => {
    if (state.forceRelayMode === 1) return 'AQUECENDO (FORÇADO)';
    if (state.forceRelayMode === 2) return 'RESFRIANDO (FORÇADO)';
    if (state.opm === 0 && (state.isPaused || !state.fermRun)) return 'PAUSADO';
    const diff = Number(state.ferm) - Number(state.csp);
    if (diff > 0.3) return 'RESFRIANDO';
    if (diff < -0.3) return 'AQUECENDO';
    return state.opm === 0 ? 'FERMENTANDO (ESTÁVEL)' : 'ESTÁVEL';
};

export const buildTelemetryPayload = (state) => {
    const statOp = computeStatOp(state);
    state.statOp = statOp;
    const activeStep = Array.isArray(state.steps) && state.steps[state.currStep]
        ? state.steps[state.currStep]
        : null;
    const profStat = state.opm === 0 && activeStep
        ? (activeStep.n || `Etapa ${state.currStep + 1}`)
        : (state.opm === 1 ? 'MODO GELADEIRA' : 'MODO CHOPEIRA');
    state.profStat = profStat;

    return {
        ferm: Number(Number(state.ferm).toFixed(2)),
        amb: Number(Number(state.amb).toFixed(2)),
        csp: Number(Number(state.csp).toFixed(2)),
        fsm: Number(Number(state.fsm).toFixed(2)),
        is_sg: Number(Number(state.is_sg).toFixed(4)),
        is_bat: Number(Number(state.is_bat).toFixed(2)),
        rssi: Math.round(Number(state.rssi)),
        opm: Number(state.opm),
        fermRun: Boolean(state.fermRun && !state.isPaused),
        isPaused: Boolean(state.isPaused),
        statOp,
        profStat,
        steps: state.steps,
        currStep: Number(state.currStep) || 0,
        stepTime: Number(Number(state.stepTime || 0).toFixed(2)),
        c_n1: state.c_n1,
        c_n2: state.c_n2,
        c_n3: state.c_n3,
        c_n4: state.c_n4,
        c_ibu: state.c_ibu,
        c_vol: state.c_vol,
        off_t1: state.off_t1,
        off_t2: state.off_t2,
        off_sg: state.off_sg,
        kp_h: state.kp_h,
        ki_h: state.ki_h,
        kd_h: state.kd_h,
        kp_c: state.kp_c,
        ki_c: state.ki_c,
        kd_c: state.kd_c,
        pwmWindowHeat: state.pwmWindowHeat,
        wi: state.wi,
        cds: state.cds,
        ver: state.ver,
        fw: state.ver,
        ip: state.ip,
        macCtrl: state.macCtrl,
        ext_s: state.ext_s,
        ts: Math.floor(Date.now() / 1000)
    };
};

export const createVirtualEsp32Manager = (mqttClient, onPublish) => {
    const state = createInitialEsp32State(DEFAULT_SERIAL);
    let loopTimer = null;
    let otaTimer = null;
    let lastCmdSignature = '';
    let lastCmdTimestamp = 0;
    let lastCmdSource = '';

    const recordCommand = (type, payload) => {
        state.commandLog.unshift({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            type,
            payload
        });
        if (state.commandLog.length > 30) {
            state.commandLog.length = 30;
        }
    };

    const publishTelemetry = () => {
        const payload = buildTelemetryPayload(state);
        state.lastPublishedAt = new Date().toISOString();
        if (mqttClient) {
            mqttClient.publish(`brewbrother/${state.serial}/data`, JSON.stringify(payload));
        }
        if (typeof onPublish === 'function') {
            try { onPublish(state.serial, payload); } catch (e) {}
        }
        return payload;
    };

    const stepPhysics = () => {
        if (!state.autoPhysics) return;
        const target = Number(state.csp);
        const currentFerm = Number(state.ferm);
        const diff = target - currentFerm;

        if (state.forceRelayMode === 1) {
            state.ferm = Number((currentFerm + 0.12).toFixed(2));
            state.amb = Number((Number(state.amb) + 0.25).toFixed(2));
        } else if (state.forceRelayMode === 2) {
            state.ferm = Number((currentFerm - 0.12).toFixed(2));
            state.amb = Number((Number(state.amb) - 0.30).toFixed(2));
        } else if (state.opm === 0 && state.isPaused) {
            // Quando pausado, deriva lentamente para temperatura ambiente (22°C)
            state.ferm = Number((currentFerm + (22.0 - currentFerm) * 0.02).toFixed(2));
        } else {
            // Converge suavemente em direção ao setpoint (csp) com micro-oscilação realista de sensor DS18B20
            const stepDelta = Math.max(-0.18, Math.min(0.18, diff * 0.15));
            const jitter = (Math.random() - 0.5) * 0.04;
            state.ferm = Number((currentFerm + stepDelta + jitter).toFixed(2));
            const desiredAmb = diff < -0.2 ? target - 2.5 : (diff > 0.2 ? target + 1.5 : target - 0.5);
            state.amb = Number((Number(state.amb) + (desiredAmb - Number(state.amb)) * 0.2).toFixed(2));
        }

        // Atenuação lenta de gravidade quando fermentando ativamente
        if (state.opm === 0 && state.fermRun && !state.isPaused && state.is_sg > 1.008) {
            state.is_sg = Number(Math.max(1.008, Number(state.is_sg) - 0.0002).toFixed(4));
            state.stepTime = Number((Number(state.stepTime || 0) + 0.05).toFixed(2));
        }

        // Atualiza sensores extras com leve variação
        if (Array.isArray(state.ext_s)) {
            state.ext_s = state.ext_s.map(s => ({
                ...s,
                temp: Number(((Number(s.temp) || 19.0) + (Math.random() - 0.5) * 0.06).toFixed(1))
            }));
        }
    };

    const startLoop = () => {
        if (loopTimer) clearInterval(loopTimer);
        state.enabled = true;
        publishTelemetry();
        loopTimer = setInterval(() => {
            if (!state.enabled || state.otaInProgress) return;
            stepPhysics();
            publishTelemetry();
        }, 3000);
    };

    const stopLoop = () => {
        state.enabled = false;
        if (loopTimer) {
            clearInterval(loopTimer);
            loopTimer = null;
        }
    };

    const triggerOtaSimulation = (url, md5) => {
        if (otaTimer) clearInterval(otaTimer);
        state.otaInProgress = true;
        state.otaProgress = 0;
        const checkpoints = [0, 20, 45, 75, 100];
        let idx = 0;

        const emitProgress = () => {
            const p = checkpoints[idx];
            state.otaProgress = p;
            if (mqttClient) {
                mqttClient.publish(`brewbrother/${state.serial}/ota`, JSON.stringify({ progress: p, url, md5 }));
            }
            idx += 1;
            if (idx >= checkpoints.length) {
                clearInterval(otaTimer);
                otaTimer = null;
                setTimeout(() => {
                    state.otaInProgress = false;
                    state.otaProgress = 0;
                    // Extrai versão da URL se houver ou incrementa sufixo OTA
                    const verMatch = String(url || '').match(/v?\d+\.\d+\.\d+/i);
                    state.ver = verMatch ? verMatch[0].toUpperCase() : 'V2.6.0-OTA';
                    if (state.enabled) {
                        publishTelemetry();
                    }
                }, 600);
            }
        };

        emitProgress();
        otaTimer = setInterval(emitProgress, 500);
    };

    // Processa comandos MQTT exatamente como o firmware C++ do ESP32 físico
    const handleIncomingCommand = (targetSerial, rawPayload, options = {}) => {
        const normTarget = String(targetSerial || '').trim().toUpperCase();
        if (normTarget !== state.serial) return false;
        if (!rawPayload || typeof rawPayload !== 'object') return false;

        const type = String(rawPayload.type || rawPayload.cmd || '').trim();
        if (!type) return false;

        // Deduplica comandos idênticos que chegam simultaneamente de canais distintos (WebSocket MQTT + HTTP Proxy < 250ms)
        const now = Date.now();
        const source = String(options?.source || 'direct');
        const sig = `${type}:${JSON.stringify(rawPayload)}`;
        if (type !== 'request_status' && sig === lastCmdSignature && source !== lastCmdSource && (now - lastCmdTimestamp) < 250) {
            return true;
        }
        lastCmdSignature = sig;
        lastCmdTimestamp = now;
        lastCmdSource = source;

        recordCommand(type, rawPayload);

        switch (type) {
            case 'request_status': {
                if (state.enabled) publishTelemetry();
                return true;
            }
            case 'setMode': {
                const modeVal = Number(rawPayload.value ?? rawPayload.val ?? 0);
                if ([0, 1, 2].includes(modeVal)) {
                    state.opm = modeVal;
                    if (modeVal === 0 && Array.isArray(state.steps) && state.steps[state.currStep]) {
                        state.csp = Number(state.steps[state.currStep].t) || state.csp;
                    } else if (modeVal === 1) {
                        state.csp = Number(state.fsm) || 4.0;
                    } else if (modeVal === 2) {
                        state.csp = Number(state.fsm) || 1.5;
                    }
                }
                publishTelemetry();
                return true;
            }
            case 'setManual': {
                const newVal = parseFloat(rawPayload.val ?? rawPayload.value);
                if (!isNaN(newVal)) {
                    state.fsm = newVal;
                    state.csp = newVal;
                    if (state.opm === 0 && Array.isArray(state.steps) && state.steps[state.currStep]) {
                        state.steps[state.currStep].t = newVal;
                    }
                }
                publishTelemetry();
                return true;
            }
            case 'setProfile': {
                if (Array.isArray(rawPayload.steps)) {
                    state.steps = rawPayload.steps.map((s, i) => ({
                        n: s.n || s.name || `Etapa ${i + 1}`,
                        t: parseFloat(s.t ?? s.temperature ?? 19),
                        d: parseFloat(s.d ?? ((s.duration ?? 1) * 24))
                    }));
                }
                const nextStep = rawPayload.currentStep ?? rawPayload.currStep;
                if (nextStep !== undefined && !isNaN(Number(nextStep))) {
                    state.currStep = Math.max(0, Math.min(Number(nextStep), Math.max(0, state.steps.length - 1)));
                }
                if (rawPayload.stepTime !== undefined && !isNaN(Number(rawPayload.stepTime))) {
                    state.stepTime = Number(rawPayload.stepTime);
                } else {
                    state.stepTime = 0;
                }
                state.opm = 0;
                state.fermRun = true;
                state.isPaused = false;
                if (state.steps[state.currStep]) {
                    state.csp = Number(state.steps[state.currStep].t);
                    state.profStat = state.steps[state.currStep].n;
                }
                publishTelemetry();
                return true;
            }
            case 'skipStep': {
                if (Array.isArray(state.steps) && state.currStep < state.steps.length - 1) {
                    state.currStep += 1;
                    state.stepTime = 0;
                    state.csp = Number(state.steps[state.currStep].t);
                    state.profStat = state.steps[state.currStep].n;
                }
                publishTelemetry();
                return true;
            }
            case 'togglePause': {
                state.isPaused = !state.isPaused;
                state.fermRun = !state.isPaused;
                publishTelemetry();
                return true;
            }
            case 'setChopp': {
                const field = String(rawPayload.field || '');
                const val = rawPayload.val;
                if (field === 'c_n1') state.c_n1 = String(val ?? '');
                else if (field === 'c_n2') state.c_n2 = String(val ?? '');
                else if (field === 'c_n3') state.c_n3 = String(val ?? '');
                else if (field === 'c_n4') state.c_n4 = String(val ?? '');
                else if (field === 'c_ibu') state.c_ibu = parseFloat(val) || 0;
                else if (field === 'c_vol') state.c_vol = parseFloat(val) || 0;
                publishTelemetry();
                return true;
            }
            case 'setConfig': {
                const field = String(rawPayload.field || '');
                const val = parseFloat(rawPayload.val);
                if (field === 'webinterval' && !isNaN(val) && val > 0) {
                    state.wi = Math.round(val * 1000);
                } else if (field === 'compressordelay' && !isNaN(val) && val >= 0) {
                    state.cds = Math.round(val);
                }
                publishTelemetry();
                return true;
            }
            case 'setNames': {
                if (rawPayload.field === 'sgn' && rawPayload.val) {
                    state.sgn = String(rawPayload.val);
                }
                publishTelemetry();
                return true;
            }
            case 'setCalibration': {
                if (rawPayload.off_t1 !== undefined) state.off_t1 = parseFloat(rawPayload.off_t1) || 0;
                if (rawPayload.off_t2 !== undefined) state.off_t2 = parseFloat(rawPayload.off_t2) || 0;
                if (rawPayload.off_sg !== undefined) state.off_sg = parseFloat(rawPayload.off_sg) || 0;
                publishTelemetry();
                return true;
            }
            case 'Kp_h':
            case 'Ki_h':
            case 'Kd_h':
            case 'Kp_c':
            case 'Ki_c':
            case 'Kd_c':
            case 'pwmWindowHeat': {
                const keyMap = {
                    Kp_h: 'kp_h',
                    Ki_h: 'ki_h',
                    Kd_h: 'kd_h',
                    Kp_c: 'kp_c',
                    Ki_c: 'ki_c',
                    Kd_c: 'kd_c',
                    pwmWindowHeat: 'pwmWindowHeat'
                };
                const targetKey = keyMap[type];
                const parsed = parseFloat(rawPayload.val);
                if (targetKey && !isNaN(parsed)) {
                    state[targetKey] = parsed;
                }
                publishTelemetry();
                return true;
            }
            case 'autotune': {
                state.statOp = rawPayload.mode === 'heat' ? 'AUTOTUNE (AQUECIMENTO)' : 'AUTOTUNE (REFRIGERAÇÃO)';
                publishTelemetry();
                return true;
            }
            case 'forceRelay': {
                const rMode = Number(rawPayload.value ?? rawPayload.val ?? 0);
                if ([0, 1, 2].includes(rMode)) {
                    state.forceRelayMode = rMode;
                }
                publishTelemetry();
                return true;
            }
            case 'scan_sensors': {
                const respMsg = JSON.stringify({
                    type: 'scan_sensors_response',
                    id: state.serial,
                    macs: state.availableSensors
                });
                if (mqttClient) {
                    mqttClient.publish(`brewbrother/${state.serial}/response`, respMsg);
                    mqttClient.publish('brewbrother/global/response', respMsg);
                }
                return true;
            }
            case 'set_sensors': {
                if (rawPayload.macSensorControle) {
                    state.macCtrl = String(rawPayload.macSensorControle);
                }
                if (Array.isArray(rawPayload.extraSensors)) {
                    state.ext_s = rawPayload.extraSensors.map((s, idx) => ({
                        mac: s.mac || state.availableSensors[idx + 1] || `28:FF:64:1E:00:00:0${idx + 1}`,
                        name: s.name || `Sensor Extra ${idx + 1}`,
                        temp: s.temp !== undefined ? Number(s.temp) : Number((state.ferm - 0.5 + idx * 0.8).toFixed(1))
                    }));
                }
                publishTelemetry();
                return true;
            }
            case 'update_firmware': {
                triggerOtaSimulation(rawPayload.url, rawPayload.md5);
                return true;
            }
            case 'cmd': {
                const action = String(rawPayload.action || '');
                if (action === 'reboot') {
                    publishTelemetry();
                } else if (action === 'resetconfig') {
                    const fresh = createInitialEsp32State(state.serial);
                    Object.assign(state, fresh, { enabled: state.enabled, commandLog: state.commandLog });
                    publishTelemetry();
                } else if (action === 'clearchart') {
                    state.stepTime = 0;
                    publishTelemetry();
                }
                return true;
            }
            default:
                publishTelemetry();
                return true;
        }
    };

    // Simula ação iniciada fisicamente na tela touch de 3.5" / 7" do ESP32 (device_action)
    const triggerPhysicalDeviceAction = (actionPayload) => {
        const action = String(actionPayload?.action || 'start_batch');
        recordCommand(`device_action:${action}`, actionPayload);
        if (action === 'start_batch') {
            const rawSteps = Array.isArray(actionPayload?.profile) && actionPayload.profile.length > 0
                ? actionPayload.profile
                : [
                    { n: 'Primária (Tela Física)', t: 18.5, d: 120 },
                    { n: 'Maturação (Tela Física)', t: 21.0, d: 48 },
                    { n: 'Cold Crash (Tela Física)', t: 1.5, d: 48 }
                ];
            state.steps = rawSteps;
            state.currStep = 0;
            state.stepTime = 0;
            state.opm = 0;
            state.fermRun = true;
            state.isPaused = false;
            state.csp = Number(rawSteps[0].t) || 18.5;
            state.profStat = rawSteps[0].n || 'Primária';
            if (mqttClient) {
                mqttClient.publish(`brewbrother/${state.serial}/device_action`, JSON.stringify({
                    action: 'start_batch',
                    name: actionPayload?.name || 'IPA Iniciada na Placa Física',
                    style: actionPayload?.style || 'American IPA',
                    profile: rawSteps
                }));
            }
            publishTelemetry();
        } else if (action === 'stop_batch') {
            state.fermRun = false;
            state.isPaused = true;
            if (mqttClient) {
                mqttClient.publish(`brewbrother/${state.serial}/device_action`, JSON.stringify({
                    action: 'stop_batch'
                }));
            }
            publishTelemetry();
        }
        return state;
    };

    const updateSimulatorState = (patch) => {
        if (!patch || typeof patch !== 'object') return state;
        if (patch.serial && String(patch.serial).trim()) {
            state.serial = String(patch.serial).trim().toUpperCase();
        }
        if (patch.unlinkedForDiscovery !== undefined) {
            state.unlinkedForDiscovery = Boolean(patch.unlinkedForDiscovery);
        }
        if (patch.autoPhysics !== undefined) state.autoPhysics = Boolean(patch.autoPhysics);
        if (patch.ferm !== undefined && !isNaN(Number(patch.ferm))) state.ferm = Number(patch.ferm);
        if (patch.amb !== undefined && !isNaN(Number(patch.amb))) state.amb = Number(patch.amb);
        if (patch.csp !== undefined && !isNaN(Number(patch.csp))) {
            state.csp = Number(patch.csp);
            state.fsm = Number(patch.csp);
        }
        if (patch.is_sg !== undefined && !isNaN(Number(patch.is_sg))) state.is_sg = Number(patch.is_sg);
        if (patch.is_bat !== undefined && !isNaN(Number(patch.is_bat))) state.is_bat = Number(patch.is_bat);
        if (patch.rssi !== undefined && !isNaN(Number(patch.rssi))) state.rssi = Number(patch.rssi);
        if (patch.opm !== undefined && [0, 1, 2].includes(Number(patch.opm))) state.opm = Number(patch.opm);
        if (patch.wi !== undefined && !isNaN(Number(patch.wi)) && Number(patch.wi) >= 1000) state.wi = Number(patch.wi);

        if (patch.enabled !== undefined) {
            if (patch.enabled && !state.enabled) {
                startLoop();
            } else if (!patch.enabled && state.enabled) {
                stopLoop();
            }
        } else if (state.enabled) {
            publishTelemetry();
        }
        return state;
    };

    const getState = () => ({
        ...state,
        statOp: computeStatOp(state)
    });

    const clearCommandLog = () => {
        state.commandLog = [];
        return state;
    };

    return {
        getState,
        startLoop,
        stopLoop,
        publishTelemetry,
        stepPhysics,
        handleIncomingCommand,
        triggerPhysicalDeviceAction,
        triggerOtaSimulation,
        updateSimulatorState,
        clearCommandLog
    };
};
