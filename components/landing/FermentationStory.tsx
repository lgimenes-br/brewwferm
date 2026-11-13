import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell } from 'lucide-react';

// "A curva é a página": secao fixa em que a rolagem desenha a curva de um lote de exemplo, do Dia 1 ao 10.
// Uma leitura de instrumento acompanha a ponta da linha e cada recurso aparece no ponto da curva onde acontece.
// Dados sinteticos (lote de exemplo), rotulados na tela. Movimento reduzido: tudo estatico, capitulos em lista.

const DAYS = 10;
const W = 1400;
const H = 520;
const TOP = 36;
const BOTTOM = 44;
const T_MAX = 25;

const STEPS = [
    { from: 0, to: 5, temp: 18, name: 'Primária' },
    { from: 5, to: 7, temp: 22, name: 'Diacetil' },
    { from: 7, to: 10, temp: 2, name: 'Cold crash' },
];
const ALERT_DAY = 3.15;

const target = (d: number) => (STEPS.find(s => d < s.to) ?? STEPS[STEPS.length - 1]).temp;
const xOf = (d: number) => (d / DAYS) * W;
const yOf = (t: number) => TOP + ((T_MAX - t) / T_MAX) * (H - TOP - BOTTOM);

type Sample = { d: number; t: number; sg: number };

/** Lote de exemplo: mosto entra a 20 °C, o controlador segue o alvo com atraso real; susto de calor no Dia 3 */
const simulate = (): Sample[] => {
    const out: Sample[] = [];
    const dt = 0.04;
    let t = 20;
    for (let d = 0; d <= DAYS + 1e-9; d += dt) {
        const goal = target(d);
        const tau = goal < t - 3 ? 0.55 : 0.32; // resfriar a 2 °C demora mais
        t += (goal - t) * Math.min(1, dt / tau);
        const bump = 1.6 * Math.exp(-(((d - ALERT_DAY) / 0.11) ** 2));
        const sg = 1.012 + 0.038 * Math.exp(-Math.max(0, d - 0.5) / 1.25);
        out.push({ d, t: t + bump, sg });
    }
    return out;
};

const CHAPTERS = [
    {
        from: 0, title: 'Segue o perfil sozinho',
        text: 'Monte as etapas uma vez. O controlador liga o aquecimento ou a geladeira e troca de etapa na hora certa, sem você por perto.',
        art: 'steps' as const,
    },
    {
        from: 2.6, title: 'Avisa antes de virar problema',
        text: 'Dia quente, porta aberta, aparelho desligado: o celular avisa na hora, e o controlador já está corrigindo.',
        art: 'alert' as const,
    },
    {
        from: 5, title: 'Acompanha a densidade',
        text: 'Com um iSpindel, o densímetro que boia no mosto, você vê o açúcar virar álcool e sabe quando a fermentação terminou.',
        art: 'gravity' as const,
    },
    {
        from: 7, title: 'Guarda cada lote',
        text: 'Curva, eventos e notas ficam no histórico para comparar e repetir. E um link deixa os amigos acompanharem ao vivo, sem conta.',
        art: 'history' as const,
    },
];

const fmt = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const ChapterArt: React.FC<{ art: typeof CHAPTERS[number]['art'] }> = ({ art }) => {
    if (art === 'steps') return (
        <ol className="mt-5 flex flex-wrap gap-2 text-sm" aria-label="Perfil do lote de exemplo">
            {STEPS.map((s, i) => (
                <li key={s.name} className={`rounded-full px-3 py-1.5 ${i === 0 ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-white text-[var(--muted)]'}`}>
                    {s.name} · {s.temp}°C · {s.to - s.from} {s.to - s.from === 1 ? 'dia' : 'dias'}
                </li>
            ))}
        </ol>
    );
    if (art === 'alert') return (
        <div className="mt-5 flex max-w-sm items-start gap-3 rounded-2xl bg-white p-4 shadow-[0_18px_40px_-28px_rgba(11,13,18,0.5)]" aria-hidden>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--accent)]"><Bell size={16} /></span>
            <div className="min-w-0 text-sm">
                <p className="font-medium">Fermentador · Pilsen da casa</p>
                <p className="text-[var(--muted)]">19,6 °C, 1,6° acima do alvo. Corrigindo.</p>
            </div>
        </div>
    );
    if (art === 'gravity') return (
        <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums" aria-hidden>
            <span className="[font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] text-[var(--muted)]">1,050</span>
            <ArrowRight size={18} className="text-[var(--muted)]" />
            <span className="[font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em]">1,012</span>
            <span className="whitespace-nowrap text-sm text-[var(--muted)]">estável há 2 dias</span>
        </p>
    );
    return (
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-[#2fbf55]" /><span className="font-medium">Ao vivo</span><span className="text-[var(--muted)]">Pilsen da casa · lote 07</span>
        </p>
    );
};

