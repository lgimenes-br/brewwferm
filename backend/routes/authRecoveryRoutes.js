import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const escapeHtml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const registerAuthRecoveryRoutes = (app, pool, authRateLimiter, sendPushToUser) => {
    // 1. Solicitar código de recuperação de senha (6 dígitos, válido por 15 min)
    app.post('/api/auth/forgot-password', authRateLimiter, async (req, res) => {
        try {
            const rawEmail = String(req.body?.email || '').trim().toLowerCase();
            if (!rawEmail || !rawEmail.includes('@')) {
                return res.status(400).json({ error: 'Informe um e-mail válido' });
            }

            const [users] = await pool.execute(
                'SELECT id, name, email, alert_config FROM users WHERE LOWER(email) = ? LIMIT 1',
                [rawEmail]
            );

            if (users.length > 0) {
                const user = users[0];
                const recoveryCode = String(crypto.randomInt(100000, 1000000));
                const tokenHash = crypto
                    .createHash('sha256')
                    .update(`${rawEmail}:${recoveryCode}`)
                    .digest('hex');

                await pool.execute(
                    'UPDATE users SET reset_token_hash = ?, reset_token_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
                    [tokenHash, user.id]
                );

                const userIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || null;
                await pool.execute(
                    'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                    [user.id, 'PASSWORD_RESET_REQUEST', `Recovery code requested for ${rawEmail}`, userIp]
                ).catch(() => {});

                const msgTitle = 'Recuperação de Senha Breww 🔐';
                const msgBody = `Seu código de recuperação Breww é: ${recoveryCode} (válido por 15 minutos).`;

                // Canal 1: WebPush nos dispositivos já inscritos do usuário
                try {
                    await sendPushToUser(pool, user.id, msgTitle, msgBody);
                } catch (e) {}

                // Canal 2: Bot do Telegram (se configurado nas preferências de alerta do usuário)
                const safeUserName = escapeHtml(user.name || 'Cervejeiro');
                try {
                    const cfg = typeof user.alert_config === 'string'
                        ? JSON.parse(user.alert_config)
                        : (user.alert_config || {});
                    if (cfg && cfg.telegramBotToken && cfg.telegramChatId) {
                        await fetch(`https://api.telegram.org/bot${encodeURIComponent(cfg.telegramBotToken)}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: String(cfg.telegramChatId),
                                text: `🍺 <b>Breww — Recuperação de Senha</b>\n\nOlá, ${safeUserName}!\nSeu código de verificação é: <b>${escapeHtml(recoveryCode)}</b>\n\nEle expira em 15 minutos.`,
                                parse_mode: 'HTML'
                            })
                        });
                    }
                } catch (e) {}

                // Canal 3: E-mail via API HTTP Resend (se RESEND_API_KEY estiver configurada no .env)
                const resendKey = process.env.RESEND_API_KEY;
                if (resendKey) {
                    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Breww <noreply@breww.live>';
                    const appOrigin = process.env.PUBLIC_APP_URL || 'https://breww.live';
                    const directLink = `${appOrigin}/#/login?reset=1&email=${encodeURIComponent(rawEmail)}&code=${encodeURIComponent(recoveryCode)}`;
                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${resendKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: fromEmail,
                            to: [user.email],
                            subject: 'Código de Recuperação de Senha — Breww',
                            html: `
                                <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #f5f5f5; padding: 32px; border-radius: 16px; border: 1px solid #262626;">
                                    <h2 style="margin-top: 0; color: #ffffff; letter-spacing: -0.03em;">BREWW Smart Brewing</h2>
                                    <p style="color: #a3a3a3; font-size: 14px;">Olá, <strong>${safeUserName}</strong>!</p>
                                    <p style="color: #a3a3a3; font-size: 14px;">Use o código de 6 dígitos abaixo para redefinir sua senha (válido por 15 minutos):</p>
                                    <div style="background: #171717; border: 1px solid #404040; border-radius: 12px; padding: 16px; text-align: center; font-size: 28px; font-weight: 900; letter-spacing: 0.25em; color: #ffffff; margin: 24px 0;">
                                        ${escapeHtml(recoveryCode)}
                                    </div>
                                    <p style="text-align: center; margin: 24px 0;">
                                        <a href="${directLink}" style="background: #ffffff; color: #000000; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 14px;">Redefinir Senha Agora</a>
                                    </p>
                                    <p style="color: #737373; font-size: 12px; margin-bottom: 0;">Se você não solicitou esta alteração, ignore este e-mail com segurança.</p>
                                </div>
                            `
                        })
                    }).catch(err => console.error('Resend email error:', err.message));
                }
            }

            // Resposta idêntica mesmo que o e-mail não exista (evita enumeração de contas)
            res.json({
                message: 'Se o e-mail estiver cadastrado, enviamos o código de 6 dígitos (por E-mail, Push e/ou Telegram configurado).'
            });
        } catch (err) {
            console.error('Forgot Password Error:', err);
            res.status(500).json({ error: 'Erro interno ao processar recuperação de senha' });
        }
    });

    // 2. Confirmar código de 6 dígitos e definir nova senha
    app.post('/api/auth/reset-password', authRateLimiter, async (req, res) => {
        try {
            const rawEmail = String(req.body?.email || '').trim().toLowerCase();
            const rawCode = String(req.body?.code || '').trim();
            const newPassword = String(req.body?.newPassword || '');

            if (!rawEmail || !rawCode || !newPassword) {
                return res.status(400).json({ error: 'E-mail, código de verificação e nova senha são obrigatórios' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
            }

            const [users] = await pool.execute(
                'SELECT id, reset_token_hash FROM users WHERE LOWER(email) = ? AND reset_token_hash IS NOT NULL AND reset_token_expires > NOW() LIMIT 1',
                [rawEmail]
            );

            if (users.length === 0) {
                return res.status(400).json({ error: 'Código inválido ou expirado. Solicite um novo código.' });
            }

            const expectedHash = crypto
                .createHash('sha256')
                .update(`${rawEmail}:${rawCode}`)
                .digest('hex');

            const storedHash = String(users[0].reset_token_hash || '');
            const isMatch =
                storedHash.length === expectedHash.length &&
                crypto.timingSafeEqual(Buffer.from(storedHash, 'utf8'), Buffer.from(expectedHash, 'utf8'));

            if (!isMatch) {
                const userIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || null;
                await pool.execute(
                    'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                    [users[0].id, 'PASSWORD_RESET_FAILED', 'Invalid recovery code attempt', userIp]
                ).catch(() => {});
                return res.status(400).json({ error: 'Código inválido ou expirado. Solicite um novo código.' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await pool.execute(
                'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = ?',
                [hashedPassword, users[0].id]
            );

            const userIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || null;
            await pool.execute(
                'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
                [users[0].id, 'PASSWORD_RESET_SUCCESS', 'Password reset completed via recovery code', userIp]
            ).catch(() => {});

            res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
        } catch (err) {
            console.error('Reset Password Error:', err);
            res.status(500).json({ error: 'Erro interno ao redefinir senha' });
        }
    });
};
