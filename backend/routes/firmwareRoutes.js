import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import express from 'express';

// ============================================================================
// Firmware OTA
//  - POST /api/firmware/release  (GitHub Actions do repo do firmware, token dedicado)
//  - GET  /firmware/version.json (site compara com a versao da placa)
//  - GET  /firmware/update.bin   (placa baixa; header x-MD5 e conferido antes de ativar)
//
// Um firmware por placa (header X-Firmware-Board / ?board=). A placa com tela (s3-35) e a
// padrao e mantem os arquivos e URLs de sempre (update.bin / version.json), entao aparelhos
// e apps antigos nao mudam. Placa desconhecida ou sem arquivo = 404: nunca serve o firmware
// de outra placa.
// ============================================================================

export const DEFAULT_BOARD = 's3-35';
// Familia do chip de cada placa (ESP Web Tools confere com o chip conectado no USB)
export const BOARD_CHIP_FAMILY = {
    's3-35': 'ESP32-S3',
    'esp32-devkit': 'ESP32',
    's3-headless': 'ESP32-S3',
    'c3-headless': 'ESP32-C3'
};
export const KNOWN_BOARDS = ['s3-35', 'esp32-devkit', 's3-headless', 'c3-headless'];

/** Placa pedida (header/query) ou a padrao; null se nao for uma placa conhecida */
export const resolveBoard = (value) => {
    const board = String(value ?? '').trim().toLowerCase() || DEFAULT_BOARD;
    return KNOWN_BOARDS.includes(board) ? board : null;
};

/** Imagem completa (instalador pelo USB) de cada placa */
export const installFiles = (firmwareDir, board) => ({
    binPath: path.join(firmwareDir, `install-${board}.bin`),
    metaPath: path.join(firmwareDir, `install-${board}.json`)
});

/** Arquivos de cada placa: a padrao usa os nomes antigos */
export const boardFiles = (firmwareDir, board) => board === DEFAULT_BOARD
    ? { binPath: path.join(firmwareDir, 'update.bin'), metaPath: path.join(firmwareDir, 'version.json') }
    : { binPath: path.join(firmwareDir, `update-${board}.bin`), metaPath: path.join(firmwareDir, `version-${board}.json`) };

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const MAX_FIRMWARE_BYTES = 4 * 1024 * 1024;     // imagem de OTA (so o app)
const MAX_INSTALL_BYTES = 8 * 1024 * 1024;      // imagem completa para gravar pelo USB (instalador)