/** Curva (alvo em degraus, linha fantasma, linha desenhada ate `day`, marcas de etapa e de alerta) */
const Chart: React.FC<{ samples: Sample[]; clipRef?: React.Ref<SVGRectElement>; alertRef?: React.Ref<SVGGElement>; full?: boolean }> = ({ samples, clipRef, alertRef, full }) => {
    const line = useMemo(() => samples.map((s, i) => `${i ? 'L' : 'M'}${xOf(s.d).toFixed(1)} ${yOf(s.t).toFixed(1)}`).join(' '), [samples]);
    const area = `${line} L${W} ${H - BOTTOM} L0 ${H - BOTTOM} Z`;
    const steps = STEPS.map((s, i) => `${i ? 'L' : 'M'}${xOf(s.from)} ${yOf(s.temp)} H${xOf(s.to)}`).join(' ');
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img"
            aria-label="Curva de um lote de exemplo: o controlador segue 18 °C por 5 dias, corrige um susto de calor no dia 3, sobe para 22 °C no diacetil e desce para 2 °C no cold crash.">
            <defs>
                <linearGradient id="fs-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#71FC8F" stopOpacity="0.42" />
                    <stop offset="1" stopColor="#71FC8F" stopOpacity="0" />
                </linearGradient>
                <clipPath id="fs-drawn"><rect ref={clipRef} x="0" y="-40" width={full ? W : 0} height={H + 80} /></clipPath>
            </defs>
            {/* eixo dos dias */}
            <line x1="0" x2={W} y1={H - BOTTOM} y2={H - BOTTOM} stroke="rgba(11,13,18,0.18)" vectorEffect="non-scaling-stroke" />
            {/* alvo em degraus */}
            <path d={steps} fill="none" stroke="#0B0D12" strokeOpacity="0.5" strokeWidth="2.5" strokeDasharray="9 9" vectorEffect="non-scaling-stroke" />
            {/* linha fantasma: o lote inteiro, apagado */}
            <path d={line} fill="none" stroke="#2fbf55" strokeOpacity="0.22" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            {/* linha desenhada pela rolagem */}
            <g clipPath="url(#fs-drawn)">
                <path d={area} fill="url(#fs-fill)" />
                <path d={line} fill="none" stroke="#1fa84a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
            {/* marca do alerta */}
            <g ref={alertRef} style={{ opacity: full ? 1 : 0, transition: 'opacity .3s' }}>
                <line x1={xOf(ALERT_DAY)} x2={xOf(ALERT_DAY)} y1={yOf(19.6) - 14} y2={H - BOTTOM} stroke="#0B0D12" strokeOpacity="0.25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </g>
        </svg>
    );
};

