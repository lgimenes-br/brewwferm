import crypto from 'crypto';

// ============================================================================
// Pareamento seguro de aparelhos
//
// 1. Descoberta por rede: cada placa se anuncia por HTTPS (POST /api/device/announce).
//    O backend guarda o IP PUBLICO de onde veio o anuncio, e o "Buscar na Rede" so
//    lista aparelhos com o mesmo IP publico de quem esta buscando (mesma casa/Wi-Fi).
//
// 2. Confirmacao fisica: vincular um aparelho cria um pedido pendente; o cadastro so
//    acontece quando alguem toca em "Confirmar" na tela do proprio aparelho.
//
// Autenticacao das placas: cada placa gera uma chave secreta aleatoria (256 bits) e a
// registra no primeiro contato (trust-on-first-use). Daqui pra frente so quem tem a chave
// fala por aquele serial. Nao usamos MQTT para a confirmacao porque as credenciais do
// broker sao compartilhadas com o navegador (qualquer um poderia forjar a resposta).
// ============================================================================

export const PAIRING_TTL_MS = 2 * 60 * 1000;
export const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const KEY_RE = /^[0-9a-f]{64}$/;
const SERIAL_RE = /^[0-9A-Z_-]{4,64}$/;

export const normalizeIp = (ip) => String(ip || '').trim().replace(/^::ffff:/i, '');
export const normalizeSerial = (serial) => String(serial || '').trim().toUpperCase();
export const isValidSerial = (serial) => SERIAL_RE.test(serial);
export const isValidDeviceKey = (key) => KEY_RE.test(String(key || ''));
export const hashDeviceKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');

export const maskEmail = (email) => {
    const [user, domain] = String(email || '').split('@');
    if (!user || !domain) return '';
    const visible = user.slice(0, Math.min(2, user.length));
    return `${visible}${'*'.repeat(Math.max(1, Math.min(user.length - visible.length, 6)))}@${domain}`;
};

const safeEqualHex = (a, b) => {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
};

/** Estado em memoria (anuncios recentes e pedidos de pareamento). */
export const createPairingStore = (now = () => Date.now()) => {
    const announced = new Map(); // serial -> { publicIp, localIp, lastSeen }
    const pairings = new Map();  // pairingId -> pairing
    const pendingBySerial = new Map(); // serial -> pairingId

    const expireIfNeeded = (p) => {
        if (p && p.status === 'pending' && now() > p.expiresAt) p.status = 'expired';
        return p;
    };

    const cleanup = () => {
        const t = now();
        for (const [serial, a] of announced) if (t - a.lastSeen > DISCOVERY_TTL_MS) announced.delete(serial);
        for (const [id, p] of pairings) if (t - p.expiresAt > 10 * 60 * 1000) pairings.delete(id);
    };

    return {
        announce(serial, publicIp, localIp) {
            announced.set(serial, { publicIp: normalizeIp(publicIp), localIp: localIp || null, lastSeen: now() });
        },
        /** Seriais anunciados recentemente a partir do mesmo IP publico */
        discover(publicIp) {
            cleanup();
            const ip = normalizeIp(publicIp);
            if (!ip) return [];
            const t = now();
            return [...announced.entries()]
                .filter(([, a]) => a.publicIp === ip && t - a.lastSeen <= DISCOVERY_TTL_MS)
                .map(([serial, a]) => ({ serial, localIp: a.localIp, lastSeen: a.lastSeen }));
        },
        create({ serial, userId, email, deviceName }) {
            cleanup();
            const previousId = pendingBySerial.get(serial);
            const previous = previousId && pairings.get(previousId);
            if (previous && previous.status === 'pending') previous.status = 'superseded';
            const pairing = {
                id: crypto.randomBytes(16).toString('hex'),
                serial,
                userId,
                email: email || '',
                deviceName: deviceName || null,
                status: 'pending',
                createdAt: now(),
                expiresAt: now() + PAIRING_TTL_MS
            };
            pairings.set(pairing.id, pairing);
            pendingBySerial.set(serial, pairing.id);
            return pairing;
        },
        get(id) {
            return expireIfNeeded(pairings.get(String(id || '')));
        },
        pendingForSerial(serial) {
            const p = expireIfNeeded(pairings.get(pendingBySerial.get(serial)));
            return p && p.status === 'pending' ? p : null;
        },
        resolve(id, status) {
            const p = pairings.get(id);
            if (p) p.status = status;
            if (p && pendingBySerial.get(p.serial) === id) pendingBySerial.delete(p.serial);
            return p;
        }
    };
};

/**
 * Verifica a chave da placa. Primeiro contato registra a chave (TOFU).
 * Retorna 'ok' | 'registered' | 'mismatch'.
 */
