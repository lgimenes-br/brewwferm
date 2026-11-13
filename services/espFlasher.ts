// Identificar e gravar a placa pelo USB (Web Serial + esptool-js da Espressif).
// Usado pelo assistente de instalacao (/instalar/assistente). So Chrome e Edge no computador.

import { ESPLoader, Transport } from 'esptool-js';
import { withTimeout } from './deviceLink';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Port = any; // SerialPort (Web Serial): os tipos ficam fora do tsconfig do site

export const webSerialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;

export type BoardId = 'esp32-devkit' | 's3-headless' | 'c3-headless' | 's3-35' | 'esp8266-lite';

export interface ChipInfo {
    chip: string;           // "ESP32", "ESP32-S3", "ESP32-C3", "ESP8266"...
    description: string;    // "ESP32-C3 (QFN32) (revision v0.4)"
    features: string[];
    flashSize?: string;     // "4MB"
    mac?: string;
}

/** Placas que o Breww aceita para cada chip. S3 tem duas imagens (com e sem a tela 3,5"). */
export const boardsForChip = (chip: string): BoardId[] => {
    const c = chip.toUpperCase();
    if (c === 'ESP32') return ['esp32-devkit'];
    if (c === 'ESP32-S3') return ['s3-headless', 's3-35'];
    if (c === 'ESP32-C3') return ['c3-headless'];
    if (c === 'ESP8266') return ['esp8266-lite']; // versao Lite (precisa de 4 MB de flash)
    return [];
};

/** ESP8266 com menos de 4 MB (ex.: ESP-01, 1 MB): o firmware + a area da atualizacao pelo app nao cabem */
export const flashTooSmall = (info: ChipInfo) => {
    if (info.chip.toUpperCase() !== 'ESP8266' || !info.flashSize) return false;
    const m = /^(\d+)\s*MB/i.exec(info.flashSize);
    return m ? Number(m[1]) < 4 : /KB/i.test(info.flashSize);
};

/** Pede ao navegador a porta da placa (abre a lista do sistema). */
export const requestPort = async (): Promise<Port> => (navigator as any).serial.requestPort();

const silentTerminal = { clean() {}, writeLine() {}, write() {} };

const withLoader = async <T>(port: Port, fn: (loader: ESPLoader) => Promise<T>): Promise<T> => {
    const transport = new Transport(port, false);
    const loader = new ESPLoader({ transport, baudrate: 460800, romBaudrate: 115200, terminal: silentTerminal });
    try {
        return await fn(loader);
    } finally {
        // Com prazo: se a porta nao fecha, o passo seguinte (reabrir e esperar o firmware) tem o proprio prazo
        try { await withTimeout(transport.disconnect(), 3000, 'Fechar a porta do gravador'); } catch { /* porta ja fechada ou travada */ }
    }
};

/** Le o chip (entra no modo de gravacao, le e reinicia a placa). Nao grava nada. */
export const detectChip = (port: Port): Promise<ChipInfo> => withLoader(port, async (loader) => {
    const description = await loader.main();
    const chip = loader.chip.CHIP_NAME;
    let features: string[] = [];
    let flashSize: string | undefined;
    let mac: string | undefined;
    try { features = await loader.chip.getChipFeatures(loader); } catch { /* opcional */ }
    try { flashSize = await loader.detectFlashSize(); } catch { /* opcional */ }
    try { mac = await (loader.chip as any).readMac(loader); } catch { /* opcional */ }
    try { await loader.after('hard_reset'); } catch { /* opcional */ }
    return { chip, description, features, flashSize, mac };
});

/** Versao publicada e imagem completa (bootloader + particoes + app) da placa. */
export const fetchFirmware = async (board: BoardId): Promise<{ version: string; data: Uint8Array }> => {
    const m = await fetch(`/firmware/manifest/${board}.json?t=${Date.now()}`);
    if (!m.ok) throw new Error('O firmware desta placa ainda não foi publicado.');
    const { version } = await m.json();
    const r = await fetch(`/firmware/install/${board}.bin?t=${Date.now()}`);
    if (!r.ok) throw new Error('Não foi possível baixar o firmware. Tente de novo.');
    return { version, data: new Uint8Array(await r.arrayBuffer()) };
};

/** Apaga e grava a imagem completa; progress de 0 a 1. Reinicia a placa no fim. */
export const flashFirmware = (port: Port, data: Uint8Array, onProgress: (p: number, stage: 'connect' | 'erase' | 'write') => void) =>
    withLoader(port, async (loader) => {
        onProgress(0, 'connect');
        await loader.main();
        onProgress(0, 'erase');
        await loader.writeFlash({
            fileArray: [{ data, address: 0 }],
            flashMode: 'keep',
            flashFreq: 'keep',
            flashSize: 'keep',
            eraseAll: true,
            compress: true,
            reportProgress: (_i, written, total) => onProgress(total ? written / total : 0, 'write'),
        });
        await loader.after('hard_reset');
    });