/** Ponta da linha em HTML (no SVG esticado o circulo viraria oval) */
const Head = React.forwardRef<HTMLDivElement, { at?: Sample }>(({ at }, ref) => (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 h-0 w-0" style={at ? { left: `${(xOf(at.d) / W) * 100}%`, top: `${(yOf(at.t) / H) * 100}%` } : undefined} aria-hidden>
        <span className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-[#71FC8F]/35" />
        <span className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border-[3px] border-[#EEEFF1] bg-[#1fa84a]" />
    </div>
));
Head.displayName = 'Head';

/** Rotulos do grafico em HTML (nao distorcem com o SVG esticado) */
const ChartLabels: React.FC<{ alertLabelRef?: React.Ref<HTMLSpanElement>; full?: boolean }> = ({ alertLabelRef, full }) => (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span ref={alertLabelRef} className="absolute -translate-x-1/2 -translate-y-[170%] whitespace-nowrap rounded-full bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-white transition-opacity duration-300 sm:text-sm"
            style={{ left: `${(ALERT_DAY / DAYS) * 100}%`, top: `${(yOf(19.6) / H) * 100}%`, opacity: full ? 1 : 0 }}>alerta · 19,6°</span>
        {STEPS.map(s => (
            <span key={s.name} className="absolute -translate-y-[140%] whitespace-nowrap pl-3 text-sm font-medium text-[var(--ink)]/70 sm:text-lg"
                style={{ left: `${((s.from + (s.from === 0 ? 0.7 : 0)) / DAYS) * 100}%`, top: `${(yOf(s.temp) / H) * 100}%` }}>
                {s.name} {s.temp}°
            </span>
        ))}
        {Array.from({ length: DAYS }, (_, i) => i + 1).map(d => (
            <span key={d} className={`absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-[var(--muted)] sm:text-xs ${d % 2 ? 'max-sm:hidden' : ''}`} style={{ left: `${((d - 0.5) / DAYS) * 100}%` }}>
                Dia {d}
            </span>
        ))}
    </div>
);

const Hero: React.FC<{ ctaRef?: React.Ref<HTMLDivElement> }> = ({ ctaRef }) => (
    <>
        <h1 className="max-w-[22ch] text-balance [font-family:var(--font-display)] text-[44px] font-light leading-[0.98] tracking-[-0.035em] sm:text-7xl lg:text-[84px]">
            Cada dia do seu lote, na <span className="landing-mark">temperatura certa</span>.
        </h1>
        <div ref={ctaRef} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/instalar" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium text-white hover:bg-black">
                Monte o seu controlador <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#pronto" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-[var(--bg)]/70 px-6 text-[15px] font-medium backdrop-blur-sm hover:bg-white">Prefiro o pronto</a>
            <Link to="/register" className="hidden min-h-11 items-center justify-center text-sm sm:inline-flex text-[var(--muted)] underline decoration-current/30 underline-offset-4 hover:text-[var(--ink)] sm:ml-2">Já tenho o aparelho</Link>
        </div>
        <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--muted)] max-sm:hidden sm:text-lg">
            O Breww controla a geladeira da fermentação, segue o perfil do lote sozinho e avisa no celular quando algo sai do ponto. Monte o seu com um ESP32, direto pelo navegador.
        </p>
    </>
);

// Malha milimetrada: so nesta secao, como o papel do grafico
const paperGrid = {
    backgroundImage: 'linear-gradient(rgba(11,13,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,18,0.05) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
} as const;
const grid = paperGrid;

const useReducedMotion = () => {
    const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (!mq) return;
        const on = () => setReduced(mq.matches);
        mq.addEventListener?.('change', on);
        return () => mq.removeEventListener?.('change', on);
    }, []);
    return reduced;
};

