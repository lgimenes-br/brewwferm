// Protocolo do assistente de instalacao com uma placa simulada (Improv Serial + comandos de texto)
import { describe, it, expect } from 'vitest';
import { DeviceLink } from '../services/deviceLink';

const HEADER = [0x49, 0x4d, 0x50, 0x52, 0x4f, 0x56];
const packet = (type: number, data: number[]) => {
    const p = [...HEADER, 1, type, data.length, ...data];
    p.push(p.reduce((s, x) => (s + x) & 0xff, 0));
    return [...p, 0x0a];
};
const result = (cmd: number, strings: string[]) => {
    const enc = new TextEncoder();
    const body: number[] = [];
    for (const s of strings) { const b = Array.from(enc.encode(s)); body.push(b.length, ...b); }
    return packet(0x04, [cmd, body.length, ...body]);
};
const text = (s: string) => Array.from(new TextEncoder().encode(s));

/** Porta falsa que responde como o firmware do Breww (improv_serial.cpp e ui_headless.cpp). */
const fakeBoard = (opts: { wifiOk: boolean }) => {
    let push: (b: number[]) => void = () => {};
    const readable = new ReadableStream<Uint8Array>({ start(c) { push = (b) => c.enqueue(new Uint8Array(b)); } });
    const send = (b: number[]) => setTimeout(() => {
        // manda em pedacos pequenos, misturado com log, como a serial de verdade
        const all = [...text('[Sensores] DS18B20 (Cache ativos): 1\n'), ...b];
        for (let i = 0; i < all.length; i += 5) push(all.slice(i, i + 5));
    }, 5);
    const writable = new WritableStream<Uint8Array>({
        write(chunk) {
            const b = Array.from(chunk);
            if (HEADER.every((c, k) => b[k] === c) && b[7] === 0x03) {
                const cmd = b[9];
                if (cmd === 0x02) send([...packet(0x02, [0]), ...packet(0x01, [0x02])]);
                if (cmd === 0x03) send([...packet(0x02, [0]), ...result(0x03, ['Breww', '2.9.5', 'ESP32-C3', 'Breww-1A2B'])]);
                if (cmd === 0x04) send([...packet(0x02, [0]), ...result(0x04, ['Casa', '-48', 'YES']), ...result(0x04, ['Vizinho', '-80', 'NO']), ...result(0x04, [])]);
                if (cmd === 0x01) send([...packet(0x02, [0]), ...packet(0x01, [0x03]), ...(opts.wifiOk ? [...packet(0x01, [0x04]), ...result(0x01, ['https://breww.live/instalar#app'])] : packet(0x02, [0x03]))]);
                return;
            }
            const line = new TextDecoder().decode(chunk);
            if (line === 'codigo\n') send(text('[Vinculo] Codigo de confirmacao: 1A2B3C4D (ID 288485495464)\n'));
        },
    });
    return { open: async () => {}, close: async () => {}, readable, writable };
};

describe('DeviceLink (assistente de instalação)', () => {
    it('fala Improv no meio do log: estado, informações, redes e Wi-Fi', async () => {
        const link = await DeviceLink.open(fakeBoard({ wifiOk: true }));
        expect(await link.waitImprov(3000)).toBe(0x02);
        expect(await link.info()).toEqual({ firmware: 'Breww', version: '2.9.5', chip: 'ESP32-C3', name: 'Breww-1A2B' });
        const nets = await link.scan(3000);
        expect(nets.map(n => n.ssid)).toEqual(['Casa', 'Vizinho']);
        expect(nets[1].secured).toBe(false);
        expect(await link.provision('Casa', 'segredo', 3000)).toBe(true);
        expect(link.lines.some(l => l.includes('DS18B20'))).toBe(true);
        await link.close();
    });

    it('senha errada: o Wi-Fi responde que não conectou', async () => {
        const link = await DeviceLink.open(fakeBoard({ wifiOk: false }));
        await link.waitImprov(3000);
        expect(await link.provision('Casa', 'errada', 3000)).toBe(false);
        await link.close();
    });

    it('lê o código de vínculo pelo comando de texto', async () => {
        const link = await DeviceLink.open(fakeBoard({ wifiOk: true }));
        expect(await link.pairCode(3000)).toEqual({ code: '1A2B3C4D', id: '288485495464' });
        await link.close();
    });
});
