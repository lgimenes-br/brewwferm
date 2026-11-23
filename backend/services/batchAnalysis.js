// Breww.AI, parte por regras: saude, risco, fase, previsao e recomendacoes calculados so com os dados do
// proprio lote. Sempre disponivel, instantaneo e sem servico externo. O texto da IA (aiWriter.js) so explica.
// Funcao pura: recebe o lote e a serie por hora (montados no server.js) e devolve o formato que o app e o
// site leem: { summary, health_score, estimated_completion_days, risk_level, insights, ideal_curve } e, desde
// 22/11/2026, tambem { phase, style, predicted_fg, predicted_fg_days, sections, next_steps, metrics }.

import { matchStyle } from './brewStyles.js';

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
const fmt1 = (v) => round1(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtTemp = (v) => `${fmt1(v)} °C`;
const fmtSg = (v) => v.toFixed(3);
const fmtDays = (d) => {
    if (d < 1) return `${Math.max(1, Math.round(d * 24))} h`;
    const r = Math.round(d * 2) / 2;
    return `${r.toLocaleString('pt-BR')} ${r === 1 ? 'dia' : 'dias'}`;
};
const quantile = (arr, q) => {
    const s = [...arr].sort((a, b) => a - b);
    const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
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
 * Densidade final prevista pela propria curva: sg(t) = fg + (sg0 - fg) * e^(-k t), ajustada por busca em fg.
 * Precisa de >= 24 pontos em >= 24 h e queda de pelo menos 4 pontos. Devolve { fg, daysToFg } ou null.
 */
export const predictFinalGravity = (pts, now) => {
    if (pts.length < 24) return null;
    const span = (pts[pts.length - 1].t - pts[0].t) / DAY;
    const minSg = Math.min(...pts.map((p) => p.v));
    if (span < 1 || pts[0].v - minSg < 0.004) return null;
    const t0 = pts[0].t;
    let best = null;
    for (let fg = minSg - 0.0002; fg >= Math.max(0.99, minSg - 0.02); fg -= 0.0002) {
        const xs = [], ys = [];
        for (const p of pts) { if (p.v - fg > 0) { xs.push((p.t - t0) / DAY); ys.push(Math.log(p.v - fg)); } }
        if (xs.length < pts.length * 0.9) continue;
        const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
        let num = 0, den = 0;
        for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
        if (!den) continue;
        const k = -num / den, a = my + k * mx; // ln(sg - fg) = a - k t
        if (k <= 0) continue;
        let sse = 0;
        for (const p of pts) sse += (p.v - (fg + Math.exp(a - k * (p.t - t0) / DAY))) ** 2;
        if (!best || sse < best.sse) best = { fg, k, a, sse };
    }
    if (!best) return null;
    const tNow = (now - t0) / DAY;
    const remaining = Math.exp(best.a - best.k * tNow); // sg - fg agora, pela curva
    const daysToFg = remaining <= 0.001 ? 0 : Math.log(remaining / 0.001) / best.k;
    if (!Number.isFinite(daysToFg) || daysToFg > 60) return null;
    return { fg: Number(best.fg.toFixed(3)), daysToFg };
};

const PHASES = {
    inicio: 'Início (fase lag)',
    ativa: 'Fermentação ativa',
    desacelerando: 'Desacelerando',
    estavel: 'Densidade estável',
    terminada: 'Fermentação terminada',
    perfil: 'Seguindo o perfil',
    finalizado: 'Lote finalizado',
};

/**
 * @param {object} p
 * @param {object} p.batch   { name, style, og, fg, isActive, startedAt, stepStartedAt, currentStep, isPaused, profile: [{name, temperature, duration, triggerGravity}] }
 * @param {Array}  p.hourly  [{ t: ms do inicio da hora, temp, target, sg, cooling (0..1), heating (0..1) }] em ordem
 * @param {object} p.last    { at: ms, temp, target, sg, status } ou null
 * @param {object} [p.equipment] { coolStarts24h, heatStarts24h }: quantas vezes cada rele ligou nas ultimas 24 h
 * @param {Array}  [p.events]    diario do lote (sem os do sistema): [{ type, description, at: ms }]
 * @param {Array}  [p.history]   lotes anteriores da mesma familia de estilo: [{ days, attenuation }]
 * @param {number} [p.now]   ms
 */
export const analyzeFermentation = ({ batch, hourly = [], last = null, equipment = {}, events = [], history = [], now = Date.now() }) => {
    let score = 100;
    let forceHigh = false;
    let warn = false; // algum aviso: risco pelo menos medio
    const metrics = {};
    const sec = { fase: [], temperatura: [], fermentacao: [], equipamento: [] };
    const nextSteps = [];

    const profile = Array.isArray(batch.profile) ? batch.profile.filter((s) => s && Number.isFinite(Number(s.duration))) : [];
    const stepIdx = Math.min(Math.max(0, Number(batch.currentStep) || 0), Math.max(0, profile.length - 1));
    const step = profile[stepIdx] || null;
    const og = parseGravity(batch.og);
    const fg = parseGravity(batch.fg);
    const style = matchStyle(batch.style, batch.name);
    const stepName = (s) => String(s?.name || '').toLowerCase();
    const isFermentStep = !step || stepIdx === 0 || /ferment|prim/.test(stepName(step));
    const later = profile.slice(stepIdx + 1);

    // --- Leituras chegando? ---
    const lastAgeMin = last?.at ? (now - last.at) / 60000 : Infinity;
    metrics.lastReadingMinutes = Number.isFinite(lastAgeMin) ? Math.round(lastAgeMin) : null;
    const stale = !last || lastAgeMin > 15;
    if (stale) {
        forceHigh = true;
        score -= 40;
        sec.equipamento.push(last
            ? `O aparelho não envia leituras há ${fmtDays(lastAgeMin / 1440)}: confira a energia e o Wi-Fi. O controle continua no aparelho, mas o app não acompanha.`
            : 'Ainda não há leituras deste lote.');
    }
    const sensorMissing = last && (!Number.isFinite(last.temp) || last.temp === 0);
    if (!sensorMissing && last) { metrics.currentTemp = round1(last.temp); if (Number.isFinite(last.target)) metrics.currentTarget = round1(last.target); }
    if (sensorMissing) {
        forceHigh = true;
        score -= 30;
        sec.equipamento.push('Sem leitura do sensor de temperatura da cerveja: os relés ficam desligados até ele voltar. Confira o cabo do sensor.');
    }
    if (stale || sensorMissing) nextSteps.push({ text: stale && last ? 'Restabeleça as leituras: confira a energia e o Wi-Fi do aparelho.' : 'Confira o sensor de temperatura da cerveja.', when: 'agora' });

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
        const avgTemp = settled.reduce((a, h) => a + h.temp, 0) / settled.length;
        const avgTarget = settled.reduce((a, h) => a + h.target, 0) / settled.length;
        const meanDev = avgTemp - avgTarget;
        metrics.avgTemp24h = round1(avgTemp);
        metrics.avgTarget24h = round1(avgTarget);
        if (avgAbs <= 0.5) sec.temperatura.push(`Temperatura no alvo em ${metrics.withinTarget24h}% das últimas 24 h.`);
        else sec.temperatura.push(`A cerveja ficou em média ${fmtTemp(Math.abs(meanDev))} ${meanDev >= 0 ? 'acima' : 'abaixo'} do alvo nas últimas 24 h: média de ${fmtTemp(avgTemp)} para alvo de ${fmtTemp(avgTarget)} (no alvo em ${metrics.withinTarget24h}% do tempo).`);
        // Etapa fria (maturacao/cold crash) sem frio: a etapa nao esta acontecendo
        if (Number.isFinite(Number(step?.temperature)) && Number(step.temperature) <= 4 && meanDev > 5) {
            sec.temperatura.push(`A etapa "${step.name}" pede ${fmtTemp(Number(step.temperature))}, mas a cerveja segue a ${fmtTemp(avgTemp)}: sem o frio, ela não clarifica nem matura, e muito tempo quente depois da fermentação aumenta o risco de sabores de autólise do fermento e de oxidação.`);
        }
        // Estabilidade: quanto passa do alvo e quanto oscila (so faz sentido perto do alvo)
        if (avgAbs <= 2 && settled.length >= 6) {
            const overshoot = Math.max(...devs.map((d) => Math.abs(d)));
            const swing = quantile(devs, 0.9) - quantile(devs, 0.1);
            metrics.maxOvershoot24h = round1(overshoot);
            metrics.swing24h = round1(swing);
            if (swing > 1.2) {
                score -= 5;
                sec.temperatura.push(`A temperatura oscila ${fmtTemp(swing)} em torno do alvo: uma histerese menor ou o PID deixam mais estável.`);
            }
        }
    } else if (day.length) {
        sec.temperatura.push('O alvo mudou há pouco: a temperatura ainda está na rampa até ele.');
    }

    // --- Refrigeracao/aquecimento sem efeito (ultimas 6 h) ---
    const six = hourly.filter((h) => h.t >= now - 6 * HOUR && Number.isFinite(h.temp) && h.temp !== 0 && Number.isFinite(h.target));
    if (six.length >= 4) {
        const dev = six.reduce((a, h) => a + (h.temp - h.target), 0) / six.length;
        const cooling = six.reduce((a, h) => a + (h.cooling || 0), 0) / six.length;
        const heating = six.reduce((a, h) => a + (h.heating || 0), 0) / six.length;
        const slope = slopePerDay(six.map((h) => ({ t: h.t, v: h.temp })), 3 / 24, 4); // °C por dia (minimo 3 h)
        metrics.tempTrendPerHour = slope === null ? null : Math.round(slope / 24 * 100) / 100;
        // Queda/subida minima esperada com o equipamento funcionando: longe do alvo, varios decimos por hora
        const minRate = Math.abs(dev) > 5 ? 0.3 : 0.05; // °C por hora
        if (dev > 1.5 && cooling > 0.7 && slope !== null && slope / 24 > -minRate) {
            score -= 20;
            warn = true;
            sec.equipamento.push(`Resfriando há ${six.length} h sem a temperatura cair (cerveja a ${fmtTemp(last?.temp ?? six[six.length - 1].temp)}, alvo ${fmtTemp(six[six.length - 1].target)}): confira se a geladeira está ligada na tomada do relé, com a porta fechada e o compressor funcionando.`);
            nextSteps.push({ text: 'Confira a geladeira: tomada do relé, porta fechada e compressor ligando.', when: 'agora' });
        } else if (dev < -1.5 && heating > 0.7 && slope !== null && slope / 24 < minRate) {
            score -= 20;
            warn = true;
            sec.equipamento.push(`Aquecendo há ${six.length} h sem a temperatura subir: confira se o aquecedor está ligado na tomada do relé e encostado no fermentador.`);
            nextSteps.push({ text: 'Confira o aquecedor: tomada do relé e contato com o fermentador.', when: 'agora' });
        }
    }

    // --- Ciclos do compressor (ultimas 24 h) ---
    const coolStarts = Number(equipment.coolStarts24h);
    if (Number.isFinite(coolStarts)) {
        metrics.coolStarts24h = coolStarts;
        if (coolStarts > 48) {
            score -= 10;
            warn = true;
            sec.equipamento.push(`O compressor ligou ${coolStarts} vezes em 24 h (mais de 2 por hora): ciclos curtos gastam a geladeira. Aumente a histerese ou a proteção do compressor nos ajustes.`);
        } else if (coolStarts > 0 && metrics.avgDeviation24h !== undefined && metrics.avgDeviation24h <= 2) {
            // So faz sentido com a temperatura perto do alvo (com a geladeira sem efeito, ele liga pouco porque fica ligado)
            sec.equipamento.push(`O compressor ligou ${coolStarts} ${coolStarts === 1 ? 'vez' : 'vezes'} em 24 h: ritmo saudável.`);
        }
    }
    const heatStarts = Number(equipment.heatStarts24h);
    if (Number.isFinite(heatStarts)) metrics.heatStarts24h = heatStarts;

    // --- Densidade ---
    const sgPts = hourly.filter((h) => isValidSg(h.sg)).map((h) => ({ t: h.t, v: h.sg }));
    const sgNow = isValidSg(last?.sg) ? last.sg : (sgPts.length ? sgPts[sgPts.length - 1].v : null);
    const ogUsed = og ?? (sgPts.length ? sgPts[0].v : null);
    let sgRate = null;
    let stalled = false;
    let reachedFg = false;
    let prediction = null;
    if (sgNow !== null) {
        metrics.gravity = sgNow;
        sgRate = slopePerDay(sgPts.filter((p) => p.t >= now - 2 * DAY));
        metrics.gravityPerDay = sgRate === null ? null : Number(sgRate.toFixed(4));
        if (ogUsed && ogUsed > 1) {
            const att = (ogUsed - sgNow) / (ogUsed - 1);
            metrics.attenuation = Math.round(Math.max(0, att) * 100);
        }
        prediction = predictFinalGravity(sgPts.filter((p) => p.t >= now - 7 * DAY), now);
        if (prediction) { metrics.predictedFg = prediction.fg; metrics.predictedFgDays = Math.round(prediction.daysToFg * 10) / 10; }
        const fermenting = stepIdx === 0 || (step && step.triggerGravity);
        if (fg && sgNow <= fg + 0.002) {
            reachedFg = true;
            sec.fermentacao.push(`A densidade chegou à final esperada (${fmtSg(sgNow)}; meta ${fmtSg(fg)}).`);
        } else if (sgRate !== null && Math.abs(sgRate) < 0.001 && fermenting && fg && sgNow - fg > 0.004) {
            stalled = true;
            score -= 20;
            warn = true;
            sec.fermentacao.push(`A densidade está parada em ${fmtSg(sgNow)} há 2 dias, acima da final esperada (${fmtSg(fg)}): a fermentação pode ter travado. Subir 1 a 2 °C e agitar o fermento costuma ajudar.`);
            nextSteps.push({ text: 'Suba a temperatura 1 a 2 °C e agite levemente o fermentador para reanimar o fermento.', when: 'agora' });
        } else if (sgRate !== null && sgRate < -0.0005) {
            sec.fermentacao.push(`A densidade cai ${fmt1(-sgRate * 1000)} pontos por dia (agora ${fmtSg(sgNow)}${metrics.attenuation !== undefined ? `, atenuação de ${metrics.attenuation}%` : ''}).`);
        }
        if (prediction && !reachedFg && !stalled && prediction.fg < sgNow - 0.001) {
            const vsMeta = fg ? (prediction.fg > fg + 0.003 ? `, acima da meta de ${fmtSg(fg)}` : prediction.fg < fg - 0.003 ? `, abaixo da meta de ${fmtSg(fg)}` : ', perto da meta') : '';
            sec.fermentacao.push(`Pela curva até aqui, a densidade deve parar em torno de ${fmtSg(prediction.fg)}${vsMeta}, em cerca de ${fmtDays(Math.max(prediction.daysToFg, 0.5))}.`);
        }
        if (style && metrics.attenuation !== undefined && (reachedFg || (sgRate !== null && Math.abs(sgRate) < 0.001))) {
            const [lo, hi] = style.att;
            if (metrics.attenuation < lo - 5) sec.fermentacao.push(`Atenuação de ${metrics.attenuation}%, abaixo do típico para ${style.label} (${lo}–${hi}%): mosto pouco fermentável, fermento cansado ou temperatura baixa demais.`);
            else if (metrics.attenuation > hi + 5) sec.fermentacao.push(`Atenuação de ${metrics.attenuation}%, acima do típico para ${style.label} (${lo}–${hi}%): a cerveja tende a ficar mais seca.`);
        }
    } else {
        sec.fermentacao.push('Sem densímetro neste lote: a previsão usa só a duração das etapas do perfil.');
    }

    // --- Estilo x temperatura da fermentacao ---
    if (style) {
        metrics.style = style.label;
        const target = Number(step?.temperature ?? last?.target);
        if (isFermentStep && Number.isFinite(target)) {
            const [lo, hi] = style.temp;
            if (target > hi + 1) {
                warn = true;
                score -= 5;
                sec.temperatura.push(`Alvo de ${fmtTemp(target)} acima da faixa típica de ${style.label} (${lo}–${hi} °C): mais ésteres e álcoois superiores. Se não for intencional, baixe o alvo.`);
            } else if (target < lo - 1) {
                warn = true;
                score -= 5;
                sec.temperatura.push(`Alvo de ${fmtTemp(target)} abaixo da faixa típica de ${style.label} (${lo}–${hi} °C): fermentação lenta e risco de travar.`);
            } else {
                sec.temperatura.push(`Alvo de ${fmtTemp(target)} dentro da faixa típica de ${style.label} (${lo}–${hi} °C).`);
            }
        }
    }

    // --- Fase ---
    const hoursSinceStart = batch.startedAt ? (now - batch.startedAt) / HOUR : null;
    const ptsPerDay = sgRate === null ? null : -sgRate * 1000;
    let phase = 'perfil';
    if (!batch.isActive) phase = 'finalizado';
    else if (sgNow !== null && sgPts.length >= 6 && ptsPerDay !== null) {
        if (reachedFg && Math.abs(ptsPerDay) < 0.5) phase = 'terminada';
        else if (hoursSinceStart !== null && hoursSinceStart < 36 && (ptsPerDay < 2 || (metrics.attenuation ?? 0) < 10)) phase = 'inicio';
        else if (ptsPerDay >= 3) phase = 'ativa';
        else if (ptsPerDay >= 0.5) phase = 'desacelerando';
        else phase = 'estavel';
    }
    metrics.phase = phase;
    const stepText = step ? `${step.name || `Etapa ${stepIdx + 1}`} (etapa ${stepIdx + 1} de ${profile.length}, alvo ${fmtTemp(Number(step.temperature))})` : 'sem perfil de etapas';
    if (phase === 'perfil') sec.fase.push(`${stepText}. Sem densímetro, a fase é acompanhada pelo tempo das etapas.`);
    else if (phase === 'finalizado') sec.fase.push('Lote finalizado.');
    else sec.fase.push(`${PHASES[phase]}: ${stepText}.`);
    if (batch.isPaused) sec.fase.push('O perfil está pausado: a previsão só volta a correr quando você retomar.');

    // --- Diario e historico ---
    const diary = (Array.isArray(events) ? events : []).filter((e) => e && e.type);
    const hasDryHop = diary.some((e) => /dry ?hop/i.test(`${e.type} ${e.description || ''}`));
    if (diary.length) {
        const lastEv = diary[diary.length - 1];
        sec.fase.push(`Diário: ${diary.length} ${diary.length === 1 ? 'anotação' : 'anotações'}; a última foi ${lastEv.type}${lastEv.at ? ` há ${fmtDays((now - lastEv.at) / DAY)}` : ''}.`);
    }
    const hist = (Array.isArray(history) ? history : []).filter((h) => Number.isFinite(h.days) && h.days >= 3);
    if (hist.length && style) {
        const avgDays = hist.reduce((a, h) => a + h.days, 0) / hist.length;
        const atts = hist.filter((h) => Number.isFinite(h.attenuation));
        const avgAtt = atts.length ? Math.round(atts.reduce((a, h) => a + h.attenuation, 0) / atts.length) : null;
        sec.fermentacao.push(`Seus ${hist.length} ${hist.length === 1 ? 'lote anterior' : 'lotes anteriores'} de ${style.label} levaram em média ${fmtDays(avgDays)}${avgAtt !== null ? ` e atenuaram ${avgAtt}%` : ''}.`);
        metrics.historyBatches = hist.length;
    }

    // --- Proximos passos (momento certo de agir) ---
    if (batch.isActive && !stale && !sensorMissing && !stalled) {
        const att = metrics.attenuation;
        const hasDiacetylStep = later.some((s) => /diacet/.test(stepName(s)));
        const coldLater = later.find((s) => Number(s.temperature) <= 4 || /cold|crash|lager|matura/.test(stepName(s)));
        if (style?.diacetylRest && isFermentStep && att !== undefined && att >= 70 && phase !== 'terminada') {
            nextSteps.push(hasDiacetylStep
                ? { text: 'Atenuação passou de 70%: o perfil já tem o descanso de diacetil, deixe avançar (ou avance a etapa se a densidade já estiver perto da final).', when: 'em breve' }
                : { text: 'Atenuação passou de 70%: faça o descanso de diacetil (subir para 16–18 °C por 2–3 dias) antes de baixar a temperatura.', when: 'agora' });
        }
        if (style?.dryHop && !hasDryHop && att !== undefined && att >= 60 && att <= 85 && (phase === 'ativa' || phase === 'desacelerando')) {
            nextSteps.push({ text: 'Bom momento para o dry hop: no fim da fermentação ativa, o fermento ainda consome o oxigênio que entra e o risco de oxidação é menor.', when: 'agora' });
        }
        const stable48 = sgRate !== null && Math.abs(sgRate) < 0.001 && sgPts.length >= 24;
        if ((reachedFg || phase === 'terminada' || (stable48 && !fg)) && isFermentStep) {
            nextSteps.push(coldLater
                ? { text: `Densidade estável: pode avançar o perfil para "${coldLater.name}" e clarificar a cerveja.`, when: 'agora' }
                : { text: 'Densidade estável há 2 dias: hora do cold crash (0–2 °C por 1–3 dias) para clarificar antes de envasar.', when: 'agora' });
        }
        if (prediction && phase !== 'terminada' && !reachedFg && prediction.daysToFg > 0.5) {
            nextSteps.push({ text: `Medir de novo: a densidade deve estabilizar em cerca de ${fmtDays(prediction.daysToFg)}.`, when: fmtDays(prediction.daysToFg) });
        }
    }
    if (batch.isActive && !nextSteps.length) nextSteps.push({ text: 'Nada a fazer agora: deixe o perfil seguir.', when: '' });

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
        remaining = cur + later.reduce((a, s) => a + Number(s.duration || 0), 0);
        metrics.step = { index: stepIdx + 1, total: profile.length, name: step.name || `Etapa ${stepIdx + 1}`, target: Number(step.temperature) };
    } else if (fg && sgNow !== null && sgRate !== null && sgRate < -0.0005 && sgNow > fg) {
        remaining = (sgNow - fg) / -sgRate; // sem perfil: so a densidade
    }
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

    const sections = [
        { key: 'fase', title: 'Fase atual', items: sec.fase },
        { key: 'temperatura', title: 'Temperatura', items: sec.temperatura },
        { key: 'fermentacao', title: 'Fermentação', items: sec.fermentacao },
        { key: 'equipamento', title: 'Equipamento', items: sec.equipamento },
    ].filter((s) => s.items.length);

    return {
        summary: summary.trim(),
        health_score: score,
        estimated_completion_days: estimated,
        risk_level: risk,
        // Lista unica (app e site antigos): equipamento primeiro, que e o que pede acao
        insights: [...sec.equipamento, ...sec.temperatura, ...sec.fermentacao, ...sec.fase],
        ideal_curve: idealCurve,
        phase: { key: phase, label: PHASES[phase] },
        style: style ? { key: style.key, label: style.label, temp: style.temp, attenuation: style.att } : null,
        predicted_fg: prediction ? prediction.fg : null,
        predicted_fg_days: prediction ? Math.round(prediction.daysToFg * 10) / 10 : null,
        sections,
        next_steps: nextSteps,
        metrics,
    };
};
