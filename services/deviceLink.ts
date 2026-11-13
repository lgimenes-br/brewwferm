// Conversa com o firmware do Breww pela serial (115200), depois de gravado:
//  - Improv Serial (https://www.improv-wifi.com/serial/): estado, informacoes, redes e Wi-Fi
//  - comandos de texto do firmware sem tela (ex.: "codigo" -> "[Vinculo] Codigo de confirmacao: XXXXXXXX")
// Os pacotes Improv e as linhas de texto chegam misturados; o leitor separa os dois.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Port = any;

const HEADER = [0x49, 0x4d, 0x50, 0x52, 0x4f, 0x56]; // "IMPROV"
const T_STATE = 0x01, T_ERROR = 0x02, T_RPC = 0x03, T_RESULT = 0x04;
const CMD_WIFI = 0x01, CMD_STATE = 0x02, CMD_INFO = 0x03, CMD_NETWORKS = 0x04;
export const IMPROV_STATE = { ready: 0x02, provisioning: 0x03, provisioned: 0x04 } as const;
export const IMPROV_ERROR = { none: 0x00, invalid: 0x01, unknown: 0x02, unableToConnect: 0x03 } as const;

export interface WifiNetwork { ssid: string; rssi: number; secured: boolean }
type Packet = { type: number; data: number[] };

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const decodeStrings = (data: number[]) => {
    // resultado de RPC: comando | tamanho | (tam, texto)...
    const out: string[] = [];
    const dec = new TextDecoder();
    let i = 2;
    while (i < data.length) {
        const n = data[i++];
        out.push(dec.decode(new Uint8Array(data.slice(i, i + n))));
        i += n;
    }
    return { cmd: data[0], strings: out };
};

export class DeviceLink {
    private port: Port;
    private reader: any = null;
    private buf: number[] = [];
    private text = '';
    private closed = false;
    private packetWaiters: ((p: Packet) => boolean)[] = [];
    private lineWaiters: ((l: string) => boolean)[] = [];
    readonly lines: string[] = [];

    private constructor(port: Port) { this.port = port; }

    /** Abre a porta (tenta de novo enquanto a placa reinicia e o USB volta). */
    static async open(port: Port, timeoutMs = 10000): Promise<DeviceLink> {
        const start = Date.now();
        let lastErr: unknown;
        while (Date.now() - start < timeoutMs) {
            try {
                await port.open({ baudRate: 115200 });
                const link = new DeviceLink(port);
                link.readLoop();
                return link;
            } catch (e) {
                lastErr = e;
                if (String((e as Error)?.message || '').includes('already open')) {
                    const link = new DeviceLink(port);
                    link.readLoop();
                    return link;
                }
                await sleep(700);
            }
        }
        throw lastErr instanceof Error ? lastErr : new Error('Não foi possível abrir a porta da placa.');
    }

