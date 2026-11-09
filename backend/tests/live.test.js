import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import express from 'express';
import { registerLiveRoutes, routeMessage } from '../routes/liveRoutes.js';

test('routeMessage', () => {
    assert.deepEqual(routeMessage('brewbrother/abc123/data'), { kind: 'device', serial: 'ABC123', channel: 'data' });
    assert.deepEqual(routeMessage('brewbrother/global/update'), { kind: 'broadcast' });
    assert.equal(routeMessage('brewbrother/abc/command').kind, 'ignore'); // comandos nunca vao para o navegador
    assert.equal(routeMessage('outro/topico').kind, 'ignore');
});

test('cada usuario so recebe mensagens dos proprios aparelhos', async () => {
    const devices = [{ serial_code: 'AAA111', user_id: 1 }, { serial_code: 'BBB222', user_id: 2 }];
    const pool = {
        async execute(sql, params) {
            if (sql.startsWith('SELECT role FROM users')) return [[{ role: 'user' }]];
            if (sql.startsWith('SELECT serial_code FROM devices WHERE user_id')) return [devices.filter(d => d.user_id === params[0])];
            throw new Error('query nao mockada: ' + sql);
        }
    };
    const mqttClient = Object.assign(new EventEmitter(), { connected: true, subscribe: () => {} });
    const app = express();
    const authenticateToken = (req, res, next) => {
        const id = Number(String(req.headers.authorization || '').split(' ')[1]);
        if (!id) return res.sendStatus(401);
        req.user = { id };
        next();
    };
    registerLiveRoutes(app, { pool, mqttClient, authenticateToken });

    // Telemetria anterior a conexao vira estado inicial "retido"
    mqttClient.emit('message', 'brewbrother/AAA111/data', Buffer.from('{"ferm":18}'), { retain: false });

    const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const controller = new AbortController();
    try {
        const unauth = await fetch(`${base}/api/live`);
        assert.equal(unauth.status, 401);

        const res = await fetch(`${base}/api/live`, { headers: { Authorization: 'Bearer 1' }, signal: controller.signal });
        assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        const readUntil = async (needle) => {
            while (!text.includes(needle)) {
                const { value, done } = await reader.read();
                if (done) break;
                text += decoder.decode(value, { stream: true });
            }
        };

        await readUntil('ferm');
        assert.match(text, /"topic":"brewbrother\/AAA111\/data".*"retain":true/);

        mqttClient.emit('message', 'brewbrother/BBB222/data', Buffer.from('{"segredo":1}'), {});
        mqttClient.emit('message', 'brewbrother/aaa111/response', Buffer.from('{"type":"scan_sensors_response"}'), {});
        await readUntil('scan_sensors_response');
        assert.ok(!text.includes('segredo'), 'nao pode receber dados de aparelho de outro usuario');
    } finally {
        controller.abort();
        server.closeAllConnections?.();
        server.close();
    }
});