export const verifyDeviceKey = async (pool, serial, key) => {
    const keyHash = hashDeviceKey(key);
    const [rows] = await pool.execute('SELECT key_hash FROM device_keys WHERE serial_code = ? LIMIT 1', [serial]);
    if (rows.length === 0) {
        await pool.execute('INSERT IGNORE INTO device_keys (serial_code, key_hash, created_at) VALUES (?, ?, NOW())', [serial, keyHash]);
        const [again] = await pool.execute('SELECT key_hash FROM device_keys WHERE serial_code = ? LIMIT 1', [serial]);
        return again.length && safeEqualHex(again[0].key_hash, keyHash) ? 'registered' : 'mismatch';
    }
    return safeEqualHex(rows[0].key_hash, keyHash) ? 'ok' : 'mismatch';
};

// Limite simples por IP para os endpoints das placas
const deviceHitsByIp = new Map();
const deviceRateLimiter = (req, res, next) => {
    const ip = normalizeIp(req.ip) || 'unknown';
    const t = Date.now();
    const entry = deviceHitsByIp.get(ip);
    if (!entry || t - entry.start > 15 * 60 * 1000) {
        deviceHitsByIp.set(ip, { count: 1, start: t });
        return next();
    }
    entry.count += 1;
    if (entry.count > 300) return res.status(429).json({ error: 'rate_limited' });
    next();
};

