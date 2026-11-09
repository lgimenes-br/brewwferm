import { API_URL } from '../config';

// Fluxo ao vivo vindo do backend (Server-Sent Events via fetch, para poder mandar o
// token no header Authorization em vez de expor na URL). Substitui a conexao MQTT
// direta do navegador: o backend so repassa mensagens dos aparelhos do usuario.

export interface LiveOptions {
    token: string;
    onOpen?: () => void;
    onClose?: () => void;
    onMessage: (topic: string, payload: string, retain: boolean) => void;
    /** 401/403: sessao invalida, nao adianta reconectar */
    onUnauthorized?: () => void;
}

export interface LiveConnection {
    close: () => void;
}

/** Extrai eventos "data:" completos de um buffer SSE. Retorna os eventos e o resto incompleto. */
export const parseSseChunk = (buffer: string): { events: string[]; rest: string } => {
    const parts = buffer.split(/\r?\n\r?\n/);
    const rest = parts.pop() ?? '';
    const events: string[] = [];
    for (const part of parts) {
        const data = part
            .split(/\r?\n/)
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).replace(/^ /, ''))
            .join('\n');
        if (data) events.push(data);
    }
    return { events, rest };
};

export const connectLive = (opts: LiveOptions): LiveConnection => {
    let closed = false;
    let controller: AbortController | null = null;
    let retryMs = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = () => {
        if (closed) return;
        retryTimer = setTimeout(run, retryMs);
        retryMs = Math.min(retryMs * 2, 30000);
    };

    const run = async () => {
        if (closed) return;
        controller = new AbortController();
        let opened = false;
        try {
            const res = await fetch(`${API_URL}/live`, {
                headers: { Authorization: `Bearer ${opts.token}`, Accept: 'text/event-stream' },
                signal: controller.signal,
                cache: 'no-store'
            });
            if (res.status === 401 || res.status === 403) {
                opts.onUnauthorized?.();
                return;
            }
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

            opened = true;
            retryMs = 1000;
            opts.onOpen?.();

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (!closed) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const { events, rest } = parseSseChunk(buffer);
                buffer = rest;
                for (const raw of events) {
                    try {
                        const evt = JSON.parse(raw);
                        if (evt && typeof evt.topic === 'string') {
                            opts.onMessage(evt.topic, String(evt.payload ?? ''), Boolean(evt.retain));
                        }
                    } catch { /* evento malformado: ignora */ }
                }
            }
        } catch {
            // rede caiu / abortado: cai no reconnect abaixo
        }
        if (opened) opts.onClose?.();
        scheduleReconnect();
    };

    run();

    return {
        close: () => {
            closed = true;
            if (retryTimer) clearTimeout(retryTimer);
            controller?.abort();
        }
    };
};
