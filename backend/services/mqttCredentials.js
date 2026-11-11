import crypto from 'crypto';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

// ============================================================================
// Credencial MQTT por aparelho
//   usuario = serial do aparelho (ex: 288485495464)
//   senha   = HMAC-SHA256(chave do aparelho, "breww-mqtt-v1") em hex
// A chave do aparelho (registrada no pareamento, so trafega por HTTPS) nunca e usada
// diretamente no MQTT; a senha derivada so da acesso aos topicos do proprio aparelho
// (ACL "pattern ... brewbrother/%u/...").
// ============================================================================

export const MQTT_PASSWORD_CONTEXT = 'breww-mqtt-v1';

export const deriveMqttPassword = (deviceKey) =>
    crypto.createHmac('sha256', String(deviceKey)).update(MQTT_PASSWORD_CONTEXT).digest('hex');

export const passwdHasUser = (content, username) =>
    String(content || '').split('\n').some(line => line.startsWith(`${username}:`));

/**
 * Cria o provisionador. Sem MOSQUITTO_PASSWD_FILE (ex: desenvolvimento local) retorna null
 * e o pareamento segue funcionando sem criar credenciais.
 */
export const createMqttProvisioner = ({
    passwdFile = process.env.MOSQUITTO_PASSWD_FILE,
    run = (cmd, args) => execFileP(cmd, args),
    readFile = (f) => fs.readFile(f, 'utf8')
} = {}) => {
    if (!passwdFile) return null;
    const provisioned = new Set();
    let queue = Promise.resolve();

    const reloadBroker = async () => {
        try {
            await run('systemctl', ['reload', 'mosquitto']);
        } catch {
            await run('pkill', ['-HUP', '-x', 'mosquitto']);
        }
    };

    /**
     * Garante a credencial do aparelho. force=true regrava a senha (ex: chave registrada agora).
     * Retorna true se a credencial existe ao final.
     */
    return (serial, deviceKey, { force = false } = {}) => {
        const task = async () => {
            if (!force && provisioned.has(serial)) return true;
            if (!force && passwdHasUser(await readFile(passwdFile), serial)) {
                provisioned.add(serial);
                return true;
            }
            await run('mosquitto_passwd', ['-b', passwdFile, serial, deriveMqttPassword(deviceKey)]);
            // mosquitto_passwd recria o arquivo: restaura dono/permissao para o broker conseguir ler
            await run('chown', ['root:mosquitto', passwdFile]).catch(() => {});
            await run('chmod', ['640', passwdFile]).catch(() => {});
            await reloadBroker();
            provisioned.add(serial);
            console.log(`🔐 [MQTT] Credencial criada para o aparelho ${serial}`);
            return true;
        };
        // Fila: mosquitto_passwd nao pode rodar em paralelo no mesmo arquivo
        const result = queue.then(task, task).catch(err => {
            console.error(`❌ [MQTT] Falha ao criar credencial de ${serial}:`, err?.message || err);
            return false;
        });
        queue = result;
        return result;
    };
};

/**
 * Remove a credencial MQTT de um serial (ex.: registro de teste ou aparelho descartado).
 * Sem MOSQUITTO_PASSWD_FILE (desenvolvimento) nao faz nada.
 */
export const removeMqttCredential = async (serial, {
    passwdFile = process.env.MOSQUITTO_PASSWD_FILE,
    run = (cmd, args) => execFileP(cmd, args),
    readFile = (f) => fs.readFile(f, 'utf8')
} = {}) => {
    if (!passwdFile) return false;
    if (!passwdHasUser(await readFile(passwdFile), serial)) return false;
    await run('mosquitto_passwd', ['-D', passwdFile, serial]);
    await run('chown', ['root:mosquitto', passwdFile]).catch(() => {});
    await run('chmod', ['640', passwdFile]).catch(() => {});
    try { await run('systemctl', ['reload', 'mosquitto']); } catch { await run('pkill', ['-HUP', '-x', 'mosquitto']).catch(() => {}); }
    console.log(`🔐 [MQTT] Credencial removida: ${serial}`);
    return true;
};
