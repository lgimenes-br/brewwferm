// Log da instalacao pelo site: passos do assistente e o que a placa escreveu na serial, com o tempo
// desde o inicio. Serve para achar onde cada placa travou (o admin ve em Marketing > Funil). Antes
// de sair do navegador, o nome e a senha do Wi-Fi e o codigo de confirmacao sao trocados por marcadores.

const MAX_LINES = 3000;
let started = Date.now();
let lines: string[] = [];
const secrets = new Map<string, string>(); // texto -> marcador

const stamp = () => `+${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s`;

export const ilog = (source: 'site' | 'placa', message: string) => {
    lines.push(`${stamp()} [${source}] ${message}`);
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
};

/** Texto que nunca sai do navegador como esta (Wi-Fi, codigo de confirmacao). */
export const ilogSecret = (value: string | null | undefined, label: string) => {
    if (value && value.length >= 3) secrets.set(value, `<${label}>`);
};

export const ilogReset = () => { started = Date.now(); lines = []; secrets.clear(); };

export const installLogText = (header: Record<string, string | null | undefined> = {}) => {
    const head = [
        `Breww: log da instalação (${new Date(started).toISOString()})`,
        `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : '-'}`,
        ...Object.entries(header).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
        '',
    ];
    let text = [...head, ...lines].join('\n');
    // valores mais longos primeiro (um pode conter o outro)
    for (const [value, mark] of [...secrets.entries()].sort((a, b) => b[0].length - a[0].length)) text = text.split(value).join(mark);
    return text;
};