export const FermentationStory: React.FC<{ onHeroGone?: (gone: boolean) => void }> = ({ onHeroGone }) => {
    const samples = useMemo(simulate, []);
    const reduced = useReducedMotion();
    const section = useRef<HTMLElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const heroBox = useRef<HTMLDivElement>(null);
    const readout = useRef<HTMLDivElement>(null);
    const clip = useRef<SVGRectElement>(null);
    const head = useRef<HTMLDivElement>(null);
    const alertMark = useRef<SVGGElement>(null);
    const chartBox = useRef<HTMLDivElement>(null);
    const alertLabel = useRef<HTMLSpanElement>(null);
    const dayEl = useRef<HTMLSpanElement>(null);
    const tempEl = useRef<HTMLSpanElement>(null);
    const targetEl = useRef<HTMLSpanElement>(null);
    const statusEl = useRef<HTMLSpanElement>(null);
    const sgEl = useRef<HTMLSpanElement>(null);
    const [chapter, setChapter] = useState(0);
    const goneRef = useRef(false);

    useEffect(() => {
        if (reduced) return;
        let raf = 0;
        let lastChapter = -1;
        const update = () => {
            raf = 0;
            const el = section.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const span = el.offsetHeight - window.innerHeight;
            const p = clamp(-rect.top / Math.max(1, span));
            // titulo sobe e some (parallax); leitura entra
            const heroP = clamp(p / 0.09);
            if (heroBox.current) {
                heroBox.current.style.opacity = String(1 - heroP);
                heroBox.current.style.transform = `translate3d(0, ${-heroP * 90}px, 0)`;
                heroBox.current.style.visibility = heroP >= 1 ? 'hidden' : 'visible';
            }
            const inP = clamp((p - 0.06) / 0.05);
            if (readout.current) {
                readout.current.style.opacity = String(inP);
                readout.current.style.transform = `translate3d(0, ${(1 - inP) * 40}px, 0)`;
                readout.current.style.visibility = inP <= 0 ? 'hidden' : 'visible';
            }
            // o grafico sobe e cresce quando o titulo sai de cena
            if (chartBox.current) {
                const [from, to] = window.innerWidth >= 1024 ? [60, 44] : window.innerWidth >= 640 ? [60, 50] : [64, 62];
                chartBox.current.style.top = `${from - (from - to) * heroP}%`;
            }
            const gone = heroP >= 1;
            if (gone !== goneRef.current) { goneRef.current = gone; onHeroGone?.(gone); }
            // malha desliza mais devagar que a curva
            if (stage.current) stage.current.style.backgroundPosition = `${-p * 480}px 0, ${-p * 480}px 0`;
            // dia desenhado
            const day = 0.45 + clamp((p - 0.07) / 0.88) * (DAYS - 0.45);
            const i = Math.min(samples.length - 1, Math.round(day / 0.04));
            const s = samples[i];
            clip.current?.setAttribute('width', String(xOf(s.d)));
            if (head.current) { head.current.style.left = `${(xOf(s.d) / W) * 100}%`; head.current.style.top = `${(yOf(s.t) / H) * 100}%`; }
            if (alertMark.current) alertMark.current.style.opacity = day > ALERT_DAY ? '1' : '0';
            if (alertLabel.current) alertLabel.current.style.opacity = day > ALERT_DAY ? '1' : '0';
            const goal = target(s.d);
            const off = s.t - goal;
            if (dayEl.current) dayEl.current.textContent = `Dia ${Math.min(DAYS, Math.floor(s.d) + 1)} · ${String(Math.floor((s.d % 1) * 24)).padStart(2, '0')}h`;
            if (tempEl.current) tempEl.current.textContent = fmt(s.t, 1);
            if (targetEl.current) targetEl.current.textContent = `alvo ${goal} °C`;
            if (statusEl.current) {
                const ok = Math.abs(off) <= 0.5;
                statusEl.current.textContent = ok ? 'no alvo' : off > 0 ? 'resfriando' : 'aquecendo';
                statusEl.current.dataset.ok = ok ? '1' : '0';
            }
            if (sgEl.current) sgEl.current.textContent = fmt(s.sg, 3);
            let c = 0;
            CHAPTERS.forEach((ch, k) => { if (s.d >= ch.from) c = k; });
            if (c !== lastChapter) { lastChapter = c; setChapter(c); }
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
    }, [reduced, samples, onHeroGone]);

    // Movimento reduzido: o topo e a curva inteira, sem fixar; capitulos em lista
    if (reduced) {
        return (
            <section className="relative" style={grid}>
                <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 lg:pt-20"><Hero /></div>
                <div className="relative mx-auto h-[300px] max-w-6xl px-4 sm:h-[420px] sm:px-6">
                    <div className="relative h-full"><Chart samples={samples} full /><ChartLabels full /><Head at={samples[samples.length - 1]} /></div>
                </div>
                <p className="mx-auto max-w-6xl px-4 pt-4 text-xs text-[var(--muted)] sm:px-6">Lote de exemplo: Pilsen da casa.</p>
                <div id="recursos" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-20 sm:px-6 md:grid-cols-2">
                    {CHAPTERS.map(ch => (
                        <article key={ch.title}>
                            <h2 className="[font-family:var(--font-display)] text-3xl font-light tracking-[-0.03em]">{ch.title}</h2>
                            <p className="mt-2 max-w-md leading-relaxed text-[var(--muted)]">{ch.text}</p>
                            <ChapterArt art={ch.art} />
                        </article>
                    ))}
                </div>
            </section>
        );
    }

    const ch = CHAPTERS[chapter];
    return (
        <section ref={section} className="relative h-[460vh] sm:h-[520vh]" aria-label="Um lote do começo ao fim">
            <div ref={stage} className="sticky top-0 flex h-[100svh] flex-col overflow-hidden" style={grid}>
                {/* espaco do cabecalho fixo */}
                <div className="h-16 shrink-0" />
                <div className="relative mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
                    {/* topo: titulo (some) e leitura + capitulo (entram) no mesmo lugar */}
                    <div className="relative min-h-[52%] pt-6 sm:pt-10">
                        <div ref={heroBox} className="absolute inset-x-0 top-6 will-change-transform sm:top-10"><Hero /></div>
                        <div ref={readout} className="invisible grid gap-6 opacity-0 will-change-transform lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
                            <div className="on-dark flex items-end justify-between gap-4 rounded-3xl bg-[var(--card)] px-5 py-4 text-white shadow-[0_30px_60px_-35px_rgba(11,13,18,0.7)] sm:px-7 sm:py-6 lg:block" aria-live="off">
                                <div>
                                    <p className="flex items-center gap-2 text-sm text-[#a3a7b0]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /><span ref={dayEl} className="whitespace-nowrap tabular-nums">Dia 1 · 00h</span><span className="max-sm:hidden"> · Pilsen da casa</span></p>
                                    <p className="mt-2 flex items-start gap-1 [font-family:var(--font-display)] font-light leading-none tracking-[-0.04em]">
                                        <span ref={tempEl} className="text-[56px] tabular-nums sm:text-[96px]">20,0</span>
                                        <span className="mt-1.5 text-lg text-[#a3a7b0] sm:text-2xl">°C</span>
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 text-sm lg:mt-5 lg:flex-row lg:items-center lg:gap-4 lg:border-t lg:border-white/10 lg:pt-4">
                                    <span ref={statusEl} data-ok="1" className="rounded-full bg-[var(--accent)]/15 px-3 py-1 text-[var(--accent)] data-[ok=0]:bg-white/10 data-[ok=0]:text-white">no alvo</span>
                                    <span ref={targetEl} className="tabular-nums text-[#a3a7b0]">alvo 18 °C</span>
                                    <span className="whitespace-nowrap tabular-nums text-[#a3a7b0]">densidade <span ref={sgEl}>1,050</span></span>
                                </div>
                            </div>
                            <div key={chapter} className="landing-chapter max-lg:hidden">
                                <h2 className="text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em]">{ch.title}</h2>
                                <p className="mt-3 max-w-lg text-pretty text-lg leading-relaxed text-[var(--muted)]">{ch.text}</p>
                                <ChapterArt art={ch.art} />
                            </div>
                            <div key={`m-${chapter}`} className="landing-chapter lg:hidden">
                                <h2 className="text-balance [font-family:var(--font-display)] text-[28px] font-light leading-[1.05] tracking-[-0.03em]">{ch.title}</h2>
                                <p className="mt-1.5 text-pretty text-[15px] leading-snug text-[var(--muted)]">{ch.text}</p>
                                <div className="origin-top-left max-sm:scale-90"><ChapterArt art={ch.art} /></div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* a curva, de ponta a ponta da tela */}
                <div ref={chartBox} className="absolute inset-x-0 bottom-24 top-[64%] sm:bottom-12 sm:top-[60%]">
                    <div className="relative h-full"><Chart samples={samples} clipRef={clip} alertRef={alertMark} /><ChartLabels alertLabelRef={alertLabel} /><Head ref={head} /></div>
                </div>
                <p className="absolute bottom-[4.5rem] right-4 text-[11px] text-[var(--muted)] sm:bottom-3 sm:right-6">Lote de exemplo</p>
            </div>
            {/* ancoras dos capitulos para o menu e para leitores de tela */}
            <div id="recursos" className="absolute left-0 top-[18%] h-px w-px" aria-hidden />
            <div className="sr-only">
                {CHAPTERS.map(c => <p key={c.title}><strong>{c.title}.</strong> {c.text}</p>)}
            </div>
        </section>
    );
};
