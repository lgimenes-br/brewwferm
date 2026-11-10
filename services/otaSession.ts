// Sessao de atualizacao OTA vista pelo site: comeca no clique (antes de o aparelho
// responder) e acumula um log ao vivo das fases informadas pelo firmware no topico /ota.

export type OtaStage =
    | 'sent'        // comando enviado pelo site, aguardando o aparelho
    | 'received'    // aparelho confirmou o comando
    | 'connecting'  // conectando ao servidor de atualizacao (handshake TLS)
    | 'downloading'
    | 'verifying'   // download completo, conferindo MD5
    | 'rebooting'
    | 'done'        // aparelho voltou com a versao nova
    | 'failed';

export interface OtaEvent {
    ts: number;
    text: string;
    kind: 'info' | 'ok' | 'error';
}

export interface OtaSession {
    serial: string;
    name?: string;
    targetVersion?: string;
    stage: OtaStage;
    progress: number;
    attempt: number;
    startedAt: number;
    events: OtaEvent[];
}

export const OTA_NO_RESPONSE_MS = 20000;

const push = (s: OtaSession, text: string, now: number, kind: OtaEvent['kind'] = 'info'): OtaSession => ({
    ...s,
    events: [...s.events, { ts: now, text, kind }]
});

export const createOtaSession = (serial: string, opts: { name?: string; targetVersion?: string }, now: number): OtaSession =>
    push({
        serial,
        name: opts.name,
        targetVersion: opts.targetVersion,
        stage: 'sent',
        progress: 0,
        attempt: 1,
        startedAt: now,
        events: []
    }, opts.targetVersion ? `Comando de atualização para a versão ${opts.targetVersion} enviado ao aparelho` : 'Comando de atualização enviado ao aparelho', now);

const FINAL: OtaStage[] = ['done', 'failed'];

/** Aplica uma mensagem do topico /ota ({stage?, progress?, attempt?, error?}). */
export const applyOtaMessage = (s: OtaSession, msg: any, now: number): OtaSession => {
    if (!msg || typeof msg !== 'object' || FINAL.includes(s.stage)) return s;
    const progress = typeof msg.progress === 'number' ? Math.max(0, Math.min(100, msg.progress)) : s.progress;
    const attempt = typeof msg.attempt === 'number' ? msg.attempt : s.attempt;
    let stage: string | undefined = typeof msg.stage === 'string' ? msg.stage : undefined;

    // Firmware antigo: so manda "progress"
    if (!stage) {
        if (progress >= 100) stage = 'rebooting';
        else if (progress > 0) stage = 'downloading';
        else if (s.stage === 'downloading') stage = 'failed';
        else return s;
    }

    let next: OtaSession = { ...s, progress, attempt };
    switch (stage) {
        case 'received':
            if (s.stage === 'sent') next = push({ ...next, stage: 'received' }, 'Aparelho recebeu o comando', now, 'ok');
            break;
        case 'connecting':
            next = push({ ...next, stage: 'connecting', progress: 0 },
                attempt > 1 ? `Conectando ao servidor de atualização (tentativa ${attempt} de 3)…` : 'Conectando ao servidor de atualização…', now);
            break;
        case 'downloading':
            if (s.stage !== 'downloading') next = push({ ...next, stage: 'downloading' }, 'Baixando o firmware…', now);
            else next = { ...next, stage: 'downloading' };
            break;
        case 'verifying':
            next = push({ ...next, stage: 'verifying', progress: 100 }, 'Download concluído. Conferindo integridade (MD5)…', now);
            break;
        case 'retry':
            next = push({ ...next, stage: 'connecting', progress: 0 },
                `Falha${msg.error ? `: ${msg.error}` : ''}. Tentando de novo (${attempt} de 3)…`, now, 'error');
            break;
        case 'rebooting':
            next = push({ ...next, stage: 'rebooting', progress: 100 }, 'Firmware instalado e conferido. Reiniciando o aparelho…', now, 'ok');
            break;
        case 'failed':
            next = push({ ...next, stage: 'failed', progress: 0 },
                `A atualização falhou${msg.error ? `: ${msg.error}` : ''}. O aparelho continua funcionando na versão atual.`, now, 'error');
            break;
        default:
            return s;
    }
    return next;
};

/** Telemetria do aparelho depois de reiniciar: confirma a versao instalada. */
export const applyOtaTelemetry = (s: OtaSession, fw: string | undefined, now: number): OtaSession => {
    if (s.stage !== 'rebooting' || !fw) return s;
    if (!s.targetVersion || fw === s.targetVersion) {
        return push({ ...s, stage: 'done' }, `Aparelho reiniciado e funcionando na versão ${fw}`, now, 'ok');
    }
    return push({ ...s, stage: 'failed' }, `Aparelho reiniciou na versão ${fw}, mas a esperada era ${s.targetVersion}`, now, 'error');
};

export const isOtaFinal = (s: OtaSession) => FINAL.includes(s.stage);
