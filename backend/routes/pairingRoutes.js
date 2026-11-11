import crypto from 'crypto';
import { deviceRegistry } from '../services/deviceRegistry.js';

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
// Autenticacao das placas: cada placa gera uma chave secreta aleatoria (256 bits).
// A chave so passa a valer para aquele serial (e so entao ganha credencial MQTT) quando o
// dono confirma o vinculo no proprio aparelho. Antes disso ela e apenas CANDIDATA: o serial
// (MAC) e publico, entao "primeiro que chegar registra" deixaria alguem sequestrar o aparelho
// de outra pessoa.
//
// Codigo de confirmacao: HMAC-SHA256(chave, "breww-pair-v1") -> 8 caracteres. A placa mostra
// esse codigo (tela/QR/instalador); quem pede o vinculo informa serial + codigo, e so a chave
// candidata que gera aquele codigo recebe o pedido. Um impostor nao tem a chave certa.
//
// Transicao (firmware que ainda nao mostra o codigo): sem codigo, o pedido so e aceito se
// houver UMA unica chave candidata para o serial. Desligar com ALLOW_LEGACY_PAIRING=0 no
// lancamento publico.
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
export const PAIR_CODE_CONTEXT = 'breww-pair-v1';
const PAIR_CODE_RE = /^[0-9A-F]{8}$/;
/** Codigo de confirmacao que a placa mostra: 8 primeiros hex (maiusculos) do HMAC da chave */
export const derivePairCode = (key) =>
    crypto.createHmac('sha256', String(key)).update(PAIR_CODE_CONTEXT).digest('hex').slice(0, 8).toUpperCase();
