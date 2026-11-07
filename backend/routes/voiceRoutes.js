import crypto from 'crypto';

// Constant-time string comparison for voice tokens
const isValidVoiceToken = (provided, expected) => {
    if (!provided || !expected || typeof provided !== 'string' || typeof expected !== 'string') return false;
    const bufA = Buffer.from(provided);
    const bufB = Buffer.from(expected);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

// Shared helper & routes for Voice Assistant Endpoints (Alexa / Google Home)
export const registerVoiceRoutes = (app, pool) => {
    const buildVoiceStatusText = async (userIdFilter) => {
        const userClause = userIdFilter ? 'AND d.user_id = ?' : '';
        const params = userIdFilter ? [userIdFilter] : [];
        const [batches] = await pool.execute(
            `SELECT b.id, b.name, b.style, d.id as device_id, d.device_name, d.sensor1_name, d.sensor2_name, d.sensor_sg_name
             FROM batches b JOIN devices d ON b.device_id = d.id
             WHERE b.is_active = 1 ${userClause} ORDER BY b.id DESC LIMIT 1`,
            params
        );
        if (batches.length === 0) {
            return 'Não há nenhum lote ativo no momento no seu painel Breww.';
        }
        const batch = batches[0];
        const [telemetry] = await pool.execute(
            `SELECT temp_ferm, temp_amb, target_temp, gravity, status_op FROM telemetry WHERE batch_id = ? ORDER BY id DESC LIMIT 1`,
            [batch.id]
        );
        if (telemetry.length === 0) {
            return `O lote ${batch.name} está ativo, mas ainda não recebi dados de telemetria.`;
        }
        const t = telemetry[0];
        const tempFerm = t.temp_ferm !== null && t.temp_ferm !== undefined ? parseFloat(t.temp_ferm).toFixed(1).replace('.', ' vírgula ') : 'desconhecida';
        const tempAmb = t.temp_amb !== null && t.temp_amb !== undefined ? parseFloat(t.temp_amb).toFixed(1).replace('.', ' vírgula ') : 'desconhecida';
        const s3 = batch.sensor_sg_name || 'Gravidade';
        let gravText = '';
        if (t.gravity && parseFloat(t.gravity) > 0) {
            const parts = parseFloat(t.gravity).toFixed(3).split('.');
            if (parts.length === 2) {
                gravText = `e o sensor ${s3} está em ${parts[0]} ponto ${parts[1].split('').join(' ')}`;
            }
        }
        const s1 = batch.sensor1_name || 'Fermentador';
        const s2 = batch.sensor2_name || 'Geladeira';
        return `O lote ${batch.name} está ativo. A temperatura do ${s1} é de ${tempFerm} graus, do ${s2} é ${tempAmb} graus, ${gravText}.`;
    };

    app.get('/api/voice/status', async (req, res) => {
        try {
            const token = req.query.token;
            const voiceToken = process.env.VOICE_TOKEN;
            if (!isValidVoiceToken(token, voiceToken)) return res.status(403).send('Acesso negado. Token inválido.');
            const text = await buildVoiceStatusText(req.query.user_id);
            res.send(text);
        } catch (err) {
            console.error(err);
            res.status(500).send('Ocorreu um erro ao consultar o servidor.');
        }
    });

    // Native Alexa Custom Skill Endpoint
    app.post('/api/voice/alexa', async (req, res) => {
        try {
            if (req.body && req.body.request && req.body.request.type === 'SessionEndedRequest') {
                return res.json({ version: "1.0", response: { shouldEndSession: true } });
            }
            const token = req.query.token;
            const voiceToken = process.env.VOICE_TOKEN;
            if (!isValidVoiceToken(token, voiceToken)) {
                return res.json({
                    version: "1.0",
                    response: {
                        outputSpeech: { type: "PlainText", text: "Acesso negado. Verifique o token de segurança no aplicativo." },
                        shouldEndSession: true
                    }
                });
            }
            const text = await buildVoiceStatusText(req.query.user_id);
            res.json({
                version: "1.0",
                response: {
                    outputSpeech: { type: "PlainText", text },
                    shouldEndSession: true
                }
            });
        } catch (err) {
            console.error("Alexa Endpoint Error:", err);
            res.json({ version: "1.0", response: { outputSpeech: { type: "PlainText", text: "Ocorreu um erro interno ao consultar o servidor Breww." }, shouldEndSession: true } });
        }
    });
};
