import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleTelegramUpdate, sendTelegramToUser } from '../services/telegram.js';

const TOKEN = 'a'.repeat(32);

// Banco falso: usuarios e links em memoria, entende so as consultas do modulo
const fakePool = () => {
    const users = [{ id: 1, name: 'Ana', telegram_chat_id: null }, { id: 2, name: 'Bia', telegram_chat_id: '555' }];
    const links = [];
    return {
        users, links,
        execute: async (sql, p = []) => {
            if (sql.startsWith('SELECT l.user_id')) {
                const l = links.find((x) => x.token === p[0] && x.expires > Date.now());
                return [l ? [{ user_id: l.user_id, name: users.find((u) => u.id === l.user_id).name }] : []];
            }
            if (sql.startsWith('DELETE FROM telegram_links')) {
                for (let i = links.length - 1; i >= 0; i--) if (links[i].token === p[0] || links[i].expires < Date.now()) links.splice(i, 1);
                return [{}];
            }
            if (sql.startsWith('UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id')) {
                let n = 0;
                for (const u of users) if (u.telegram_chat_id === p[0]) { u.telegram_chat_id = null; n++; }
                return [{ affectedRows: n }];
            }
            if (sql.startsWith('UPDATE users SET telegram_chat_id = NULL WHERE id')) {
                const u = users.find((x) => x.id === p[0] && x.telegram_chat_id === p[1]);
                if (u) u.telegram_chat_id = null;
                return [{}];
            }
            if (sql.startsWith('UPDATE users SET telegram_chat_id = ?')) {
                users.find((x) => x.id === p[1]).telegram_chat_id = p[0];
                return [{}];
            }
            if (sql.startsWith('SELECT telegram_chat_id')) {
                const u = users.find((x) => x.id === p[0]);
                return [[{ telegram_chat_id: u?.telegram_chat_id ?? null }]];
            }
            throw new Error('consulta inesperada: ' + sql);
        },
    };
};

let sent;
let reply;
const realFetch = globalThis.fetch;
beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = '123:abc';
    process.env.TELEGRAM_BOT_USERNAME = 'BrewwBot';
    sent = [];
    reply = { status: 200, body: { ok: true } };
    globalThis.fetch = async (url, opts) => {
        sent.push({ url, body: JSON.parse(opts.body) });
        return { status: reply.status, json: async () => reply.body };
    };
});
afterEach(() => { globalThis.fetch = realFetch; });

const msg = (text, chatId = 777, type = 'private') => ({ message: { chat: { id: chatId, type }, text } });

test('/start com codigo valido liga o chat a conta e responde', async () => {
    const pool = fakePool();
    pool.links.push({ token: TOKEN, user_id: 1, expires: Date.now() + 60000 });
    await handleTelegramUpdate(pool, msg(`/start ${TOKEN}`));
    assert.equal(pool.users[0].telegram_chat_id, '777');
    assert.equal(pool.links.length, 0, 'link e de uso unico');
    assert.match(sent[0].body.text, /Pronto, Ana/);
});

test('codigo expirado ou repetido nao liga nada', async () => {
    const pool = fakePool();
    pool.links.push({ token: TOKEN, user_id: 1, expires: Date.now() - 1000 });
    await handleTelegramUpdate(pool, msg(`/start ${TOKEN}`));
    assert.equal(pool.users[0].telegram_chat_id, null);
    assert.match(sent[0].body.text, /expirou/);
});

test('o mesmo chat passa para a ultima conta vinculada', async () => {
    const pool = fakePool();
    pool.links.push({ token: TOKEN, user_id: 1, expires: Date.now() + 60000 });
    await handleTelegramUpdate(pool, msg(`/start ${TOKEN}`, 555));
    assert.equal(pool.users[0].telegram_chat_id, '555');
    assert.equal(pool.users[1].telegram_chat_id, null);
});

test('/parar desliga; grupos sao ignorados', async () => {
    const pool = fakePool();
    await handleTelegramUpdate(pool, msg('/parar', 555, 'group'));
    assert.equal(pool.users[1].telegram_chat_id, '555');
    assert.equal(sent.length, 0);
    await handleTelegramUpdate(pool, msg('/parar', 555));
    assert.equal(pool.users[1].telegram_chat_id, null);
    assert.match(sent[0].body.text, /Desconectado/);
});

test('envio vai para o chat ligado, com HTML escapado', async () => {
    const pool = fakePool();
    assert.equal(await sendTelegramToUser(pool, 2, 'Alerta <x>', 'temp & alvo'), true);
    assert.equal(sent[0].body.chat_id, '555');
    assert.equal(sent[0].body.text, '🍺 <b>Alerta &lt;x&gt;</b>\ntemp &amp; alvo');
    assert.equal(await sendTelegramToUser(pool, 1, 't', 'b'), false, 'sem chat ligado, nao envia');
    assert.equal(sent.length, 1);
});

test('chat que bloqueou o bot e desligado', async () => {
    const pool = fakePool();
    reply = { status: 403, body: { ok: false, description: 'Forbidden: bot was blocked by the user' } };
    assert.equal(await sendTelegramToUser(pool, 2, 't', 'b'), false);
    assert.equal(pool.users[1].telegram_chat_id, null);
});
