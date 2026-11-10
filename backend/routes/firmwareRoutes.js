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
// ============================================================================

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;
const MAX_FIRMWARE_BYTES = 4 * 1024 * 1024;

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

const safeEqual = (a, b) => {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
};

export const registerFirmwareRoutes = (app, {
    firmwareDir,
    uploadToken = process.env.FIRMWARE_UPLOAD_TOKEN
}) => {
    const binPath = path.join(firmwareDir, 'update.bin');
    const metaPath = path.join(firmwareDir, 'version.json');

    const readMeta = async () => {
        try {
            return JSON.parse(await fs.readFile(metaPath, 'utf8'));
        } catch {
            return null;
        }
    };

    app.post('/api/firmware/release',
        express.raw({ type: 'application/octet-stream', limit: MAX_FIRMWARE_BYTES }),
        async (req, res) => {
            try {
                if (!uploadToken) return res.status(503).json({ error: 'FIRMWARE_UPLOAD_TOKEN nao configurado no servidor' });
                const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
                if (!safeEqual(token, uploadToken)) return res.status(401).json({ error: 'Token invalido' });

                const version = String(req.headers['x-firmware-version'] || '').trim();
                if (!parseSemver(version)) return res.status(400).json({ error: 'Versao invalida (use X.Y.Z)' });
                const bin = req.body;
                if (!looksLikeEsp32Image(bin)) return res.status(400).json({ error: 'Arquivo nao parece um firmware ESP32 (.bin)' });

                const current = await readMeta();
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
                const meta = { version, md5, sha256, size: bin.length, publishedAt: new Date().toISOString() };
                await fs.writeFile(`${metaPath}.tmp`, JSON.stringify(meta, null, 2));
                await fs.rename(`${metaPath}.tmp`, metaPath);

                console.log(`📦 [Firmware] Versao ${version} publicada (${bin.length} bytes, md5 ${md5})`);
                res.status(201).json(meta);
            } catch (err) {
                console.error('❌ [Firmware] Falha ao publicar:', err);
                res.status(500).json({ error: 'Erro interno ao publicar firmware' });
            }
        });

    app.get('/firmware/version.json', async (req, res) => {
        const meta = await readMeta();
        res.set('Cache-Control', 'no-store');
        if (!meta) return res.status(404).json({ version: '0.0.0' });
        res.json({ version: meta.version, md5: meta.md5, size: meta.size, publishedAt: meta.publishedAt });
    });

    app.get('/firmware/update.bin', async (req, res) => {
        try {
            if (!existsSync(binPath)) return res.status(404).send('Firmware update not found');
            const meta = await readMeta();
            res.set('Cache-Control', 'no-store');
            // HTTPUpdate do ESP32 le este header e confere o MD5 antes de ativar a imagem
            if (meta?.md5) res.set('x-MD5', meta.md5);
            res.sendFile(binPath, { headers: { 'Content-Type': 'application/octet-stream' } });
        } catch (err) {
            console.error('❌ [Firmware] Falha ao servir update.bin:', err);
            res.status(500).send('Erro interno ao baixar firmware');
        }
    });
};
