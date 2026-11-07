// ============================================================================
// BREWW Platform — Rotas de Controle da Bancada do ESP32 Virtual
// ============================================================================

export const registerSimulatorRoutes = (app, pool, authenticateToken, virtualEsp32, notifyUpdate) => {
    app.get('/api/simulator/status', authenticateToken, (req, res) => {
        try {
            res.json(virtualEsp32.getState());
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro ao obter estado do simulador ESP32' });
        }
    });

    app.post('/api/simulator/update', authenticateToken, (req, res) => {
        try {
            const updated = virtualEsp32.updateSimulatorState(req.body || {});
            res.json(updated);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro ao atualizar simulador ESP32' });
        }
    });

    app.post('/api/simulator/device-action', authenticateToken, (req, res) => {
        try {
            const updated = virtualEsp32.triggerPhysicalDeviceAction(req.body || {});
            res.json(updated);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro ao disparar ação física simulada' });
        }
    });

    app.post('/api/simulator/clear-log', authenticateToken, (req, res) => {
        try {
            const updated = virtualEsp32.clearCommandLog();
            res.json(updated);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro ao limpar log de comandos do simulador' });
        }
    });

    // Atalho opcional para vincular (ou desvincular p/ testar Discovery) o ESP32 Virtual na conta logada
    app.post('/api/simulator/link-device', authenticateToken, async (req, res) => {
        try {
            const state = virtualEsp32.getState();
            const serialCode = String(req.body?.serial || state.serial || 'ESP32-VIRTUAL-01').trim().toUpperCase();
            const unlink = Boolean(req.body?.unlink);

            if (unlink) {
                virtualEsp32.updateSimulatorState({ unlinkedForDiscovery: true, enabled: true });
                const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [serialCode, req.user.id]);
                if (devs.length > 0) {
                    await pool.execute('DELETE FROM telemetry WHERE device_id = ?', [devs[0].id]);
                    await pool.execute('DELETE FROM batches WHERE device_id = ?', [devs[0].id]);
                    await pool.execute('DELETE FROM devices WHERE id = ?', [devs[0].id]);
                }
                if (notifyUpdate) notifyUpdate(serialCode);
                return res.json({ linked: false, serial: serialCode, message: 'ESP32 Virtual desvinculado! Agora ele aparecerá em "Procurar" (Discovery).' });
            }

            virtualEsp32.updateSimulatorState({ unlinkedForDiscovery: false, enabled: true, serial: serialCode });
            const freshState = virtualEsp32.getState();

            let deviceId;
            const [existing] = await pool.execute('SELECT id, user_id FROM devices WHERE serial_code = ? LIMIT 1', [serialCode]);
            if (existing.length > 0) {
                deviceId = existing[0].id;
                await pool.execute('UPDATE devices SET user_id = ?, firmware_version = ?, last_seen = NOW() WHERE id = ?', [req.user.id, freshState.ver || 'V2.5.0-VIRTUAL', deviceId]);
            } else {
                const [ins] = await pool.execute(
                    'INSERT INTO devices (serial_code, user_id, device_name, firmware_version, last_seen, created_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                    [serialCode, req.user.id, 'ESP32 Virtual', freshState.ver || 'V2.5.0-VIRTUAL']
                );
                deviceId = ins.insertId;
            }

            if (deviceId) {
                await pool.execute(
                    `INSERT INTO telemetry (device_id, batch_id, temp_ferm, temp_amb, target_temp, gravity, battery, status_op, step_name, rssi, extra_sensors, recorded_at)
                     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        deviceId,
                        freshState.ferm,
                        freshState.amb,
                        freshState.csp,
                        freshState.is_sg,
                        freshState.is_bat,
                        freshState.statOp,
                        freshState.profStat,
                        freshState.rssi,
                        freshState.ext_s ? JSON.stringify(freshState.ext_s) : null
                    ]
                ).catch(() => {});
            }

            virtualEsp32.publishTelemetry();
            if (notifyUpdate) notifyUpdate(serialCode);

            res.json({ linked: true, serial: serialCode, message: 'ESP32 Virtual vinculado e online na sua conta!' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro ao vincular ESP32 Virtual' });
        }
    });
};