export const normalizePairCode = (code) => String(code || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
/** Chaves candidatas guardadas por serial (protege contra enxurrada de chaves falsas) */
export const MAX_KEY_CANDIDATES = 5;
export const allowLegacyPairing = () => process.env.ALLOW_LEGACY_PAIRING !== '0';

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
        create({ serial, userId, email, deviceName, keyHash, mode = 'new' }) {
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
                keyHash: keyHash || null, // chave que pode confirmar (null = qualquer chave valida do serial)
                mode,                     // 'new' | 'rekey' | 'bound'
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
        /** Pedido pendente para o serial, so para a placa com a chave do pedido */
        pendingForSerial(serial, keyHash) {
            const p = expireIfNeeded(pairings.get(pendingBySerial.get(serial)));
            if (!p || p.status !== 'pending') return null;
            if (keyHash && p.keyHash && p.keyHash !== keyHash) return null;
            return p;
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
 * Verifica a chave da placa.
 *   'ok'        -> chave vinculada ao serial (pareamento confirmado)
 *   'mismatch'  -> serial ja tem outra chave vinculada
 *   'candidate' -> serial sem chave vinculada: a chave fica como candidata (sem MQTT)
 *   'too_many'  -> serial com candidatas demais (possivel ataque)
 */
export const verifyDeviceKey = async (pool, serial, key, publicIp = null) => {
    const keyHash = hashDeviceKey(key);
    const [rows] = await pool.execute('SELECT key_hash FROM device_keys WHERE serial_code = ? LIMIT 1', [serial]);
    const bound = rows.length > 0;
    if (bound && safeEqualHex(rows[0].key_hash, keyHash)) return 'ok';

    // Chave nova: vira candidata. Num serial ja vinculado (aparelho resetado), so serve para o
    // dono trocar a chave informando o codigo novo; ate la a placa continua recusada.
    const [cands] = await pool.execute('SELECT key_hash FROM device_key_candidates WHERE serial_code = ?', [serial]);
    if (!cands.some(c => safeEqualHex(c.key_hash, keyHash))) {
        if (cands.length >= MAX_KEY_CANDIDATES) return 'too_many';
        await pool.execute(
            'INSERT IGNORE INTO device_key_candidates (serial_code, key_hash, pair_code, last_public_ip, first_seen, last_seen) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [serial, keyHash, derivePairCode(key), publicIp]
        );
    } else {
        await pool.execute('UPDATE device_key_candidates SET last_seen = NOW(), last_public_ip = ? WHERE serial_code = ? AND key_hash = ?', [publicIp, serial, keyHash]);
    }
    return bound ? 'mismatch' : 'candidate';
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
        let result = await verifyDeviceKey(pool, serial, key, normalizeIp(req.ip) || null);
        // Troca de chave pedida pelo dono para esta chave: a placa pode receber e confirmar o pedido
        if (result === 'mismatch' && store.pendingForSerial(serial, hashDeviceKey(key))?.mode === 'rekey') result = 'candidate';
        if (result === 'mismatch') {
            console.warn(`⚠️ [Pairing] Chave invalida para o aparelho ${serial} (IP ${normalizeIp(req.ip)})`);
            res.status(403).json({ error: 'device_key_mismatch' });
            return null;
        }
        if (result === 'too_many') {
            console.warn(`⚠️ [Pairing] Chaves candidatas demais para ${serial} (IP ${normalizeIp(req.ip)})`);
            res.status(429).json({ error: 'too_many_keys' });
            return null;
        }
        return { serial, key, keyHash: hashDeviceKey(key), result };
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
            // Credencial MQTT so para chave vinculada (pareamento confirmado)
            const mqttReady = auth.result === 'ok' && provisionMqtt
                ? await provisionMqtt(serial, auth.key)
                : false;
            const publicIp = normalizeIp(req.ip);
            const localIp = typeof req.body?.localIp === 'string' ? req.body.localIp.slice(0, 45) : null;
            store.announce(serial, publicIp, localIp);
            if (auth.result === 'ok') await pool.execute('UPDATE device_keys SET last_public_ip = ?, last_seen = NOW() WHERE serial_code = ?', [publicIp, serial]);

            const pending = store.pendingForSerial(serial, auth.keyHash);
            res.json({
                ok: true,
                mqtt: mqttReady,
                bound: auth.result === 'ok',
                // Codigo de confirmacao para a tela/QR (a placa tambem calcula sozinha)
                pairCode: derivePairCode(auth.key),
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
            // So a placa com a chave do pedido pode responder (impede que outra chave do mesmo serial confirme)
            if (pairing.keyHash && !safeEqualHex(pairing.keyHash, auth.keyHash)) return res.status(403).json({ status: 'wrong_device' });
            if (pairing.status !== 'pending') return res.status(410).json({ status: pairing.status });

            if (req.body?.accept !== true) {
                store.resolve(pairing.id, 'rejected');
                return res.json({ status: 'rejected' });
            }

            // Dono trocando a chave (aparelho resetado): passa a valer a chave nova
            if (pairing.mode === 'rekey') {
                await pool.execute('UPDATE device_keys SET key_hash = ?, last_seen = NOW() WHERE serial_code = ?', [auth.keyHash, serial]);
                await pool.execute('DELETE FROM device_key_candidates WHERE serial_code = ?', [serial]);
                if (provisionMqtt) await provisionMqtt(serial, auth.key, { force: true });
                await pool.execute(
                    'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                    [pairing.userId, 'REKEY_DEVICE', `Device: ${serial} (nova chave confirmada no aparelho)`, normalizeIp(req.ip) || null]
                );
                store.resolve(pairing.id, 'confirmed');
                notifyUpdate();
                console.log(`🔑 [Pairing] ${serial}: chave trocada pelo dono ${pairing.userId}`);
                return res.json({ status: 'confirmed' });
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

            // Vincula a chave (se ainda era candidata) e cria a credencial MQTT
            if (auth.result === 'candidate') {
                await pool.execute('INSERT IGNORE INTO device_keys (serial_code, key_hash, created_at) VALUES (?, ?, NOW())', [serial, auth.keyHash]);
                const [bound] = await pool.execute('SELECT key_hash FROM device_keys WHERE serial_code = ? LIMIT 1', [serial]);
                if (!bound.length || !safeEqualHex(bound[0].key_hash, auth.keyHash)) {
                    store.resolve(pairing.id, 'conflict');
                    return res.status(409).json({ status: 'conflict' });
                }
                await pool.execute('DELETE FROM device_key_candidates WHERE serial_code = ?', [serial]);
            }
            if (provisionMqtt) await provisionMqtt(serial, auth.key, { force: true });
            await pool.execute(
                'INSERT INTO devices (serial_code, user_id, device_name, created_at) VALUES (?, ?, ?, NOW())',
                [serial, pairing.userId, pairing.deviceName]
            );
            deviceRegistry.invalidate(serial); // estava em cache como 'sem cadastro'
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

            const serial = normalizeSerial(req.body?.serialCode);
            if (!serial) return res.status(400).json({ error: 'Código serial é obrigatório' });
            if (!isValidSerial(serial)) return res.status(400).json({ error: 'Código inválido. Use o código de 12 caracteres da tela do aparelho.' });
            const pairCode = normalizePairCode(req.body?.pairCode);
            if (pairCode && !PAIR_CODE_RE.test(pairCode)) return res.status(400).json({ error: 'Código de confirmação inválido (8 caracteres).' });

            // Ja vinculado: so o proprio dono, com o codigo novo, pode trocar a chave (aparelho resetado)
            const [ownerRows] = await pool.execute('SELECT user_id FROM devices WHERE serial_code = ? LIMIT 1', [serial]);
            let mode = 'new';
            if (ownerRows.length) {
                if (Number(ownerRows[0].user_id) !== Number(req.user.id) || !pairCode) {
                    return res.status(409).json({ error: 'Este código serial já está vinculado a uma conta.' });
                }
                mode = 'rekey';
            } else if (count >= maxDevices) {
                return res.status(403).json({ error: 'Limite de equipamentos atingido. Atualize seu plano.' });
            }

            // Qual chave pode confirmar este pedido
            let keyHash = null;
            const [cands] = await pool.execute('SELECT key_hash, pair_code FROM device_key_candidates WHERE serial_code = ?', [serial]);
            const [boundRows] = await pool.execute('SELECT key_hash FROM device_keys WHERE serial_code = ? LIMIT 1', [serial]);
            if (pairCode) {
                const match = cands.find(c => c.pair_code === pairCode);
                if (!match) {
                    return res.status(422).json({ error: 'O código de confirmação não confere. Confira o código mostrado no aparelho e se ele está ligado e com Wi-Fi.' });
                }
                keyHash = match.key_hash;
            } else if (mode === 'new' && boundRows.length) {
                keyHash = boundRows[0].key_hash; // chave vinculada antes desta mudanca (aparelho antigo)
                mode = 'bound';
            } else if (mode === 'new' && allowLegacyPairing() && cands.length === 1) {
                keyHash = cands[0].key_hash; // firmware sem codigo na tela: so com uma unica candidata
            } else if (cands.length === 0 && !boundRows.length) {
                return res.status(422).json({ error: 'Este aparelho ainda não se conectou ao servidor. Confira o código, se ele está ligado e com Wi-Fi, e se o firmware está atualizado.' });
            } else {
                return res.status(422).json({ error: 'Informe o código de confirmação mostrado na tela do aparelho.', needsPairCode: true });
            }

            const deviceName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) || null : null;
            const pairing = store.create({ serial, userId: req.user.id, email: userRows[0].email, deviceName, keyHash, mode });

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
