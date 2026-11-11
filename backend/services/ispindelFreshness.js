// Leitura do iSpindel recente ou velha?
// O controlador guarda a ultima densidade/bateria do iSpindel e repete esses valores em todo pacote.
// Desde o firmware com "is_epc" (epoch da ultima leitura, em s), da para saber a idade:
//   - is_epc ausente  -> firmware antigo: mantem o comportamento de antes (trata como recente);
//   - is_epc = 0      -> horario desconhecido: trata como velha;
//   - mais que ISPINDEL_STALE_MS -> velha (o iSpindel costuma mandar a cada 15 min a 1 h).
// Leitura velha nao entra no historico nem dispara avanco por densidade ou alertas.

// 6 h: com envio de 1 em 1 h tolera ate 5 envios perdidos; cobre intervalos de 2-3 h
export const ISPINDEL_STALE_MS = 6 * 60 * 60 * 1000;

/** null = firmware antigo (sem is_epc); senao, true/false */
export const isIspindelFresh = (payload, now = Date.now()) => {
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'is_epc')) return null;
    const epc = Number(payload.is_epc);
    if (!Number.isFinite(epc) || epc < 1600000000) return false;
    const age = now - epc * 1000;
    return age >= -5 * 60 * 1000 && age <= ISPINDEL_STALE_MS; // tolera relogio um pouco adiantado
};

/** Zera is_sg/is_bat no pacote quando a leitura do iSpindel e velha (so para o processamento do servidor) */
export const dropStaleIspindel = (payload, now = Date.now()) => {
    if (isIspindelFresh(payload, now) === false) {
        payload.is_sg = 0;
        payload.is_bat = 0;
        return true;
    }
    return false;
};
