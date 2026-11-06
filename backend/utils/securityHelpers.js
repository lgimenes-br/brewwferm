// SSRF guard: rejects loopback, link-local, private RFC1918 and non-HTTP(S) URLs
export const isSafeExternalWebhookUrl = (urlStr) => {
    try {
        const parsed = new URL(String(urlStr || '').trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const host = (parsed.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
        if (!host) return false;
        if (
            host === 'localhost' ||
            host === '0.0.0.0' ||
            host === '::1' ||
            host.endsWith('.local') ||
            host.endsWith('.internal') ||
            /^127\./.test(host) ||
            /^10\./.test(host) ||
            /^192\.168\./.test(host) ||
            /^169\.254\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
        ) {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
};

// Simple in-memory rate limiter for auth endpoints (max 15 requests / 15 min per IP)
const authAttemptsByIp = new Map();
export const authRateLimiter = (req, res, next) => {
    const rawIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip || 'unknown';
    const ip = String(rawIp).split(',')[0].trim();
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const entry = authAttemptsByIp.get(ip);
    if (!entry || now - entry.start > windowMs) {
        authAttemptsByIp.set(ip, { count: 1, start: now });
        return next();
    }
    entry.count += 1;
    if (entry.count > 15) {
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
};

// Security Headers (nosniff, clickjacking protection, referrer policy, permissions policy)
export const securityHeadersMiddleware = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
};
