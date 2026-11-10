// Depois de um comando, a tela ja mostra o novo estado (atualizacao otimista). A telemetria
// que chega em seguida pode ser VELHA (enviada antes de o aparelho aplicar o comando) e
// desfaria a mudanca. Antes isso era resolvido ignorando a telemetria por 10 s fixos, o que
// deixava o site atrasado mesmo com o aparelho ja confirmando em menos de 1 s.
// Agora: para comandos com valor verificavel (modo, setpoint) esperamos a CONFIRMACAO; para os
// demais, uma janela curta.

export const COOLDOWN_DEFAULT_MS = 3000;  // comandos sem valor verificavel
export const COOLDOWN_MAX_MS = 10000;     // limite se o aparelho nao confirmar

export interface PendingConfirm {
    since: number;
    opm?: number;  // modo esperado (0 fermentador, 1 geladeira, 2 chopeira)
    csp?: number;  // setpoint esperado
}

/** O que a telemetria deve trazer para confirmar o comando (ou null se nao ha o que conferir). */
export const expectationFor = (type: string, payload: any): Omit<PendingConfirm, 'since'> | null => {
    if (type === 'setMode' && payload?.value !== undefined) {
        const opm = Number(payload.value);
        return Number.isFinite(opm) ? { opm } : null;
    }
    if (type === 'setManual' && (payload?.field === 'setpoint_manual' || payload?.field === 'chopp_setpoint')) {
        const csp = parseFloat(payload.val);
        return Number.isFinite(csp) ? { csp } : null;
    }
    return null;
};

/** Registra um comando enviado, acumulando expectativas de comandos anteriores ainda pendentes. */
export const registerCommand = (prev: PendingConfirm | undefined, type: string, payload: any, now: number): PendingConfirm => {
    const keep = prev && now - prev.since < COOLDOWN_MAX_MS ? { opm: prev.opm, csp: prev.csp } : {};
    const exp = expectationFor(type, payload) || {};
    const next: PendingConfirm = { since: now, ...keep, ...exp };
    if (next.opm === undefined) delete next.opm;
    if (next.csp === undefined) delete next.csp;
    return next;
};

/**
 * Decide se a telemetria deve ser ignorada para os campos controlados por comando.
 * confirmed=true quando ela traz exatamente o que o comando pediu (pode limpar a pendencia).
 */
export const evaluateCooldown = (
    pending: PendingConfirm | undefined,
    telemetry: { opm?: unknown; csp?: unknown },
    now: number
): { inCooldown: boolean; confirmed: boolean } => {
    if (!pending) return { inCooldown: false, confirmed: false };
    const age = now - pending.since;
    if (age >= COOLDOWN_MAX_MS) return { inCooldown: false, confirmed: false };
    const hasExpectation = pending.opm !== undefined || pending.csp !== undefined;
    if (!hasExpectation) return { inCooldown: age < COOLDOWN_DEFAULT_MS, confirmed: false };

    const opmOk = pending.opm === undefined || Number(telemetry.opm) === pending.opm;
    const cspNum = parseFloat(String(telemetry.csp));
    const cspOk = pending.csp === undefined || (Number.isFinite(cspNum) && Math.abs(cspNum - pending.csp) < 0.05);
    if (opmOk && cspOk) return { inCooldown: false, confirmed: true };
    return { inCooldown: true, confirmed: false };
};
