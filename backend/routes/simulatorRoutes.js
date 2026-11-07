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
                const [devs] = await pool.execute('SELECT id FROM devices WHERE serial_code = ? AND user_id = ?', [serialCode, req.user.id]);
                if (devs.length > 0) {
                    await pool.execute('DELETE FROM telemetry WHERE device_id = ?', [devs[0].id]);
                    await pool.execute('DELETE FROM batches WHERE device_id = ?', [devs[0].id]);
                    await pool.execute('DELETE FROM devices WHERE id = ?', [devs[0].id]);
                }
                if (notifyUpdate) notifyUpdate(serialCode);
                return res.json({ linked: false, serial: serialCode, message: 'ESP32 Virtual desvinculado! Agora ele aparecerá em "Buscar na Rede" (Discovery).' });
            }

            const [existing] = await pool.execute('SELECT id, user_id FROM devices WHERE serial_code = ? LIMIT 1', [serialCode]);
            if (existing.length > 0) {
                await pool.execute('UPDATE devices SET user_id = ?, last_seen = NOW() WHERE id = ?', [req.user.id, existing[0].id]);
            } else {
                await pool.execute(
                    'INSERT INTO devices (serial_code, user_id, device_name, firmware_version, last_seen, created_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                    [serialCode, req.user.id, 'Fermentador ESP32 Virtual', state.ver || 'V2.5.0-VIRTUAL']
                );
            }

            if (!state.enabled) {
                virtualEsp32.updateSimulatorState({ enabled: true, serial: serialCode });
            } else {
                virtualEsp32.publishTelemetry();
            }
            if (notifyUpdate) notifyUpdate(serialCode);

            res.json({ linked: true, serial: serialCode, message: 'ESP32 Virtual vinculado e ligado na sua conta!' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Erro ao vincular ESP32 Virtual' });
        }
    });
};
