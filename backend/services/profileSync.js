// Perfil de fermentacao: o lote (banco) e a fonte da verdade; o controlador executa.
// A partir do firmware 2.7.0 o controlador entende setProfile/skipStep/togglePause e manda
// na telemetria: steps [{n,t,d(horas)}], currStep, stepTime (h na etapa, sem a pausa), isPaused.
// A presenca de "isPaused" no pacote identifica esse firmware.
//
// Regras de alinhamento (decideProfileSync):
//   - controlador sem perfil ativo, com lote ativo no banco          -> reenvia o perfil
//   - etapas diferentes (quantidade, temperatura ou duracao)          -> reenvia o perfil
//   - controlador numa etapa ANTERIOR a do banco                      -> reenvia o perfil
//   - controlador numa etapa POSTERIOR (avancou sozinho pelo tempo)   -> nao mexe (o servidor acompanha)
// Ao reenviar mantendo a mesma etapa, preserva o tempo que o controlador ja contou.

export const PROFILE_SYNC_MIN_INTERVAL_MS = 2 * 60 * 1000;

/** Pacote vindo do firmware com perfil remoto (2.7.0+) */
export const hasRemoteProfileSupport = (payload) =>
    !!payload && Object.prototype.hasOwnProperty.call(payload, 'isPaused');

const stepHours = (step) => {
    if (step.duration !== undefined) return Number(step.duration) * 24;
    const d = Number(step.d);
    return Number.isFinite(d) && d > 0 ? d : 24;
};

/** Etapas no formato do controlador ({ n, t, d em horas }) */
export const toDeviceSteps = (profile) =>
    (Array.isArray(profile) ? profile : []).map(step => ({
        n: step.name || step.n,
        t: Number(step.temperature ?? step.t),
        d: Number(stepHours(step).toFixed(2)),
    }));

export const stepsMatch = (deviceSteps, profile) => {
    if (!Array.isArray(deviceSteps) || !Array.isArray(profile)) return false;
    const expected = toDeviceSteps(profile);
    if (deviceSteps.length !== expected.length) return false;
    return expected.every((e, i) => {
        const d = deviceSteps[i] || {};
        return Math.abs(Number(d.t) - e.t) <= 0.05 && Math.abs(Number(d.d) - e.d) <= 0.2;
    });
};

/**
 * Decide se o controlador precisa receber o perfil do lote.
 * @returns null (nada a fazer) ou { currentStep, stepTime, reason }
 */
export const decideProfileSync = ({ payload, profile, dbStepIndex, stepStartedAt, now = Date.now() }) => {
    if (!hasRemoteProfileSupport(payload)) return null;      // firmware antigo
    if (Number(payload.opm) !== 0) return null;              // so no modo fermentador
    if (!Array.isArray(profile) || profile.length === 0) return null;
    const dbIdx = Math.min(Math.max(0, Number(dbStepIndex) || 0), profile.length - 1);
    const dbElapsedH = stepStartedAt ? Math.max(0, (now - new Date(stepStartedAt).getTime()) / 3600000) : 0;
    const devSteps = Array.isArray(payload.steps) ? payload.steps : null;

    if (!devSteps) return { currentStep: dbIdx, stepTime: round2(dbElapsedH), reason: 'controlador sem perfil ativo' };

    const devIdx = Number(payload.currStep);
    const sameStep = Number.isFinite(devIdx) && devIdx === dbIdx;
    if (!stepsMatch(devSteps, profile)) {
        const devTime = Number(payload.stepTime);
        return {
            currentStep: dbIdx,
            stepTime: round2(sameStep && Number.isFinite(devTime) ? devTime : dbElapsedH),
            reason: 'etapas diferentes do lote',
        };
    }
    if (Number.isFinite(devIdx) && devIdx < dbIdx) {
        return { currentStep: dbIdx, stepTime: round2(dbElapsedH), reason: 'controlador numa etapa anterior' };
    }
    return null;
};

const round2 = (v) => Math.round(v * 100) / 100;

/** Estado do perfil informado pelo controlador (para o agendador respeitar pausa e o tempo dele) */
export const createProfileLiveStore = () => {
    const map = new Map();
    return {
        update(serial, payload, now = Date.now()) {
            if (!hasRemoteProfileSupport(payload)) return;
            map.set(String(serial).trim().toUpperCase(), {
                at: now,
                isPaused: !!payload.isPaused,
                fermRun: !!Number(payload.fermRun),
                currStep: Number.isFinite(Number(payload.currStep)) ? Number(payload.currStep) : undefined,
            });
        },
        /** Estado recente (ate 15 min) ou undefined */
        get(serial, now = Date.now()) {
            const v = map.get(String(serial).trim().toUpperCase());
            return v && now - v.at <= 15 * 60 * 1000 ? v : undefined;
        },
    };
};
