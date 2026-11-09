import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { createMqttProvisioner, deriveMqttPassword, passwdHasUser } from '../services/mqttCredentials.js';

const KEY = 'a'.repeat(64);

test('senha derivada: deterministica, diferente da chave e igual ao calculo do firmware', () => {
    const expected = crypto.createHmac('sha256', KEY).update('breww-mqtt-v1').digest('hex');
    assert.equal(deriveMqttPassword(KEY), expected);
    assert.equal(deriveMqttPassword(KEY).length, 64);
    assert.notEqual(deriveMqttPassword(KEY), KEY);
    assert.notEqual(deriveMqttPassword(KEY), deriveMqttPassword('b'.repeat(64)));
});

test('passwdHasUser', () => {
    const content = 'esp32user:$7$abc\n288485495464:$7$def\n';
    assert.equal(passwdHasUser(content, '288485495464'), true);
    assert.equal(passwdHasUser(content, '28848549546'), false); // prefixo nao conta
});

test('sem MOSQUITTO_PASSWD_FILE o provisionador fica desligado', () => {
    assert.equal(createMqttProvisioner({ passwdFile: '' }), null);
});

test('cria credencial uma vez, corrige permissoes, recarrega o broker e serializa chamadas', async () => {
    let file = 'esp32user:$7$abc\n';
    const calls = [];
    const run = async (cmd, args) => {
        calls.push([cmd, ...args]);
        if (cmd === 'mosquitto_passwd') {
            await new Promise(r => setTimeout(r, 5));
            file += `${args[2]}:$7$hash\n`;
        }
        return { stdout: '' };
    };
    const provision = createMqttProvisioner({ passwdFile: '/etc/mosquitto/passwd', run, readFile: async () => file });

    const results = await Promise.all([provision('288485495464', KEY), provision('288485495464', KEY)]);
    assert.deepEqual(results, [true, true]);
    const passwdCalls = calls.filter(c => c[0] === 'mosquitto_passwd');
    assert.equal(passwdCalls.length, 1, 'chamadas concorrentes nao duplicam a gravacao');
    assert.deepEqual(passwdCalls[0], ['mosquitto_passwd', '-b', '/etc/mosquitto/passwd', '288485495464', deriveMqttPassword(KEY)]);
    assert.ok(calls.some(c => c[0] === 'chown' && c[1] === 'root:mosquitto'));
    assert.ok(calls.some(c => c[0] === 'systemctl' && c[1] === 'reload'));

    // force regrava (ex: chave registrada de novo)
    await provision('288485495464', KEY, { force: true });
    assert.equal(calls.filter(c => c[0] === 'mosquitto_passwd').length, 2);
});

test('falha no mosquitto_passwd nao derruba o anuncio (retorna false)', async () => {
    const provision = createMqttProvisioner({
        passwdFile: '/x',
        run: async (cmd) => { if (cmd === 'mosquitto_passwd') throw new Error('boom'); },
        readFile: async () => ''
    });
    assert.equal(await provision('AABBCCDDEEFF', KEY), false);
});
