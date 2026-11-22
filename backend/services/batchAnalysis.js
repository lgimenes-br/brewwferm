// Breww.AI, parte por regras: saude, risco e previsao do lote calculados so com os dados do proprio lote.
// Sempre disponivel, instantaneo e sem servico externo. O texto da IA (aiWriter.js) so complementa.
// Funcao pura: recebe o lote e a serie por hora (montados no server.js) e devolve o mesmo formato que
// o app e o site ja leem: { summary, health_score, estimated_completion_days, risk_level, insights, ideal_curve }.

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const isValidSg = (v) => Number.isFinite(v) && v >= 0.99 && v <= 1.15;

/** "1.05" -> 1.05; "1050" -> 1.050; invalido -> null */
export const parseGravity = (raw) => {
    let v = Number(String(raw ?? '').replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) return null;
    if (v > 500) v /= 1000;
    return isValidSg(v) ? v : null;
};

const round1 = (v) => Math.round(v * 10) / 10;
const fmtTemp = (v) => `${round1(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;
const fmtSg = (v) => v.toFixed(3);
const fmtDays = (d) => {
    if (d < 1) return `${Math.max(1, Math.round(d * 24))} h`;
    const r = Math.round(d * 2) / 2;
    return `${r.toLocaleString('pt-BR')} ${r === 1 ? 'dia' : 'dias'}`;
};

/** Inclinacao (unidades por dia) por minimos quadrados; null com poucos pontos */
const slopePerDay = (pts, minSpanDays = 0.5, minPoints = 6) => {
    if (pts.length < minPoints) return null;
    const t0 = pts[0].t;
    const xs = pts.map((p) => (p.t - t0) / DAY);
    if (xs[xs.length - 1] - xs[0] < minSpanDays) return null; // pouco tempo de dados
    const ys = pts.map((p) => p.v);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    return den ? num / den : null;
};

/**
 * @param {object} p
 * @param {object} p.batch   { name, style, og, fg, isActive, startedAt, stepStartedAt, currentStep, isPaused, profile: [{name, temperature, duration, triggerGravity}] }
 * @param {Array}  p.hourly  [{ t: ms do inicio da hora, temp, target, sg, cooling (0..1), heating (0..1) }] em ordem
 * @param {object} p.last    { at: ms, temp, target, sg, status } ou null
 * @param {number} [p.now]   ms
 */
export const analyzeFermentation = ({ batch, hourly = [], last = null, now = Date.now() }) => {
    const insights = [];
    let score = 100;
    let forceHigh = false;
    let warn = false; // algum aviso: risco pelo menos medio
    const metrics = {};

    const profile = Array.isArray(batch.profile) ? batch.profile.filter((s) => s && Number.isFinite(Number(s.duration))) : [];
    const stepIdx = Math.min(Math.max(0, Number(batch.currentStep) || 0), Math.max(0, profile.length - 1));
    const step = profile[stepIdx] || null;
    const og = parseGravity(batch.og);
    const fg = parseGravity(batch.fg);

    // --- Leituras chegando? ---
    const lastAgeMin = last?.at ? (now - last.at) / 60000 : Infinity;
    metrics.lastReadingMinutes = Number.isFinite(lastAgeMin) ? Math.round(lastAgeMin) : null;
    if (!last || lastAgeMin > 15) {
        forceHigh = true;
        score -= 40;
        insights.push(last
            ? `O aparelho não envia leituras há ${fmtDays(lastAgeMin / 1440)}: confira a energia e o Wi-Fi. O controle continua no aparelho, mas o app não acompanha.`
            : 'Ainda não há leituras deste lote.');
    }
    const sensorMissing = last && (!Number.isFinite(last.temp) || last.temp === 0);
    if (sensorMissing) {
        forceHigh = true;
        score -= 30;
        insights.push('Sem leitura do sensor de temperatura da cerveja: os relés ficam desligados até ele voltar. Confira o cabo do sensor.');
    }

    // --- Temperatura x alvo (ultimas 24 h) ---
    // Depois de cada troca de alvo (> 1 °C), as 6 h seguintes nao contam: e a rampa natural.
    const day = hourly.filter((h) => h.t >= now - DAY && Number.isFinite(h.temp) && h.temp !== 0 && Number.isFinite(h.target));
    const changes = [];
    for (let i = 1; i < hourly.length; i++) {
        const a = hourly[i - 1].target, b = hourly[i].target;
        if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1) changes.push(hourly[i].t);
    }
    if (batch.stepStartedAt) changes.push(batch.stepStartedAt);
    const settled = day.filter((h) => !changes.some((c) => h.t >= c && h.t < c + 6 * HOUR));
    if (settled.length >= 3) {
        const devs = settled.map((h) => h.temp - h.target);
        const avgAbs = devs.reduce((a, d) => a + Math.abs(d), 0) / devs.length;
        const within = devs.filter((d) => Math.abs(d) <= 0.5).length / devs.length;
        metrics.avgDeviation24h = round1(avgAbs);
        metrics.withinTarget24h = Math.round(within * 100);
        if (avgAbs > 1) warn = true;
        if (avgAbs > 3) forceHigh = true; // longe do alvo o dia todo
        if (avgAbs > 5) score -= 50;
        else if (avgAbs > 2) score -= 30;
        else if (avgAbs > 1) score -= 15;
        else if (avgAbs > 0.5) score -= 5;
        if (avgAbs <= 0.5) insights.push(`Temperatura no alvo em ${metrics.withinTarget24h}% das últimas 24 h.`);
        else insights.push(`A cerveja ficou em média ${fmtTemp(avgAbs)} fora do alvo nas últimas 24 h (no alvo em ${metrics.withinTarget24h}% do tempo).`);
    } else if (day.length) {
        insights.push('O alvo mudou há pouco: a temperatura ainda está na rampa até ele.');
    }

    // --- Refrigeracao/aquecimento sem efeito (ultimas 6 h) ---
    const six = hourly.filter((h) => h.t >= now - 6 * HOUR && Number.isFinite(h.temp) && h.temp !== 0 && Number.isFinite(h.target));
    if (six.length >= 4) {
        const dev = six.reduce((a, h) => a + (h.temp - h.target), 0) / six.length;
        const cooling = six.reduce((a, h) => a + (h.cooling || 0), 0) / six.length;
        const heating = six.reduce((a, h) => a + (h.heating || 0), 0) / six.length;
        const slope = slopePerDay(six.map((h) => ({ t: h.t, v: h.temp })), 3 / 24, 4); // °C por dia (minimo 3 h)
        metrics.tempTrendPerHour = slope === null ? null : Math.round(slope / 24 * 100) / 100;
        if (dev > 1.5 && cooling > 0.7 && slope !== null && slope / 24 >= -0.05) {
            score -= 20;
            warn = true;
            insights.push(`Resfriando há ${six.length} h sem a temperatura cair (cerveja a ${fmtTemp(last?.temp ?? six[six.length - 1].temp)}, alvo ${fmtTemp(six[six.length - 1].target)}): confira se a geladeira está ligada na tomada do relé, com a porta fechada e o compressor funcionando.`);
        } else if (dev < -1.5 && heating > 0.7 && slope !== null && slope / 24 <= 0.05) {
            score -= 20;
            warn = true;
            insights.push(`Aquecendo há ${six.length} h sem a temperatura subir: confira se o aquecedor está ligado na tomada do relé e encostado no fermentador.`);
        }
    }

    // --- Densidade ---
    const sgPts = hourly.filter((h) => isValidSg(h.sg)).map((h) => ({ t: h.t, v: h.sg }));
    const sgNow = isValidSg(last?.sg) ? last.sg : (sgPts.length ? sgPts[sgPts.length - 1].v : null);
    const ogUsed = og ?? (sgPts.length ? sgPts[0].v : null);
    let sgRate = null;
    if (sgNow !== null) {
        metrics.gravity = sgNow;
        sgRate = slopePerDay(sgPts.filter((p) => p.t >= now - 2 * DAY));
        metrics.gravityPerDay = sgRate === null ? null : Number(sgRate.toFixed(4));
        if (ogUsed && ogUsed > 1) {
            const att = (ogUsed - sgNow) / (ogUsed - 1);
            metrics.attenuation = Math.round(Math.max(0, att) * 100);
        }
        const fermenting = stepIdx === 0 || (step && step.triggerGravity);
        if (fg && sgNow <= fg + 0.002) {
            insights.push(`A densidade chegou à final esperada (${fmtSg(sgNow)}; meta ${fmtSg(fg)}).`);
        } else if (sgRate !== null && Math.abs(sgRate) < 0.001 && fermenting && fg && sgNow - fg > 0.004) {
            score -= 20;
            warn = true;
            insights.push(`A densidade está parada em ${fmtSg(sgNow)} há 2 dias, acima da final esperada (${fmtSg(fg)}): a fermentação pode ter travado. Subir 1 a 2 °C e agitar o fermento costuma ajudar.`);
        } else if (sgRate !== null && sgRate < -0.0005) {
            insights.push(`A densidade cai ${(-sgRate * 1000).toFixed(1).replace('.', ',')} pontos por dia (agora ${fmtSg(sgNow)}${metrics.attenuation !== undefined ? `, atenuação de ${metrics.attenuation}%` : ''}).`);
        }
    } else {
        insights.push('Sem densímetro neste lote: a previsão usa só a duração das etapas do perfil.');
    }

    // --- Previsao de termino (fim do perfil) ---
    let remaining = 0;
    if (!batch.isActive) {
        remaining = 0;
    } else if (step) {
        const elapsed = batch.stepStartedAt ? Math.max(0, (now - batch.stepStartedAt) / DAY) : 0;
        let cur = Math.max(0, Number(step.duration) - elapsed);
        const trigger = parseGravity(step.triggerGravity);
        if (trigger && sgNow !== null && sgRate !== null && sgRate < -0.0005 && sgNow > trigger) {
            cur = Math.min(cur, (sgNow - trigger) / -sgRate); // a etapa avanca quando a densidade chegar
        }
        remaining = cur + profile.slice(stepIdx + 1).reduce((a, s) => a + Number(s.duration || 0), 0);
        metrics.step = { index: stepIdx + 1, total: profile.length, name: step.name || `Etapa ${stepIdx + 1}`, target: Number(step.temperature) };
    } else if (fg && sgNow !== null && sgRate !== null && sgRate < -0.0005 && sgNow > fg) {
        remaining = (sgNow - fg) / -sgRate; // sem perfil: so a densidade
    }
    if (batch.isPaused) insights.push('O perfil está pausado: a previsão só volta a correr quando você retomar.');
    const estimated = Math.round(remaining * 2) / 2;

    // --- Curva ideal da densidade (primaria) ---
    const idealCurve = [];
    if (og && fg && og > fg) {
        const days = Number(profile[0]?.duration) > 0 ? Number(profile[0].duration) : 7;
        const H = days * 24, mid = 0.4 * H, k = H / 10;
        for (let h = 0; h <= H; h += 12) idealCurve.push({ hours: h, gravity: Number((fg + (og - fg) / (1 + Math.exp((h - mid) / k))).toFixed(4)) });
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const risk = forceHigh || score < 50 ? 'high' : warn || score < 80 ? 'medium' : 'low';

    // --- Resumo ---
    const parts = [];
    if (metrics.step) parts.push(`${metrics.step.name} (etapa ${metrics.step.index} de ${metrics.step.total})`);
    if (last && Number.isFinite(last.temp) && last.temp !== 0 && Number.isFinite(last.target)) parts.push(`cerveja a ${fmtTemp(last.temp)} para alvo de ${fmtTemp(last.target)}`);
    let summary = parts.length ? `${parts.join(': ')}.` : '';
    summary += risk === 'low' ? ' Tudo dentro do esperado.' : risk === 'medium' ? ' Há pontos de atenção abaixo.' : ' Precisa de atenção agora: veja abaixo.';
    if (batch.isActive && estimated > 0) summary += ` O perfil termina em cerca de ${fmtDays(estimated)}.`;

    return {
        summary: summary.trim(),
        health_score: score,
        estimated_completion_days: estimated,
        risk_level: risk,
        insights,
        ideal_curve: idealCurve,
        metrics,
    };
};