export const registerPairingRoutes = (app, { pool, mqttClient, authenticateToken, notifyUpdate, store = createPairingStore(), provisionMqtt = null }) => {
    const readDeviceAuth = async (req, res) => {
        const serial = normalizeSerial(req.body?.serial);
        const key = String(req.body?.key || '').toLowerCase();
        if (!isValidSerial(serial) || !isValidDeviceKey(key)) {
            res.status(400).json({ error: 'invalid_device_credentials' });
            return null;
        }
        const result = await verifyDeviceKey(pool, serial, key);
        if (result === 'mismatch') {
            console.warn(`⚠️ [Pairing] Chave invalida para o aparelho ${serial} (IP ${normalizeIp(req.ip)})`);
            res.status(403).json({ error: 'device_key_mismatch' });
            return null;
        }
        if (result === 'registered') console.log(`🔑 [Pairing] Chave registrada para o aparelho ${serial}`);
        return { serial, key, result };
    };

    const isClaimed = async (serial) => {
        const [rows] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? LIMIT 1', [serial]);
        return rows.length > 0;
    };

    // --- Placa: anuncio periodico (descoberta + entrega de pedido de pareamento pendente) ---
    app.post('/api/device/announce', deviceRateLimiter, async (req, res) => {
        try {
            const auth = await readDeviceAuth(req, res);
            if (!auth) return;
            const { serial } = auth;
            // Credencial MQTT propria do aparelho (usuario = serial, senha derivada da chave)
            const mqttReady = provisionMqtt
                ? await provisionMqtt(serial, auth.key, { force: auth.result === 'registered' })
                : false;
            const publicIp = normalizeIp(req.ip);
            const localIp = typeof req.body?.localIp === 'string' ? req.body.localIp.slice(0, 45) : null;
            store.announce(serial, publicIp, localIp);
            await pool.execute('UPDATE device_keys SET last_public_ip = ?, last_seen = NOW() WHERE serial_code = ?', [publicIp, serial]);

            const pending = store.pendingForSerial(serial);
            res.json({
                ok: true,
                mqtt: mqttReady,
                claimed: await isClaimed(serial),
                pairing: pending ? {
                    id: pending.id,
                    email: maskEmail(pending.email),
                    deviceName: pending.deviceName,
                    expiresIn: Math.max(0, Math.round((pending.expiresAt - Date.now()) / 1000))
                } : null
            });
        } catch (err) {
            console.error('❌ [Pairing] announce:', err);
            res.status(500).json({ error: 'internal_error' });
        }
    });

    // --- Placa: resposta do usuario na tela (Confirmar / Recusar) ---
    app.post('/api/device/pairing/respond', deviceRateLimiter, async (req, res) => {
        try {
            const auth = await readDeviceAuth(req, res);
            if (!auth) return;
            const { serial } = auth;
            const pairing = store.get(req.body?.pairingId);
            if (!pairing || pairing.serial !== serial) return res.status(404).json({ status: 'not_found' });
            if (pairing.status !== 'pending') return res.status(410).json({ status: pairing.status });

            if (req.body?.accept !== true) {
                store.resolve(pairing.id, 'rejected');
                return res.json({ status: 'rejected' });
            }

            if (await isClaimed(serial)) {
                store.resolve(pairing.id, 'conflict');
                return res.status(409).json({ status: 'conflict' });
            }
            const [userRows] = await pool.execute('SELECT max_devices FROM users WHERE id = ?', [pairing.userId]);
            const maxDevices = userRows[0]?.max_devices ?? 1;
            const [[{ count }]] = await pool.execute('SELECT COUNT(*) as count FROM devices WHERE user_id = ?', [pairing.userId]);
            if (!userRows.length || count >= maxDevices) {
                store.resolve(pairing.id, 'limit');
                return res.status(403).json({ status: 'limit' });
            }

            await pool.execute(
                'INSERT INTO devices (serial_code, user_id, device_name, created_at) VALUES (?, ?, ?, NOW())',
                [serial, pairing.userId, pairing.deviceName]
            );
            await pool.execute(
                'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                [pairing.userId, 'CREATE_DEVICE', `Device: ${serial} (confirmado no aparelho)`, normalizeIp(req.ip) || null]
            );
            store.resolve(pairing.id, 'confirmed');
            notifyUpdate();
            console.log(`✅ [Pairing] ${serial} vinculado ao usuario ${pairing.userId}`);
            res.json({ status: 'confirmed' });
        } catch (err) {
            if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ status: 'conflict' });
            console.error('❌ [Pairing] respond:', err);
            res.status(500).json({ error: 'internal_error' });
        }
    });

    // --- Usuario: pedir vinculo (cria pedido pendente e avisa a placa) ---
    app.post('/api/devices', authenticateToken, async (req, res) => {
        try {
            const [userRows] = await pool.execute('SELECT email, max_devices FROM users WHERE id = ?', [req.user.id]);
            if (userRows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
            const maxDevices = userRows[0].max_devices ?? 1;
            const [[{ count }]] = await pool.execute('SELECT COUNT(*) as count FROM devices WHERE user_id = ?', [req.user.id]);
            if (count >= maxDevices) {
                return res.status(403).json({ error: 'Limite de equipamentos atingido. Atualize seu plano.' });
            }

            const serial = normalizeSerial(req.body?.serialCode);
            if (!serial) return res.status(400).json({ error: 'Código serial é obrigatório' });
            if (!isValidSerial(serial)) return res.status(400).json({ error: 'Código inválido. Use o código de 12 caracteres da tela do aparelho.' });
            if (await isClaimed(serial)) {
                return res.status(409).json({ error: 'Este código serial já está vinculado a uma conta.' });
            }
            const [keyRows] = await pool.execute('SELECT serial_code FROM device_keys WHERE serial_code = ? LIMIT 1', [serial]);
            if (keyRows.length === 0) {
                return res.status(422).json({ error: 'Este aparelho ainda não se conectou ao servidor. Confira o código, se ele está ligado e com Wi-Fi, e se o firmware está atualizado.' });
            }

            const deviceName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) || null : null;
            const pairing = store.create({ serial, userId: req.user.id, email: userRows[0].email, deviceName });

            // Apenas um "acorde": a placa busca os detalhes pelo canal autenticado (HTTPS)
            const msg = JSON.stringify({ cmd: 'pair_request', type: 'pair_request' });
            mqttClient.publish(`brewbrother/${serial}/command`, msg);
            mqttClient.publish(`brewbrother/${serial}/comando`, msg);

            res.status(202).json({
                status: 'pending',
                pairingId: pairing.id,
                expiresIn: Math.round(PAIRING_TTL_MS / 1000)
            });
        } catch (err) {
            console.error('❌ [Pairing] create:', err);
            res.status(500).json({ error: 'Erro interno' });
        }
    });

    // --- Usuario: acompanhar o pedido ---
    app.get('/api/devices/pairing/:id', authenticateToken, (req, res) => {
        const pairing = store.get(req.params.id);
        if (!pairing || pairing.userId !== req.user.id) return res.status(404).json({ error: 'Pedido não encontrado' });
        res.json({
            status: pairing.status,
            serial: pairing.serial,
            expiresIn: Math.max(0, Math.round((pairing.expiresAt - Date.now()) / 1000))
        });
    });

    // --- Usuario: "Buscar na Rede" = aparelhos sem dono anunciados do mesmo IP publico ---
    app.get('/api/discovery', authenticateToken, async (req, res) => {
        try {
            const found = store.discover(req.ip);
            if (found.length === 0) return res.json([]);
            const placeholders = found.map(() => '?').join(',');
            const [claimedRows] = await pool.execute(
                `SELECT serial_code FROM devices WHERE serial_code IN (${placeholders})`,
                found.map(f => f.serial)
            );
            const claimed = new Set(claimedRows.map(r => String(r.serial_code).toUpperCase()));
            res.json(found
                .filter(f => !claimed.has(f.serial))
                .map(f => ({ ip: f.serial, type: 'Breww', rssi: -60, localIp: f.localIp })));
        } catch (err) {
            console.error('❌ [Pairing] discovery:', err);
            res.status(500).json({ error: 'Erro interno no servidor' });
        }
    });

    return store;
};
