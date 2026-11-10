const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)$/i;

const parse = (v?: string | null): number[] | null => {
    const m = SEMVER_RE.exec(String(v ?? '').trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/**
 * true quando vale oferecer a atualizacao: a versao publicada e semver e
 *  - e mais nova que a da placa, ou
 *  - a placa roda um build sem versao oficial (ex: "dev" de build local, ou formato antigo).
 * Placa que nao informa versao (undefined/vazio) nao recebe oferta.
 */
export const isFirmwareUpdateAvailable = (published?: string | null, device?: string | null): boolean => {
    const p = parse(published);
    if (!p || !device || !String(device).trim()) return false;
    const d = parse(device);
    if (!d) return true;
    for (let i = 0; i < 3; i++) if (p[i] !== d[i]) return p[i] > d[i];
    return false;
};
