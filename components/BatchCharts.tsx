import React, { useId, useMemo, useState } from 'react';
import { Area, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { EventType, FermentationEvent, Reading, getEventReferenceMarks, isPlausibleGravity } from '../types';
import { extraSensorKeys, prepareTemperatureData } from './chartData';

// Graficos do lote no mesmo formato do app (breww-app/src/components/BatchChart.tsx):
// um cartao com a temperatura em destaque, o grafico de temperatura, o de densidade e os periodos
// "Ao vivo" (as ultimas 10 leituras), 12H, 24H e Tudo. Eixo X em tempo real; nos periodos longos a
// curva e suavizada (media movel) e os valores exatos ficam no cabecalho e no toque.

const LIVE_POINTS = 10;
type Range = { label: string; ms: number; live?: boolean };
const LIVE: Range = { label: 'Ao vivo', ms: 0, live: true };
const TIME_RANGES: Range[] = [
    { label: '12H', ms: 12 * 3600000 },
    { label: '24H', ms: 24 * 3600000 },
    { label: 'Tudo', ms: Infinity },
];

const C = { beer: '#71FC8F', fridge: '#6B6F78', target: 'rgba(236,236,241,0.45)', grid: 'rgba(255,255,255,0.06)', axis: '#6B6F78' };
const EXTRA_COLORS = ['#A3A7B0', '#C9CCD3', '#4A4F59', '#898E99'];

interface Point { t: number; beer: number; fridge: number | null; target: number | null; gravity: number | null; beerS: number; fridgeS: number | null; [extra: string]: number | null }

/** Media movel centrada (janela impar); null fica null */
const smooth = (vals: (number | null)[], win: number): (number | null)[] => {
    if (win <= 1) return vals;
    const half = Math.floor(win / 2);
    return vals.map((v, i) => {
        if (v === null) return null;
        let sum = 0, n = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(vals.length - 1, i + half); j++) {
            const x = vals[j];
            if (x !== null) { sum += x; n++; }
        }
        return n ? sum / n : v;
    });
};

