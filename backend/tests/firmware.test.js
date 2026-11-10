import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import express from 'express';
import { registerFirmwareRoutes, compareSemver, looksLikeEsp32Image } from '../routes/firmwareRoutes.js';

const TOKEN = 't'.repeat(48);
const fakeBin = (size = 4096) => { const b = Buffer.alloc(size, 7); b[0] = 0xe9; return b; };

test('compareSemver / looksLikeEsp32Image', () => {
    assert.ok(compareSemver('2.1.0', '2.0.9') > 0);
    assert.equal(compareSemver('2.1.0', '2.1.0'), 0);
    assert.ok(compareSemver('1.9.9', '2.0.0') < 0);
    assert.equal(compareSemver('V1.0.017 SAFE', '2.0.0'), null);
    assert.equal(looksLikeEsp32Image(fakeBin()), true);
    assert.equal(looksLikeEsp32Image(Buffer.from('<html>nope</html>'.repeat(100))), false);
});

test('publicacao pelo CI e download com x-MD5', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fw-'));
    const app = express();
    registerFirmwareRoutes(app, { firmwareDir: dir, uploadToken: TOKEN });
    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const publish = (version, body, token = TOKEN) => fetch(`${base}/api/firmware/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Firmware-Version': version, 'Content-Type': 'application/octet-stream' },
        body
    });
    try {
        assert.equal((await fetch(`${base}/firmware/version.json`)).status, 404);

        assert.equal((await publish('2.1.0', fakeBin(), 'errado')).status, 401);
        assert.equal((await publish('dev', fakeBin())).status, 400);
        assert.equal((await publish('2.1.0', Buffer.from('x'.repeat(5000)))).status, 400);

        const bin = fakeBin(8192);
        const ok = await publish('2.1.0', bin);
        assert.equal(ok.status, 201);
        const md5 = crypto.createHash('md5').update(bin).digest('hex');
        assert.equal((await ok.json()).md5, md5);

        const meta = await (await fetch(`${base}/firmware/version.json`)).json();
        assert.equal(meta.version, '2.1.0');

        const dl = await fetch(`${base}/firmware/update.bin`);
        assert.equal(dl.status, 200);
        assert.equal(dl.headers.get('x-md5'), md5);
        assert.deepEqual(Buffer.from(await dl.arrayBuffer()), bin);

        // Nao aceita versao igual ou mais antiga
        assert.equal((await publish('2.1.0', fakeBin())).status, 409);
        assert.equal((await publish('2.0.5', fakeBin())).status, 409);
        assert.equal((await publish('2.2.0', fakeBin())).status, 201);
    } finally {
        server.close();
        await fs.rm(dir, { recursive: true, force: true });
    }
});
