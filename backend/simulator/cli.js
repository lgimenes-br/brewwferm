#!/usr/bin/env node
// ============================================================================
// BREWW Platform — CLI Standalone do ESP32 Virtual
// Uso: npm run simulator [SERIAL_OPCIONAL]
// Exemplo: npm run simulator ESP32-VIRTUAL-01
// ============================================================================
import mqtt from 'mqtt';
import { createVirtualEsp32Manager } from '../utils/esp32Simulator.js';

const serialArg = process.argv[2] || process.env.SIM_SERIAL || 'ESP32-VIRTUAL-01';
const brokerUrl = process.env.VITE_MQTT_BROKER || 'wss://breww.live/mqtt';

console.log(`🔌 [ESP32 Virtual CLI] Conectando ao broker ${brokerUrl} como ${serialArg}...`);

const client = mqtt.connect(brokerUrl, {
    clientId: `esp32_sim_${serialArg}_${Math.random().toString(16).slice(2, 8)}`,
    username: process.env.MQTT_USER || 'esp32user',
    password: process.env.MQTT_PASSWORD || 'esp32',
    reconnectPeriod: 5000
});

const sim = createVirtualEsp32Manager(client);
sim.updateSimulatorState({ serial: serialArg, enabled: false });

client.on('connect', () => {
    const s = sim.getState().serial;
    console.log(`✅ [ESP32 Virtual CLI] Online! Serial: ${s}`);
    console.log(`📡 Escutando comandos em brewbrother/${s}/comando e publicando em brewbrother/${s}/data a cada 3s.`);
    client.subscribe(`brewbrother/${s}/comando`);
    client.subscribe(`brewbrother/${s}/command`);
    client.subscribe('brewbrother/global/ping');
    sim.startLoop();
});

client.on('message', (topic, message, packet) => {
    if (packet && packet.retain) return;
    try {
        const payload = JSON.parse(message.toString());
        const s = sim.getState().serial;
        if (topic === 'brewbrother/global/ping') {
            sim.publishTelemetry();
            return;
        }
        console.log(`📥 [Comando Recebido no ESP32 ${s}]`, payload);
        sim.handleIncomingCommand(s, payload);
    } catch (e) {}
});

process.on('SIGINT', () => {
    console.log('\n🛑 Desligando ESP32 Virtual CLI...');
    sim.stopLoop();
    client.end(true);
    process.exit(0);
});
