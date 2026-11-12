// Registro em memoria dos aparelhos que falam por MQTT.
// Cada controlador manda telemetria a cada ~3 s; sem isto, cada pacote custava
// um SELECT (serial -> id) e um UPDATE de last_seen no banco.
// - serial -> id fica em cache (expira; e limpo ao parear/remover/editar aparelho)
// - o ultimo contato exato fica em memoria; o banco recebe last_seen no maximo 1x/min
// - firmware_version so e gravada quando muda

const CACHE_TTL_MS = 5 * 60 * 1000;      // serial -> id conhecido
const NEGATIVE_TTL_MS = 30 * 1000;       // serial ainda sem cadastro (descoberta/pareamento)
export const LAST_SEEN_FLUSH_MS = 60 * 1000;

const norm = (serial) => String(serial ?? '').trim().toUpperCase();

export function createDeviceRegistry({ now = Date.now } = {}) {
  const ids = new Map();       // serial -> { id, at }
  const seen = new Map();      // serial -> { ms, flushedAt, fw }

  /** id do aparelho pelo serial (null se nao cadastrado). Erro de banco -> null sem cachear. */
  async function lookup(pool, serial) {
    const key = norm(serial);
    if (!key) return null;
    const t = now();
    const hit = ids.get(key);
    if (hit && t - hit.at < (hit.id ? CACHE_TTL_MS : NEGATIVE_TTL_MS)) return hit.id;
    try {
      const [rows] = await pool.execute('SELECT id FROM devices WHERE serial_code = ?', [key]);
      const id = rows.length > 0 ? rows[0].id : null;
      ids.set(key, { id, at: t });
      return id;
    } catch {
      return hit ? hit.id : null;
    }
  }

  /**
   * Registra contato. Grava last_seen no banco no maximo 1x por LAST_SEEN_FLUSH_MS; firmware, placa e
   * hardware detectado (frota no admin) so quando mudam. info = { board, mods } (telemetria).
   */
  async function touch(pool, serial, deviceId, fw, info = {}) {
    const key = norm(serial);
    const t = now();
    const s = seen.get(key) || { ms: 0, flushedAt: 0, fw: undefined, board: undefined, mods: undefined };
    s.ms = t;
    const writes = [];
    if (t - s.flushedAt >= LAST_SEEN_FLUSH_MS) {
      s.flushedAt = t;
      writes.push(pool.execute('UPDATE devices SET last_seen = NOW() WHERE id = ?', [deviceId]).catch(() => {}));
    }
    if (fw && fw !== s.fw) {
      s.fw = fw;
      writes.push(pool.execute('UPDATE devices SET firmware_version = ? WHERE id = ?', [fw, deviceId]).catch(() => { s.fw = undefined; }));
    }
    const board = typeof info.board === 'string' ? info.board.slice(0, 32) : null;
    if (board && board !== s.board) {
      s.board = board;
      writes.push(pool.execute('UPDATE devices SET board = ? WHERE id = ?', [board, deviceId]).catch(() => { s.board = undefined; }));
    }
    const mods = Array.isArray(info.mods) ? JSON.stringify(info.mods.map(String).slice(0, 12)).slice(0, 255) : null;
    if (mods && mods !== s.mods) {
      s.mods = mods;
      writes.push(pool.execute('UPDATE devices SET hw_modules = ? WHERE id = ?', [mods, deviceId]).catch(() => { s.mods = undefined; }));
    }
    seen.set(key, s);
    await Promise.all(writes);
  }

  /** Ultimo contato em memoria (ms) ou undefined (ex.: logo apos reiniciar o servidor). */
  const lastSeenMs = (serial) => seen.get(norm(serial))?.ms;

  /** Online pelo contato em memoria; sem memoria, cai no valor calculado pelo banco. */
  function isOnline(serial, windowMs, dbOnline) {
    const ms = lastSeenMs(serial);
    if (ms) return now() - ms < windowMs;
    return Boolean(dbOnline);
  }

  /** Esquece o serial (pareou, removeu ou editou o aparelho). */
  function invalidate(serial) {
    const key = norm(serial);
    ids.delete(key);
    seen.delete(key);
  }

  return { lookup, touch, lastSeenMs, isOnline, invalidate };
}

export const deviceRegistry = createDeviceRegistry();
