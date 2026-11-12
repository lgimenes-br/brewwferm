// "Substituir aparelho": configuracoes da placa antiga (modo, alvo, tipo de rele) aplicadas na
// placa nova quando ela manda a primeira telemetria (antes disso o comando se perderia).

/** Valida o que o app mandou; retorna null se nao houver nada valido. */
export const sanitizeCarry = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    const mode = Number(raw.mode);
    if (Number.isInteger(mode) && mode >= 0 && mode <= 3) out.mode = mode;
    const sp = Number(raw.setpoint);
    if (raw.setpoint !== null && raw.setpoint !== undefined && Number.isFinite(sp) && sp >= -10 && sp <= 40) out.setpoint = Math.round(sp * 10) / 10;
    const ri = Number(raw.relInv);
    if (raw.relInv !== null && raw.relInv !== undefined && Number.isInteger(ri) && ri >= 0 && ri <= 3) out.relInv = ri;
    return Object.keys(out).length ? out : null;
};

/**
 * Comandos MQTT para a placa nova.
 *  - tipo de rele: so se a placa nova tambem for sem tela (a s3-35 tem reles proprios, ativos em alto;
 *    copiar a polaridade invertida faria os reles ligarem ao contrario)
 *  - alvo: so fora do fermentador com perfil ativo (ali quem manda e o perfil do lote)
 */
export const buildCarryCommands = (carry, { board, hasActiveBatch }) => {
    const cmds = [];
    if (!carry) return cmds;
    if (carry.mode !== undefined) cmds.push({ cmd: 'setMode', value: carry.mode });
    if (carry.relInv !== undefined && board && board !== 's3-35') {
        cmds.push({ cmd: 'set_relays', heaterInverted: (carry.relInv & 1) !== 0, coolerInverted: (carry.relInv & 2) !== 0 });
    }
    const fermWithProfile = (carry.mode ?? 0) === 0 && hasActiveBatch;
    if (carry.setpoint !== undefined && !fermWithProfile) {
        cmds.push({ cmd: 'setManual', field: 'setpoint_manual', val: carry.setpoint });
    }
    return cmds.map(c => ({ ...c, type: c.cmd }));
};