    private async readLoop() {
        while (!this.closed && this.port.readable) {
            this.reader = this.port.readable.getReader();
            try {
                for (;;) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    if (value) this.feed(value);
                }
            } catch { /* porta caiu (placa reiniciando) */ } finally {
                try { this.reader.releaseLock(); } catch { /* ok */ }
            }
            if (!this.closed) await sleep(300);
        }
    }

    private feed(bytes: Uint8Array) {
        for (const b of bytes) this.buf.push(b);
        // separa pacotes Improv do texto
        for (;;) {
            const h = this.findHeader();
            if (h < 0) {
                // sem cabecalho: tudo menos um possivel inicio de cabecalho no fim vira texto
                const keep = this.partialHeaderAtEnd();
                this.pushText(this.buf.splice(0, this.buf.length - keep));
                return;
            }
            if (h > 0) this.pushText(this.buf.splice(0, h));
            if (this.buf.length < 9) return;
            const len = this.buf[8];
            if (this.buf.length < 10 + len) return;
            const pkt = this.buf.splice(0, 10 + len);
            const sum = pkt.slice(0, 9 + len).reduce((s, x) => (s + x) & 0xff, 0);
            if (sum === pkt[9 + len] && pkt[6] === 1) this.onPacket({ type: pkt[7], data: pkt.slice(9, 9 + len) });
            if (this.buf[0] === 0x0a) this.buf.shift(); // o firmware manda \n depois do pacote
        }
    }

    private findHeader() {
        for (let i = 0; i + HEADER.length <= this.buf.length; i++) {
            if (HEADER.every((c, k) => this.buf[i + k] === c)) return i;
        }
        return -1;
    }

    private partialHeaderAtEnd() {
        for (let k = Math.min(HEADER.length - 1, this.buf.length); k > 0; k--) {
            if (HEADER.slice(0, k).every((c, j) => this.buf[this.buf.length - k + j] === c)) return k;
        }
        return 0;
    }

    private pushText(bytes: number[]) {
        if (!bytes.length) return;
        this.text += new TextDecoder().decode(new Uint8Array(bytes));
        let i;
        while ((i = this.text.indexOf('\n')) >= 0) {
            const line = this.text.slice(0, i).replace(/\r$/, '');
            this.text = this.text.slice(i + 1);
            if (!line.trim()) continue;
            this.lines.push(line);
            if (this.lines.length > 300) this.lines.shift();
            this.lineWaiters = this.lineWaiters.filter(w => !w(line));
        }
    }

    private onPacket(p: Packet) {
        this.packetWaiters = this.packetWaiters.filter(w => !w(p));
    }

    private async write(bytes: number[] | Uint8Array) {
        const w = this.port.writable.getWriter();
        try { await w.write(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); } finally { w.releaseLock(); }
    }

    private rpc(cmd: number, payload: number[] = []) {
        const data = [cmd, payload.length, ...payload];
        const pkt = [...HEADER, 0x01, T_RPC, data.length, ...data];
        pkt.push(pkt.reduce((s, x) => (s + x) & 0xff, 0));
        return this.write(pkt);
    }

    private waitPacket(match: (p: Packet) => boolean, timeoutMs: number): Promise<Packet> {
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => { this.packetWaiters = this.packetWaiters.filter(w => w !== waiter); reject(new Error('timeout')); }, timeoutMs);
            const waiter = (p: Packet) => { if (!match(p)) return false; clearTimeout(t); resolve(p); return true; };
            this.packetWaiters.push(waiter);
        });
    }

    /** Espera o firmware responder ao Improv (depois de gravar a placa leva alguns segundos para ligar). */
    async waitImprov(timeoutMs = 20000): Promise<number> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const p = this.waitPacket(x => x.type === T_STATE, 1200).catch(() => null);
            await this.rpc(CMD_STATE).catch(() => {});
            const got = await p;
            if (got) return got.data[0];
        }
        throw new Error('A placa não respondeu. Ela pode estar com um firmware antigo, ou é a placa com tela.');
    }

    async info(): Promise<{ firmware: string; version: string; chip: string; name: string } | null> {
        const p = this.waitPacket(x => x.type === T_RESULT && x.data[0] === CMD_INFO, 3000).catch(() => null);
        await this.rpc(CMD_INFO);
        const got = await p;
        if (!got) return null;
        const [firmware, version, chip, name] = decodeStrings(got.data).strings;
        return { firmware, version, chip, name };
    }

    async scan(timeoutMs = 15000): Promise<WifiNetwork[]> {
        const nets: WifiNetwork[] = [];
        const done = new Promise<void>((resolve, reject) => {
            const t = setTimeout(() => { this.packetWaiters = this.packetWaiters.filter(w => w !== waiter); reject(new Error('timeout')); }, timeoutMs);
            const waiter = (p: Packet) => {
                if (p.type !== T_RESULT || p.data[0] !== CMD_NETWORKS) return false;
                const { strings } = decodeStrings(p.data);
                if (!strings.length) { clearTimeout(t); resolve(); return true; }
                const [ssid, rssi, auth] = strings;
                if (ssid && !nets.some(n => n.ssid === ssid)) nets.push({ ssid, rssi: Number(rssi) || -100, secured: auth !== 'NO' });
                return false;
            };
            this.packetWaiters.push(waiter);
        });
        await this.rpc(CMD_NETWORKS);
        await done;
        return nets.sort((a, b) => b.rssi - a.rssi);
    }

    /** Envia o Wi-Fi e espera conectar. Resolve true se conectou; false se a senha/rede falhou. */
    async provision(ssid: string, password: string, timeoutMs = 30000): Promise<boolean> {
        const enc = new TextEncoder();
        const s = Array.from(enc.encode(ssid)), pw = Array.from(enc.encode(password));
        const outcome = this.waitPacket(p =>
            (p.type === T_STATE && p.data[0] === IMPROV_STATE.provisioned) ||
            (p.type === T_ERROR && p.data[0] === IMPROV_ERROR.unableToConnect), timeoutMs);
        await this.rpc(CMD_WIFI, [s.length, ...s, pw.length, ...pw]);
        const p = await outcome;
        return p.type === T_STATE;
    }

    /** Envia uma linha de comando e espera uma resposta que case com o padrao. */
    async command(line: string, pattern: RegExp, timeoutMs = 4000): Promise<RegExpMatchArray | null> {
        const got = new Promise<RegExpMatchArray | null>((resolve) => {
            const t = setTimeout(() => { this.lineWaiters = this.lineWaiters.filter(w => w !== waiter); resolve(null); }, timeoutMs);
            const waiter = (l: string) => { const m = l.match(pattern); if (!m) return false; clearTimeout(t); resolve(m); return true; };
            this.lineWaiters.push(waiter);
        });
        await this.write(new TextEncoder().encode(line + '\n'));
        return got;
    }

    /** Codigo de vinculo (8 caracteres) e ID do aparelho. Gera depois que o Wi-Fi conecta: tenta por alguns segundos. */
    async pairCode(timeoutMs = 20000): Promise<{ code: string; id: string } | null> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const m = await this.command('codigo', /Codigo de confirmacao:\s*([0-9A-F]{8})\s*\(ID\s*([0-9A-F]+)\)/i, 2500);
            if (m) return { code: m[1].toUpperCase(), id: m[2].toUpperCase() };
            await sleep(1500);
        }
        return null;
    }

    /**
     * Estado do aparelho pelo cabo (comando "status" do firmware sem tela):
     * "[Status] placa X | modo N | temp 21.50 / alvo 18.00 | Wi-Fi conectado (Casa) | nuvem conectada".
     * temp exatamente 0 = nenhum sensor lido ainda (o firmware comeca em 0 e so troca com leitura valida).
     */
    async status(timeoutMs = 3000): Promise<{ temp: number | null; target: number; wifi: boolean; ssid: string; cloud: boolean } | null> {
        const m = await this.command('status', /\[Status\].*?temp\s*(-?[\d.]+)\s*\/\s*alvo\s*(-?[\d.]+)\s*\|\s*Wi-Fi\s*(\S+)\s*\((.*?)\)\s*\|\s*nuvem\s*(\S+)/i, timeoutMs);
        if (!m) return null;
        const t = parseFloat(m[1]);
        return {
            temp: Number.isFinite(t) && t !== 0 ? t : null,
            target: parseFloat(m[2]),
            wifi: m[3].toLowerCase().startsWith('conectado'),
            ssid: m[4],
            cloud: m[5].toLowerCase().startsWith('conectada'),
        };
    }

    async close() {
        this.closed = true;
        try { await this.reader?.cancel(); } catch { /* ok */ }
        try { await this.port.close(); } catch { /* ok */ }
    }
}
