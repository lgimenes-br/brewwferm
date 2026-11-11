// Leitura do iSpindel recente ou velha? (mesma regra do servidor: backend/services/ispindelFreshness.js)
// O controlador repete a ultima densidade/bateria em todo pacote. Com "is_epc" (firmware novo,
// epoch da ultima leitura em s) da para saber a idade; sem ele (firmware antigo) mantem como antes.

// 6 h: com envio de 1 em 1 h tolera ate 5 envios perdidos; cobre intervalos de 2-3 h
export const ISPINDEL_STALE_MS = 6 * 60 * 60 * 1000;

/** null = firmware antigo (sem is_epc); true/false = leitura recente/velha */
export const isIspindelFresh = (payload: any, now = Date.now()): boolean | null => {
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'is_epc')) return null;
    const epc = Number(payload.is_epc);
    if (!Number.isFinite(epc) || epc < 1600000000) return false;
    const age = now - epc * 1000;
    return age >= -5 * 60 * 1000 && age <= ISPINDEL_STALE_MS;
};
