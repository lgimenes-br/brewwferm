// Limites por plano (o servidor e o unico lugar confiavel). Quem ja passou do limite mantem os
// aparelhos vinculados: o limite so impede adicionar novos (regra de transicao: decidir com o Pro).
export const FREE_MAX_DEVICES = 3;
export const PREMIUM_MAX_DEVICES = 9999;

export const maxDevicesFor = (planType) => (planType === 'premium' ? PREMIUM_MAX_DEVICES : FREE_MAX_DEVICES);

export const deviceLimitMessage = (max) =>
    `Sua conta já tem ${max} ${max === 1 ? 'aparelho' : 'aparelhos'}, o limite do seu plano. Remova um para adicionar outro.`;