const two = (n: number) => String(n).padStart(2, '0');
const fmtTick = (t: number, span: number) => {
    const d = new Date(t);
    if (span < 30 * 60000) return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
    if (span <= 36 * 3600000) return `${two(d.getHours())}:${two(d.getMinutes())}`;
    if (span <= 7 * 86400000) return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}h`; // dias: sem rotulos repetidos
    return `${two(d.getDate())}/${two(d.getMonth() + 1)}`;
};
const fmtWhen = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const BatchCharts: React.FC<{
    readings: Reading[];
    events?: FermentationEvent[];
    sensor1Name?: string;
    sensor2Name?: string;
    sensorSgName?: string;
    /** Nomes dos sensores 3 e 4 (linhas extra_s3 / extra_s4) */
    sensor3Name?: string;
    sensor4Name?: string;
    /** Linhas escondidas pelo usuario (Ajustes > No grafico): 's1'..'s4', 'sg' */
    hidden?: string[];
    /** Densidade final alvo do lote (mostrada como o "alvo" da densidade) */
    fg?: number;
    /** Lote em andamento: mostra o "Ao vivo" (as ultimas 10 leituras) */
    live?: boolean;
    className?: string;
}> = ({ fg, hidden = [], sensor3Name = 'Sensor 3', sensor4Name = 'Sensor 4', className = '', readings, events = [], sensor1Name = 'Fermentador', sensor2Name = 'Geladeira', sensorSgName = 'Densidade', live = false }) => {
    const ranges = live ? [LIVE, ...TIME_RANGES] : TIME_RANGES;
    const [rangeIdx, setRangeIdx] = useState(0);
    const fillId = `beerFill-${useId().replace(/:/g, '')}`; // varios graficos na pagina: ids unicos
    const range = ranges[Math.min(rangeIdx, ranges.length - 1)];

    const all = useMemo(() => prepareTemperatureData(readings, Infinity), [readings]);

    const { data, span, extras, hasGravity, min, max } = useMemo(() => {
        const sorted = all
            .map(d => ({ ...d, t: new Date(d.timestamp).getTime() }))
            .filter(d => Number.isFinite(d.t))
            .sort((a, b) => a.t - b.t);
        let slice = sorted;
        if (range.live) slice = sorted.slice(-LIVE_POINTS);
        else if (Number.isFinite(range.ms) && sorted.length) {
            const end = sorted[sorted.length - 1].t;
            slice = sorted.filter(d => d.t >= end - range.ms);
        }
        const extraKeys = extraSensorKeys(slice).filter(k => !hidden.includes(k.replace('extra_', '')));
        const pts: Point[] = slice.map((d: any) => {
            const g = Number(d.gravity);
            const p: Point = {
                t: d.t,
                beer: d.beerTemp,
                fridge: Number.isFinite(d.fridgeTemp) ? d.fridgeTemp : null,
                target: Number.isFinite(d.targetTemp) ? d.targetTemp : null,
                // Densidade: qualquer leitura positiva aparece (como no app); 0 = sem leitura
                gravity: Number.isFinite(g) && g > 0 ? (g > 500 ? g / 1000 : g) : null,
                beerS: d.beerTemp,
                fridgeS: null,
            };
            extraKeys.forEach(k => { p[k] = typeof d[k] === 'number' ? d[k] : null; });
            return p;
        });
        // Ao vivo: as leituras como sao; nos periodos longos, media movel (curva redonda, sem degraus)
        const win = range.live ? 1 : Math.max(1, Math.round(pts.length / 20)) | 1;
        const bS = smooth(pts.map(p => p.beer), win);
        const fS = smooth(pts.map(p => p.fridge), win);
        pts.forEach((p, i) => { p.beerS = bS[i] as number; p.fridgeS = fS[i]; });
        const beers = pts.map(p => p.beer);
        return {
            data: pts,
            span: pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : 0,
            extras: extraKeys,
            hasGravity: pts.some(p => p.gravity !== null),
            min: beers.length ? Math.min(...beers) : NaN,
            max: beers.length ? Math.max(...beers) : NaN,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [all, range, hidden.join(',')]);

    const extraName = (k: string) => k === 'extra_s3' ? sensor3Name : k === 'extra_s4' ? sensor4Name : k.replace('extra_', '');
    const last = data[data.length - 1];
    const show1 = !hidden.includes('s1');
    const show2 = !hidden.includes('s2');
    const showSg = !hidden.includes('sg');
    const yDomain = useMemo((): [number, number] | null => {
        const vals: number[] = [];
        data.forEach(p => {
            if (show1) vals.push(p.beerS);
            if (show2 && p.fridgeS !== null) vals.push(p.fridgeS);
            extras.forEach(k => { const v = p[k]; if (typeof v === 'number') vals.push(v); });
        });
        if (!vals.length) data.forEach(p => vals.push(p.beerS));
        if (!vals.length) return null;
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const pad = Math.max(0.2, (hi - lo) * 0.15);
        return [Math.floor((lo - pad) * 10) / 10, Math.ceil((hi + pad) * 10) / 10];
    }, [data, extras, show1, show2]);
    const targetNow = last?.target ?? null;
    const targetOff: 'below' | 'above' | null = !yDomain || targetNow === null ? null : targetNow < yDomain[0] ? 'below' : targetNow > yDomain[1] ? 'above' : null;
    const lastGravity = [...data].reverse().find(p => p.gravity !== null)?.gravity ?? null;
    const gVals = data.map(p => p.gravity).filter((g): g is number => g !== null);
    const gMax = gVals.length ? Math.max(...gVals) : null;
    const gMin = gVals.length ? Math.min(...gVals) : null;
    const marks = useMemo(() => getEventReferenceMarks(data.map(p => ({ timestamp: new Date(p.t).toISOString() })), events.filter(e => e.type !== EventType.SYSTEM_ACTION))
        .map(m => ({ ...m, x: new Date(m.markTime).getTime() })), [data, events]);

    const xAxis = (
        <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={t => fmtTick(Number(t), span)}
            stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} dy={8} minTickGap={40} />
    );
    const tooltipBase = {
        contentStyle: { backgroundColor: '#20252F', borderColor: 'rgba(255,255,255,0.10)', color: '#ECECF1', borderRadius: '16px', padding: '10px 12px' },
        itemStyle: { color: '#ECECF1', fontSize: '12px' },
        labelStyle: { color: '#898E99', fontSize: '11px', marginBottom: '6px' },
        labelFormatter: (t: any) => fmtWhen(Number(t)),
        cursor: { stroke: 'rgba(255,255,255,0.35)', strokeWidth: 0.5, strokeDasharray: '4 4' },
    };

    return (
        <section className={`app-card p-5 sm:p-6 flex flex-col gap-5 min-w-0 ${className}`} aria-label="Gráficos do lote">
            {/* Cabecalho: leitura em destaque do periodo */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-2 text-[14px] text-[var(--muted)]">
                        {range.live && <span aria-hidden className="w-[7px] h-[7px] rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />}
                        {range.live ? 'Ao vivo' : range.label === 'Tudo' ? 'Lote inteiro' : `Últimas ${range.label.replace('H', ' horas')}`}
                    </span>
                    <div className="flex items-end gap-3">
                        <span className="text-[48px] font-light leading-none tabular text-[var(--ink)]">{last ? last.beer.toFixed(1) : '--'}<span className="text-[18px] text-[var(--muted)] align-top ml-1">°C</span></span>
                        {last?.target !== null && last?.target !== undefined && <span className="pb-1.5 text-[15px] text-[var(--muted)]">alvo {last.target.toFixed(1)}°C</span>}
                    </div>
                </div>
                {Number.isFinite(max) && (
                    <div className="ml-auto text-right text-[14px] text-[var(--muted)] tabular leading-relaxed">
                        <div>máx {max.toFixed(1)}°C</div>
                        <div>mín {min.toFixed(1)}°C</div>
                    </div>
                )}
            </div>

            {data.length < 2 ? (
                <p className="h-[260px] flex items-center justify-center text-center text-[15px] text-[var(--muted)]">Ainda não há leituras suficientes para o gráfico.</p>
            ) : (
                <div className="relative w-full h-[260px] lg:h-auto lg:min-h-[260px] lg:flex-1 min-w-0" /* cresce quando o cartao estica para alinhar com o diario */>
                    {targetOff && targetNow !== null && (
                        <span className={`absolute left-1 ${targetOff === 'below' ? 'bottom-9' : 'top-2'} z-10 inline-flex items-center gap-1.5 px-3 min-h-8 rounded-full border border-[var(--line)] bg-[var(--cell)] text-[13px] text-[var(--muted)] tabular`}>
                            {targetOff === 'below' ? '↓' : '↑'} Alvo {targetNow.toFixed(1)}°C
                        </span>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
                            <defs>
                                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0" stopColor={C.beer} stopOpacity={0.18} />
                                    <stop offset="1" stopColor={C.beer} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke={C.grid} vertical={false} />
                            {xAxis}
                            <YAxis orientation="right" domain={yDomain ?? ['auto', 'auto']} allowDataOverflow
                                tickFormatter={v => `${Number(v).toFixed(1)}°C`} stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} width={56} />
                            <Tooltip {...tooltipBase} formatter={(v: any, name: any) => [`${Number(v).toFixed(1)}°C`, name]} />
                             {show1 && <Area type="monotone" dataKey="beerS" stroke="none" fill={`url(#${fillId})`} isAnimationActive={false} tooltipType="none" />}
                            {!targetOff && <Line type="monotone" dataKey="target" name="Alvo" stroke={C.target} strokeDasharray="4 4" strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />}
                            {extras.map((k, i) => (
                                <Line key={k} type="monotone" dataKey={k} name={extraName(k)} stroke={EXTRA_COLORS[i % EXTRA_COLORS.length]} strokeWidth={1.2} dot={false} isAnimationActive={false} />
                            ))}
                            {show2 && <Line type="monotone" dataKey="fridgeS" name={sensor2Name} stroke={C.fridge} strokeWidth={1.5} dot={false} opacity={0.8} isAnimationActive={false} connectNulls />}
                            {show1 && <Line type="monotone" dataKey="beerS" name={sensor1Name} stroke={C.beer} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: C.beer }} isAnimationActive={false} />}
                            {marks.map(m => <ReferenceLine key={m.id} x={m.x} stroke={C.axis} strokeDasharray="4 4" strokeWidth={1} label={{ value: m.type, position: 'top', fill: C.axis, fontSize: 10 }} />)}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Legenda */}
            <div className="flex flex-wrap gap-2">
                {show1 && <LegendPill color={C.beer} label={sensor1Name} />}
                {show2 && <LegendPill color={C.fridge} label={sensor2Name} />}
                {extras.map((k, i) => <LegendPill key={k} color={EXTRA_COLORS[i % EXTRA_COLORS.length]} label={extraName(k)} />)}
                <LegendPill color={C.target} label="Alvo" dashed />
            </div>

            {/* Densidade: qualquer leitura aparece; fora da faixa de mosto vem avisado */}
            {hasGravity && showSg && (
                <div className="flex flex-col gap-3">
                    {/* Mesmo padrao do cabecalho da temperatura: nome, valor grande, o alvo (FG) ao lado e max/min */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-2 text-[14px] text-[var(--muted)]"><span aria-hidden className="w-[7px] h-[7px] rounded-full bg-[var(--accent)]" />{sensorSgName}</span>
                            <div className="flex items-end gap-3">
                                <span className="text-[48px] font-light leading-none tabular text-[var(--ink)]">{lastGravity !== null ? lastGravity.toFixed(3) : '--'}{lastGravity !== null && <span className="text-[18px] text-[var(--muted)] align-top ml-1">SG</span>}</span>
                                {fg !== undefined && fg > 0 && <span className="pb-1.5 text-[15px] text-[var(--muted)] tabular">alvo FG {fg.toFixed(3)}</span>}
                            </div>
                        </div>
                        {gMax !== null && gMin !== null && (
                            <div className="ml-auto text-right text-[14px] text-[var(--muted)] tabular leading-relaxed">
                                <div>máx {gMax.toFixed(3)}</div>
                                <div>mín {gMin.toFixed(3)}</div>
                            </div>
                        )}
                    </div>
                    {lastGravity !== null && !isPlausibleGravity(lastGravity) && (
                        <p className="text-[13px] text-[var(--muted)]">Fora da faixa de mosto (0,980 a 1,200): o densímetro parece estar fora do líquido ou descalibrado.</p>
                    )}
                    <div className="w-full h-[160px] min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
                                <CartesianGrid stroke={C.grid} vertical={false} />
                                {xAxis}
                                <YAxis orientation="right" domain={['auto', 'auto']} tickFormatter={v => Number(v).toFixed(3)} stroke={C.axis} fontSize={11} tickLine={false} axisLine={false} width={56} />
                                <Tooltip {...tooltipBase} formatter={(v: any) => [Number(v).toFixed(3), sensorSgName]} />
                                <Line type="monotone" dataKey="gravity" name={sensorSgName} stroke={C.beer} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Periodos */}
            <div role="tablist" aria-label="Período do gráfico" className="mt-auto grid gap-1 p-1 rounded-full border border-[var(--line)]" style={{ gridTemplateColumns: `repeat(${ranges.length}, minmax(0, 1fr))` }}>
                {ranges.map((r, i) => {
                    const on = r === range;
                    return (
                        <button key={r.label} type="button" role="tab" aria-selected={on} onClick={() => setRangeIdx(i)}
                            className={`min-h-10 rounded-full text-[15px] transition-colors ${on ? 'bg-[var(--cell-2)] text-[var(--ink)] border border-[var(--line)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                            {r.label}
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

function LegendPill({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
    return (
        <span className="inline-flex items-center gap-2 px-3 min-h-8 rounded-full border border-[var(--line)] text-[13px] text-[var(--ink)]">
            <span aria-hidden className="w-4 h-0" style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
            {label}
        </span>
    );
}