export const parseSemver = (v) => {
    const m = SEMVER_RE.exec(String(v || '').trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

/** >0 se a for mais nova que b; null se alguma nao for semver */
export const compareSemver = (a, b) => {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) return null;
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
};

/** Imagem de app do ESP32 comeca com o byte magico 0xE9 */
export const looksLikeEsp32Image = (buf) => Buffer.isBuffer(buf) && buf.length > 1024 && buf[0] === 0xe9;

/** Imagem completa (bootloader+particoes+app, .merged.bin): o bootloader fica em 0x0 (S3/C3)
 *  ou em 0x1000 (ESP32 classico, comeca com 0xFF) */
export const looksLikeEsp32InstallImage = (buf) => Buffer.isBuffer(buf) && buf.length > 0x10000
    && (buf[0] === 0xe9 || buf[0x1000] === 0xe9);

const safeEqual = (a, b) => {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
};

export const registerFirmwareRoutes = (app, {
    firmwareDir,
    uploadToken = process.env.FIRMWARE_UPLOAD_TOKEN
}) => {
    const readMeta = async (metaPath) => {
        try {
            return JSON.parse(await fs.readFile(metaPath, 'utf8'));
        } catch {
            return null;
        }
    };

    app.post('/api/firmware/release',
        express.raw({ type: 'application/octet-stream', limit: MAX_INSTALL_BYTES }),
        async (req, res) => {
            try {
                if (!uploadToken) return res.status(503).json({ error: 'FIRMWARE_UPLOAD_TOKEN nao configurado no servidor' });
                const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
                if (!safeEqual(token, uploadToken)) return res.status(401).json({ error: 'Token invalido' });

                const board = resolveBoard(req.headers['x-firmware-board']);
                if (!board) return res.status(400).json({ error: `Placa desconhecida (use ${KNOWN_BOARDS.join(', ')})` });
                // "ota" (padrao) = so o app, para a atualizacao; "usb" = imagem completa do instalador
                const kind = String(req.headers['x-firmware-image'] || 'ota').trim().toLowerCase();
                if (kind !== 'ota' && kind !== 'usb') return res.status(400).json({ error: 'X-Firmware-Image deve ser ota ou usb' });
                const { binPath, metaPath } = kind === 'usb' ? installFiles(firmwareDir, board) : boardFiles(firmwareDir, board);

                const version = String(req.headers['x-firmware-version'] || '').trim();
                if (!parseSemver(version)) return res.status(400).json({ error: 'Versao invalida (use X.Y.Z)' });
                const bin = req.body;
                if (kind === 'ota') {
                    if (!looksLikeEsp32Image(bin)) return res.status(400).json({ error: 'Arquivo nao parece um firmware ESP32 (.bin)' });
                    if (bin.length > MAX_FIRMWARE_BYTES) return res.status(413).json({ error: 'Firmware de OTA grande demais' });
                } else if (!looksLikeEsp32InstallImage(bin)) {
                    return res.status(400).json({ error: 'Arquivo nao parece uma imagem completa de ESP32 (.merged.bin)' });
                }

                const current = await readMeta(metaPath);
                const cmp = current?.version ? compareSemver(version, current.version) : 1;
                if (cmp !== null && cmp <= 0) {
                    return res.status(409).json({ error: `Versao ${version} nao e mais nova que a publicada (${current.version})` });
                }

                const md5 = crypto.createHash('md5').update(bin).digest('hex');
                const sha256 = crypto.createHash('sha256').update(bin).digest('hex');
                await fs.mkdir(firmwareDir, { recursive: true });
                // Escrita atomica: a placa nunca baixa um arquivo pela metade
                await fs.writeFile(`${binPath}.tmp`, bin);
                await fs.rename(`${binPath}.tmp`, binPath);
                const meta = { version, board, kind, md5, sha256, size: bin.length, publishedAt: new Date().toISOString() };
                await fs.writeFile(`${metaPath}.tmp`, JSON.stringify(meta, null, 2));
                await fs.rename(`${metaPath}.tmp`, metaPath);

                console.log(`📦 [Firmware] Versao ${version} publicada para ${board} [${kind}] (${bin.length} bytes, md5 ${md5})`);
                res.status(201).json(meta);
            } catch (err) {
                console.error('❌ [Firmware] Falha ao publicar:', err);
                res.status(500).json({ error: 'Erro interno ao publicar firmware' });
            }
        });

    app.get('/firmware/version.json', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const board = resolveBoard(req.query.board);
        if (!board) return res.status(404).json({ version: '0.0.0' });
        const meta = await readMeta(boardFiles(firmwareDir, board).metaPath);
        if (!meta) return res.status(404).json({ version: '0.0.0' });
        res.json({ version: meta.version, board, md5: meta.md5, size: meta.size, publishedAt: meta.publishedAt });
    });

    app.get('/firmware/update.bin', async (req, res) => {
        try {
            const board = resolveBoard(req.query.board);
            if (!board) return res.status(404).send('Firmware update not found for this board');
            const { binPath, metaPath } = boardFiles(firmwareDir, board);
            if (!existsSync(binPath)) return res.status(404).send('Firmware update not found');
            const meta = await readMeta(metaPath);
            res.set('Cache-Control', 'no-store');
            // HTTPUpdate do ESP32 le este header e confere o MD5 antes de ativar a imagem
            if (meta?.md5) res.set('x-MD5', meta.md5);
            res.sendFile(binPath, { headers: { 'Content-Type': 'application/octet-stream' } });
        } catch (err) {
            console.error('❌ [Firmware] Falha ao servir update.bin:', err);
            res.status(500).send('Erro interno ao baixar firmware');
        }
    });

    // ---- Instalador pelo navegador (breww.live/instalar, ESP Web Tools) ----
    app.get('/firmware/manifest/:board.json', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const board = resolveBoard(req.params.board);
        if (!board) return res.status(404).json({ error: 'Placa desconhecida' });
        const meta = await readMeta(installFiles(firmwareDir, board).metaPath);
        if (!meta) return res.status(404).json({ error: 'Instalador ainda nao publicado para esta placa' });
        res.json({
            name: 'Breww Controller',
            version: meta.version,
            new_install_prompt_erase: true,
            // Placas sem tela respondem Improv Serial: o instalador pede o Wi-Fi logo depois de gravar.
            // A de tela configura o Wi-Fi nela mesma; 0 = nem tenta.
            new_install_improv_wait_time: board === 's3-35' ? 0 : 15,
            builds: [{ chipFamily: BOARD_CHIP_FAMILY[board], parts: [{ path: `/firmware/install/${board}.bin`, offset: 0 }] }]
        });
    });

    app.get('/firmware/install/:board.bin', async (req, res) => {
        try {
            const board = resolveBoard(req.params.board);
            if (!board) return res.status(404).send('Placa desconhecida');
            const { binPath } = installFiles(firmwareDir, board);
            if (!existsSync(binPath)) return res.status(404).send('Instalador nao encontrado');
            res.set('Cache-Control', 'no-store');
            res.sendFile(binPath, { headers: { 'Content-Type': 'application/octet-stream' } });
        } catch (err) {
            console.error('❌ [Firmware] Falha ao servir imagem do instalador:', err);
            res.status(500).send('Erro interno');
        }
    });
};
