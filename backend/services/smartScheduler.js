export const startSmartScheduler = ({
    pool,
    advanceBatchStep,
    normalizeGravityVal,
    alertState,
    sendPushToUser
}) => {
    // --- 1. SMART SCHEDULING (Autonomous Profile Advancement) ---
    const smartTimer = setInterval(async () => {
        try {
            const [activeBatches] = await pool.execute(`
                SELECT b.id, b.profile, b.current_step_index, b.step_started_at, d.serial_code, d.user_id 
                FROM batches b 
                JOIN devices d ON b.device_id = d.id 
                WHERE b.is_active = 1 AND b.profile IS NOT NULL
            `);

            for (const batch of activeBatches) {
                if (!batch.profile || !batch.step_started_at) continue;
                let profile = [];
                try {
                    profile = typeof batch.profile === 'string' ? JSON.parse(batch.profile) : batch.profile;
                } catch (e) {
                    continue;
                }

                if (Array.isArray(profile) && batch.current_step_index < profile.length - 1) {
                    const currentStep = profile[batch.current_step_index];
                    const stepDuration = currentStep ? (currentStep.duration ?? currentStep.d) : null;
                    if (!currentStep || !stepDuration) continue;

                    const elapsedMs = Date.now() - new Date(batch.step_started_at).getTime();
                    // If step only has .d (ESP32 raw format), it was sent in hours; .duration is stored in days
                    const durationDays = currentStep.duration !== undefined
                        ? parseFloat(stepDuration)
                        : (parseFloat(stepDuration) / 24);
                    const durationMs = durationDays * 24 * 60 * 60 * 1000;

                    // Check Gravity Trigger (optional per-step target SG)
                    let gravityTriggered = false;
                    let latestGravNorm = 0;
                    const triggerGravNorm = normalizeGravityVal(currentStep.triggerGravity ?? currentStep.g);
                    if (triggerGravNorm > 0) {
                        const [gRows] = await pool.execute(
                            'SELECT gravity FROM telemetry WHERE batch_id = ? AND gravity IS NOT NULL AND gravity > 0 ORDER BY id DESC LIMIT 1',
                            [batch.id]
                        );
                        if (gRows.length > 0) {
                            latestGravNorm = normalizeGravityVal(gRows[0].gravity);
                            if (latestGravNorm > 0.980 && latestGravNorm <= triggerGravNorm) {
                                gravityTriggered = true;
                            }
                        }
                    }

                    if (elapsedMs >= durationMs || gravityTriggered) {
                        const newIndex = batch.current_step_index + 1;
                        await advanceBatchStep({
                            batchId: batch.id,
                            serialCode: batch.serial_code,
                            userId: batch.user_id,
                            profile,
                            newIndex,
                            gravityTriggered,
                            liveSgNorm: latestGravNorm,
                            trigNorm: triggerGravNorm
                        });
                        console.log(`🤖 [Smart Scheduler] Lote ${batch.id} avançou para etapa ${newIndex} (${gravityTriggered ? 'SG Trigger' : 'Tempo'})`);
                    }
                }
            }
        } catch (e) {
            console.error('Erro no Smart Scheduler:', e);
        }
    }, 5 * 60 * 1000); // Roda a cada 5 minutos

    // --- 2. MAGIC PREDICTION (Fim da Fermentação) ---
    const MAGIC_PREDICTION_INTERVAL = 60 * 60 * 1000; // Roda a cada 1 hora
    const magicTimer = setInterval(async () => {
        try {
            const [batches] = await pool.execute(`SELECT b.id, b.name, d.user_id, b.fg FROM batches b JOIN devices d ON b.device_id = d.id WHERE b.is_active = 1`);

            for (const batch of batches) {
                if (!batch.fg) continue; // Sem FG esperado
                let targetFg = parseFloat(batch.fg);
                if (isNaN(targetFg) || targetFg <= 0) continue;
                if (targetFg > 500) targetFg = targetFg / 1000;

                // Já alertou em memória ou no histórico de eventos do lote?
                if (alertState[`magic_${batch.id}`]) continue;
                const [existingMagic] = await pool.execute(
                    `SELECT id FROM batch_events WHERE batch_id = ? AND event_type = 'MAGIC_PREDICTION' LIMIT 1`,
                    [batch.id]
                );
                if (existingMagic.length > 0) {
                    alertState[`magic_${batch.id}`] = true;
                    continue;
                }

                // Pega dados das últimas 48h
                const [rows] = await pool.execute(
                    `SELECT gravity, recorded_at FROM telemetry WHERE batch_id = ? AND gravity IS NOT NULL AND gravity > 0 AND recorded_at > DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY recorded_at ASC`,
                    [batch.id]
                );

                if (rows.length < 5) continue;

                const first = rows[0];
                const last = rows[rows.length - 1];

                const hoursDiff = (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / (1000 * 60 * 60);
                if (hoursDiff < 6) continue; // Precisa de pelo menos 6 horas de dados

                let firstGrav = parseFloat(first.gravity);
                let lastGrav = parseFloat(last.gravity);
                if (isNaN(firstGrav) || isNaN(lastGrav)) continue;
                if (firstGrav > 500) firstGrav = firstGrav / 1000;
                if (lastGrav > 500) lastGrav = lastGrav / 1000;

                const sgDrop = firstGrav - lastGrav;
                if (sgDrop <= 0.001) continue; // Queda insignificante

                const dropRatePerHour = sgDrop / hoursDiff;
                const remainingDrop = lastGrav - targetFg;

                if (remainingDrop > 0 && dropRatePerHour > 0) {
                    const hoursRemaining = remainingDrop / dropRatePerHour;

                    // Se faltar 24h ou menos, avisa o usuário e grava no banco para não repetir após restart
                    if (hoursRemaining > 0 && hoursRemaining <= 24) {
                        alertState[`magic_${batch.id}`] = true;
                        const msgText = `Atenção! Sua ${batch.name} deve atingir o FG esperado (${batch.fg}) nas próximas ${Math.round(hoursRemaining)} horas!`;
                        await pool.execute(
                            `INSERT INTO batch_events (batch_id, event_type, description, recorded_at) VALUES (?, 'MAGIC_PREDICTION', ?, NOW())`,
                            [batch.id, msgText]
                        ).catch(() => {});
                        await sendPushToUser(pool, batch.user_id, 'Previsão Mágica 🔮', msgText);
                        console.log(`[Magic Prediction] Alerta enviado para lote ${batch.id} (${batch.name}) - ETA: ${hoursRemaining}h`);
                    }
                }
            }
        } catch (e) {
            console.error('Magic Prediction Error:', e);
        }
    }, MAGIC_PREDICTION_INTERVAL);

    return {
        stop() {
            clearInterval(smartTimer);
            clearInterval(magicTimer);
        }
    };
};
