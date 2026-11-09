// ============================================================================
// Fluxo ao vivo para o navegador (Server-Sent Events)
//
// O navegador NAO fala mais com o broker MQTT. O backend (unico cliente com acesso
// total ao broker) repassa a cada usuario apenas as mensagens dos aparelhos dele.
// Comandos vao pelo endpoint autenticado POST /api/devices/:serial/command.
//
// Formato de cada evento:  data: {"topic":"brewbrother/<SERIAL>/data","payload":"<texto>","retain":false}
// ============================================================================

const DEVICE_TOPIC_RE = /^brewbrother\/([^/]+)\/(data|status|ota|response)$/;
const HEARTBEAT_MS = 25000;

/** Decide quem recebe uma mensagem do broker. Funcao pura (testavel). */
export const routeMessage = (topic) => {
    if (topic === 'brewbrother/global/update') return { kind: 'broadcast' };
    const m = DEVICE_TOPIC_RE.exec(topic);
    if (m) return { kind: 'device', serial: m[1].trim().toUpperCase(), channel: m[2] };
    return { kind: 'ignore' };
};

export const registerLiveRoutes = (app, { pool, mqttClient, authenticateToken }) => {
    const clients = new Set(); // { res, userId, isAdmin, serials:Set<string> }
    const lastTelemetry = new Map(); // serial -> ultimo payload de /data (reenviado como "retido" a quem conecta)

    const loadAccess = async (userId) => {
        const [uRows] = await pool.execute('SELECT role FROM users WHERE id = ? LIMIT 1', [userId]);
        const isAdmin = uRows[0]?.role === 'admin';
        const [rows] = await pool.execute('SELECT serial_code FROM devices WHERE user_id = ?', [userId]);
        return { isAdmin, serials: new Set(rows.map(r => String(r.serial_code).trim().toUpperCase())) };
    };

    const send = (client, topic, payload, retain) => {
        try {
            client.res.write(`data: ${JSON.stringify({ topic, payload, retain: Boolean(retain) })}\n\n`);
        } catch (e) { /* conexao caiu; o 'close' limpa */ }
    };

    const canSee = (client, serial) => client.isAdmin || client.serials.has(serial);

    // Mensagens do broker -> navegadores autorizados
    mqttClient.on('message', (topic, message, packet) => {
        const route = routeMessage(topic);
        if (route.kind === 'ignore') return;
        const payload = message.toString();
        const retain = Boolean(packet?.retain);

        if (route.kind === 'broadcast') {
            // Vinculos podem ter mudado: recarrega a lista de aparelhos de cada conexao
            for (const client of clients) {
                loadAccess(client.userId)
                    .then(access => { client.isAdmin = access.isAdmin; client.serials = access.serials; })
                    .catch(() => {})
                    .finally(() => send(client, topic, payload, retain));
            }
            return;
        }

        if (route.channel === 'data') lastTelemetry.set(route.serial, payload);
        for (const client of clients) {
            if (canSee(client, route.serial)) send(client, topic, payload, retain);
        }
    });

    const subscribeExtra = () => {
        mqttClient.subscribe('brewbrother/+/ota');
        mqttClient.subscribe('brewbrother/global/update');
    };
    if (mqttClient.connected) subscribeExtra();
    mqttClient.on('connect', subscribeExtra);

    app.get('/api/live', authenticateToken, async (req, res) => {
        let access;
        try {
            access = await loadAccess(req.user.id);
        } catch (err) {
            console.error('❌ [Live] Falha ao carregar aparelhos do usuario:', err);
            return res.status(500).json({ error: 'Erro interno' });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no' // nginx: nao bufferizar o stream
        });
        res.write(': ok\n\n');

        const client = { res, userId: req.user.id, isAdmin: access.isAdmin, serials: access.serials };
        clients.add(client);

        // Estado inicial: ultima telemetria conhecida de cada aparelho (marcada como retida,
        // igual ao comportamento do broker; nao conta como "online")
        for (const [serial, payload] of lastTelemetry) {
            if (canSee(client, serial)) send(client, `brewbrother/${serial}/data`, payload, true);
        }

        const heartbeat = setInterval(() => {
            try { res.write(': ping\n\n'); } catch (e) { /* ignore */ }
        }, HEARTBEAT_MS);

        req.on('close', () => {
            clearInterval(heartbeat);
            clients.delete(client);
        });
    });

    return { clients, lastTelemetry };
};
