import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, Cpu, Loader2, Thermometer, ToggleRight, Usb, Wifi, Smartphone } from 'lucide-react';
import { API_URL } from '../../config';
import { useScrollVar } from './useScrollVar';

// Blocos da home depois da curva: a linha verde como fio condutor, paineis de instrumento em Grafite e camadas
// que andam em velocidades diferentes com a rolagem (--p). Sem malha (so na secao da curva); cada secao tem
// seu tom de cinza: montagem quase branca, codigo em Grafite, projecao em Nevoa, precos mais fundo, fecho em Tinta.

type PVar = React.CSSProperties & { [k: `--${string}`]: string | number };

const textLink = 'group inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium underline decoration-current/30 underline-offset-[5px] hover:decoration-current';
const h2 = 'text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-6xl';

// ---------- Lista de espera ----------
export const WaitlistForm: React.FC<{ interest: 'pronto' | 'pro'; dark?: boolean; cta: string }> = ({ interest, dark, cta }) => {
    const [email, setEmail] = useState('');
    const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const id = `lista-${interest}`;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setState('sending');
        try {
            const res = await fetch(`${API_URL}/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, interest }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(res.status === 400 && data.error ? data.error : 'Não foi possível registrar agora. Tente de novo em instantes.');
            setState('done');
        } catch (err: any) {
            setMessage(err?.message || 'Não foi possível registrar agora. Tente de novo em instantes.');
            setState('error');
        }
    };

    if (state === 'done') {
        return (
            <p role="status" className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] ${dark ? 'bg-white/[0.06] text-white' : 'bg-white text-[var(--ink)]'}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--ink)]"><Check size={15} strokeWidth={2.5} /></span>
                Pronto. Avisamos em {email} assim que sair.
            </p>
        );
    }
    return (
        <form onSubmit={submit} noValidate>
            <label htmlFor={id} className="sr-only">Seu e-mail</label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    id={id} type="email" required autoComplete="email" inputMode="email" value={email}
                    onChange={e => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                    placeholder="seu@email.com" aria-invalid={state === 'error'} aria-describedby={state === 'error' ? `${id}-erro` : undefined}
                    className={`min-h-12 min-w-0 flex-1 rounded-full border px-5 text-[15px] outline-none transition-colors ${dark ? 'border-white/15 bg-white/[0.06] text-white placeholder:text-[#898E99] focus:border-white/40' : 'border-black/10 bg-white text-[var(--ink)] placeholder:text-black/35 focus:border-black/30'}`}
                />
                <button type="submit" disabled={state === 'sending'} className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium transition-colors disabled:opacity-60 ${dark ? 'bg-[var(--accent)] text-[var(--ink)] hover:brightness-95' : 'bg-[var(--ink)] text-white hover:bg-black'}`}>
                    {state === 'sending' ? <Loader2 size={18} className="animate-spin" /> : cta}
                </button>
            </div>
            {state === 'error' && <p id={`${id}-erro`} role="alert" className={`mt-2 px-1 text-sm ${dark ? 'text-[#ff8f9c]' : 'text-[#b4283a]'}`}>{message}</p>}
            <p className={`mt-3 px-1 text-[13px] ${dark ? 'text-[#a3a7b0]' : 'text-[var(--muted)]'}`}>
                Usamos o e-mail só para este aviso. <Link to="/privacidade" className="underline underline-offset-2">Privacidade</Link>
            </p>
        </form>
    );
};

// ---------- 1. Antes do Dia 1: a instalacao como linha do tempo ----------
const INSTALL = [
    { icon: Usb, title: 'Ligue a placa no USB', text: 'No computador, com Chrome ou Edge.', screen: <p className="text-[15px] text-[#a3a7b0]">Aguardando placa…</p> },
    { icon: Cpu, title: 'O site reconhece a placa', text: 'E escolhe sozinho o firmware certo.', screen: <p className="text-[15px] text-white">ESP32-C3 <span className="text-[#a3a7b0]">detectado</span></p> },
    { icon: ArrowRight, title: 'Grava o Breww', text: 'Sem Arduino, sem compilar nada.', screen: (
        <div><div className="flex justify-between text-[15px]"><span className="text-white">Gravando</span><span className="tabular-nums text-[var(--accent)]">64%</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full w-[64%] rounded-full bg-[var(--accent)]" /></div></div>
    ) },
    { icon: Wifi, title: 'Wi-Fi pelo mesmo cabo', text: 'Escolha a rede e digite a senha ali mesmo.', screen: <p className="text-[15px] text-white">Casa <span className="text-[var(--accent)]">· conectado</span></p> },
    { icon: Smartphone, title: 'Aparece no app', text: 'Um toque e ele entra na sua conta.', screen: <p className="flex items-baseline gap-1 text-white"><span className="[font-family:var(--font-display)] text-3xl font-light tabular-nums">20,1</span><span className="text-sm text-[#a3a7b0]">°C · Fermentador</span></p> },
];
const PARTS = [
    { icon: Cpu, text: 'Placa ESP32 (DevKit, S3 ou C3)' },
    { icon: Thermometer, text: 'Sensor DS18B20 à prova d’água + resistor de 4,7 kΩ' },
    { icon: ToggleRight, text: 'Relé de 2 canais: aquecer e resfriar' },
    { icon: Usb, text: 'Cabo USB de dados, só para gravar' },
];

export const InstallTimeline: React.FC = () => {
    const ref = useScrollVar<HTMLElement>(0.15);
    return (
        <section id="monte" ref={ref} className="relative scroll-mt-16 bg-[#F7F7F8]" style={{ '--p': 0 } as PVar}>
            <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
                <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
                    <h2 className={h2}>Antes do Dia 1, <span className="text-[var(--muted)]">meia hora na bancada.</span></h2>
                    <p className="max-w-md text-pretty text-lg leading-relaxed text-[var(--muted)]">Um ESP32, um sensor e um relé. Ligue a placa no computador e o site faz o resto, sem instalar nenhum programa.</p>
                </div>

                {/* trilha: a linha verde se desenha com a rolagem; cada passo acende quando ela chega */}
                <ol className="relative mt-16 grid gap-6 max-lg:pl-10 lg:mt-20 lg:grid-cols-5 lg:gap-4">
                    <div className="absolute bottom-6 left-[15px] top-6 w-px bg-black/10 lg:bottom-auto lg:left-0 lg:right-0 lg:top-[15px] lg:h-px lg:w-auto" aria-hidden />
                    <div className="absolute bottom-6 left-[14px] top-6 w-[3px] origin-top rounded-full bg-[#1fa84a] [transform:scaleY(var(--p))] lg:bottom-auto lg:left-0 lg:right-0 lg:top-[14px] lg:h-[3px] lg:w-auto lg:origin-left lg:[transform:scaleX(var(--p))]" aria-hidden />
                    {INSTALL.map(({ icon: Icon, title, text, screen }, i) => (
                        <li key={title} className="relative" style={{ '--i': i } as PVar}>
                            <span className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-[#1fa84a] bg-[#F7F7F8] lg:relative lg:left-auto" aria-hidden>
                                <span className="absolute inset-0 rounded-full bg-[#1fa84a] [opacity:clamp(0,calc((var(--p)*5-var(--i))*3),1)]" />
                                <Icon size={15} className="relative text-[var(--ink)]" />
                            </span>
                            <div className="lg:mt-6 lg:[transform:translateY(calc((1-var(--p))*(28px+var(--i)*14px)))]">
                                <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                                <p className="mt-1 text-[15px] leading-relaxed text-[var(--muted)]">{text}</p>
                                <div className="mt-4 rounded-2xl bg-[var(--card)] px-4 py-3.5 shadow-[0_24px_40px_-30px_rgba(11,13,18,0.55)]" aria-hidden>{screen}</div>
                            </div>
                        </li>
                    ))}
                </ol>

                {/* o que precisa, como a legenda de um grafico */}
                <div className="mt-20 grid gap-10 border-t border-black/10 pt-10 lg:grid-cols-[1fr_auto] lg:items-center">
                    <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                        {PARTS.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3 text-[15px]">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg)]"><Icon size={17} strokeWidth={1.75} /></span>{text}
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-col items-start gap-2">
                        <Link to="/instalar" className="group inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium text-white hover:bg-black">
                            Ver o guia de montagem <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <span className="text-sm text-[var(--muted)]">Quer uma tela? Ligue uma OLED depois: o Breww reconhece sozinho.</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ---------- 2. Codigo aberto: matriz de compilacao (placas x versoes publicadas) ----------
const BOARDS = ['ESP32 DevKit', 'ESP32-S3 com tela 3,5"', 'ESP32-S3', 'ESP32-C3'];
const VERSIONS = ['2.9.0', '2.9.1', '2.9.2', '2.9.3', '2.9.4', '2.9.5', '2.9.6'];

export const OpenSource: React.FC = () => {
    const ref = useScrollVar<HTMLElement>(0.25);
    const total = BOARDS.length * VERSIONS.length;
    return (
        <section ref={ref} className="on-dark relative overflow-hidden bg-[var(--card)] text-white" style={{ '--p': 0 } as PVar}>
            <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
                <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
                    <h2 className={h2}>O código da placa é aberto. <span className="text-[var(--accent)]">De verdade.</span></h2>
                    <div>
                        <p className="max-w-md text-pretty text-lg leading-relaxed text-[#c9ccd3]">
                            Está no GitHub, sob a licença GPL-3.0: qualquer pessoa confere o que roda na sua geladeira, sugere melhorias e monta o seu. Cada versão é compilada nas 4 placas antes de sair.
                        </p>
                        <a href="https://github.com/lgimenes-br/breww-firmware" target="_blank" rel="noopener noreferrer" className={`mt-4 text-white ${textLink}`}>
                            Ver o código no GitHub <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </a>
                    </div>
                </div>

                {/* matriz: cada marca acende com a rolagem, versao a versao */}
                <div className="mt-16 overflow-hidden rounded-3xl border border-white/10 bg-[#0e1117]/70" role="table" aria-label="Versões do firmware compiladas em cada placa">
                    <div role="row" className="grid grid-cols-[minmax(8.5rem,1.4fr)_repeat(4,minmax(0,1fr))] border-b border-white/10 text-sm text-[#a3a7b0] sm:grid-cols-[minmax(12rem,1.6fr)_repeat(7,minmax(0,1fr))]">
                        <span role="columnheader" className="px-4 py-4 sm:px-6">Placa</span>
                        {VERSIONS.map((v, c) => (
                            <span role="columnheader" key={v} className={`flex items-center justify-center py-4 tabular-nums ${c < 3 ? 'max-sm:hidden' : ''} ${c === VERSIONS.length - 1 ? 'font-medium text-white' : ''}`}>v{v}</span>
                        ))}
                    </div>
                    {BOARDS.map((b, r) => (
                        <div role="row" key={b} className="grid grid-cols-[minmax(8.5rem,1.4fr)_repeat(4,minmax(0,1fr))] border-b border-white/[0.06] last:border-0 sm:grid-cols-[minmax(12rem,1.6fr)_repeat(7,minmax(0,1fr))]">
                            <span role="rowheader" className="flex items-center px-4 py-4 text-[15px] sm:px-6">{b}</span>
                            {VERSIONS.map((v, c) => (
                                <span role="cell" key={v} className={`flex items-center justify-center py-4 ${c < 3 ? 'max-sm:hidden' : ''}`} style={{ '--k': c * BOARDS.length + r } as PVar}>
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg [opacity:clamp(0.12,calc((var(--p)*${total + 4}-var(--k))*0.5),1)] ${c === VERSIONS.length - 1 ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--accent)]/15 text-[var(--accent)]'}`}>
                                        <Check size={15} strokeWidth={2.5} aria-label={`v${v} compilada`} />
                                    </span>
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-sm text-[#a3a7b0]">Todas as versões publicadas, compiladas nas 4 placas.</p>
            </div>
        </section>
    );
};

// ---------- 3. Daqui pra frente: projecao com a lista de espera ----------
export const Projection: React.FC = () => {
    const ref = useScrollVar<HTMLElement>(0.25);
    return (
        <section id="pronto" ref={ref} className="relative scroll-mt-16 bg-[var(--bg)]" style={{ '--p': 0 } as PVar}>
            <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
                <h2 className={`${h2} max-w-4xl`}>Prefere o controlador pronto? <span className="text-[var(--muted)]">Estamos preparando.</span></h2>

                {/* projecao: linha cheia ate hoje, tracejada dali em diante */}
                <div className="relative mt-14 h-[200px] sm:h-[240px]" aria-hidden>
                    <svg viewBox="0 0 1000 240" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                        <line x1="0" x2="1000" y1="220" y2="220" stroke="rgba(11,13,18,0.18)" vectorEffect="non-scaling-stroke" />
                        <path d="M420 124 C520 104 600 90 680 76 S860 46 1000 34" fill="none" stroke="#0B0D12" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="7 8" vectorEffect="non-scaling-stroke"
                            style={{ opacity: 'clamp(0, calc((var(--p) - 0.55) * 4), 1)' } as React.CSSProperties} />
                        <line x1="420" x2="420" y1="124" y2="220" stroke="rgba(11,13,18,0.25)" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {/* linha cheia ate hoje: revelada por recorte (o tracejado do SVG esticado nao mede certo) */}
                    <div className="absolute inset-0" style={{ clipPath: 'inset(-10px calc(100% - min(1, var(--p) * 1.6) * 42%) -10px 0)' }}>
                        <svg viewBox="0 0 1000 240" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                            <path d="M0 190 C120 185 220 160 300 150 S400 128 420 124" fill="none" stroke="#1fa84a" strokeWidth="4.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                    </div>
                    <span className="absolute left-[42%] top-[52%] -translate-x-1/2 rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-medium text-white">hoje</span>
                    <span className="absolute left-[68%] top-[31.5%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--ink)] bg-[var(--bg)] [opacity:clamp(0,calc((var(--p)-0.6)*4),1)]" />
                    <span className="absolute left-[68%] top-[31.5%] -translate-x-1/2 -translate-y-[170%] whitespace-nowrap text-sm font-medium [opacity:clamp(0,calc((var(--p)-0.6)*4),1)]">App nas lojas <span className="font-normal text-[var(--muted)]">· em teste</span></span>
                    <span className="absolute left-[97%] top-[14%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1fa84a] [opacity:clamp(0,calc((var(--p)-0.7)*4),1)]" />
                    <span className="absolute right-0 top-[14%] -translate-y-[170%] whitespace-nowrap text-right text-sm font-medium [opacity:clamp(0,calc((var(--p)-0.7)*4),1)] max-sm:top-[30%] max-sm:-translate-y-[260%]">Controlador pronto <span className="font-normal text-[var(--muted)] max-sm:block">· em preparação</span></span>
                </div>

                <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
                    <p className="max-w-[34rem] text-pretty text-lg leading-relaxed text-[var(--muted)]">
                        O controlador Breww com tela de 3,5", já montado, para quem não quer mexer com eletrônica. Ainda sem data e sem preço: deixe seu e-mail e você fica sabendo primeiro. O app para iPhone e Android está em teste e chega às lojas em breve.
                    </p>
                    <WaitlistForm interest="pronto" cta="Quero ser avisado" />
                </div>
            </div>
        </section>
    );
};

// ---------- 4. Precos: uma regua de fermentadores ----------
export const Pricing: React.FC = () => {
    const ref = useScrollVar<HTMLElement>(0.3);
    return (
        <section id="precos" ref={ref} className="relative scroll-mt-16 bg-[#E4E6E9]" style={{ '--p': 0 } as PVar}>
            <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-32">
                <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
                    <h2 className={h2}>Grátis durante o lançamento.</h2>
                    <p className="max-w-md text-pretty text-lg leading-relaxed text-[var(--muted)]">Até 3 fermentadores, sem pagar nada, enquanto o Breww cresce com a comunidade.</p>
                </div>

                {/* regua: 1 a 3 no verde, 4 ou mais tracejado; os planos sao anotacoes de cada lado da divisa */}
                <div className="relative mt-16">
                    <div className="grid grid-cols-2 text-sm" aria-hidden>
                        <div className="relative h-14 overflow-hidden rounded-l-full border border-[#1fa84a]/40">
                            <div className="absolute inset-0 origin-left bg-[var(--accent)] [transform:scaleX(var(--p))]" />
                            <div className="relative grid h-full grid-cols-3">{[1, 2, 3].map(n => <span key={n} className="flex items-center justify-center border-r border-[var(--ink)]/10 font-medium tabular-nums last:border-0">{n}</span>)}</div>
                        </div>
                        <div className="relative grid h-14 grid-cols-3 rounded-r-full border border-dashed border-[var(--ink)]/30">
                            {['4', '5', '6 +'].map(n => <span key={n} className="flex items-center justify-center tabular-nums text-[var(--muted)]">{n}</span>)}
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-[var(--muted)]" aria-hidden>fermentadores</p>
                    {/* divisa entre os planos, descendo da regua */}
                    <div className="absolute bottom-0 left-1/2 top-14 hidden border-l border-dashed border-[var(--ink)]/25 md:block" aria-hidden />

                    <div className="grid gap-14 pt-10 md:grid-cols-2 md:gap-0">
                        <div className="md:pr-12">
                            <h3 className="flex items-center gap-3 text-lg font-semibold">Lançamento <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-semibold">Agora</span></h3>
                            <p className="mt-4 flex items-baseline gap-1"><span className="[font-family:var(--font-display)] text-7xl font-light tracking-[-0.04em]">R$ 0</span><span className="text-[var(--muted)]">/mês</span></p>
                            <ul className="mt-8 space-y-3 text-[15px]">
                                {['Perfis automáticos e alertas no celular', 'Histórico de lotes e link ao vivo', 'iSpindel, Brewfather e Telegram', 'App para iPhone e Android (em teste)'].map(f => (
                                    <li key={f} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[#1fa84a]" />{f}</li>
                                ))}
                            </ul>
                            <Link to="/register" className="group mt-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium text-white hover:bg-black">
                                Criar conta grátis <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        </div>
                        <div className="md:pl-12">
                            <h3 className="flex items-center gap-3 text-lg font-semibold">Pro <span className="rounded-full border border-[var(--ink)]/20 px-2.5 py-0.5 text-xs font-semibold text-[var(--muted)]">Em breve</span></h3>
                            <p className="mt-4 text-balance [font-family:var(--font-display)] text-5xl font-light leading-[1.05] tracking-[-0.03em]">Para quem produz mais.</p>
                            <p className="mt-6 max-w-md text-pretty leading-relaxed text-[var(--muted)]">Mais fermentadores e recursos avançados para quem quer ir além. Sem data e sem preço ainda.</p>
                            <div className="mt-8"><WaitlistForm interest="pro" cta="Avise-me" /></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ---------- 5. Fecho: o lote termina e o proximo comeca ----------
export const Closing = React.forwardRef<HTMLElement>((_, outer) => {
    const ref = useScrollVar<HTMLDivElement>(0.4);
    return (
        <section ref={outer} className="on-dark relative overflow-hidden bg-[var(--ink)] text-white">
            <div ref={ref} style={{ '--p': 0 } as PVar}>
                {/* a cauda do lote chega ao fim e o proximo comeca, de ponta a ponta */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] sm:h-[42%]" aria-hidden>
                    <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                        <path d="M560 162 V60 H1000" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2.5" strokeDasharray="9 9" vectorEffect="non-scaling-stroke"
                            style={{ opacity: 'clamp(0, calc((var(--p) - 0.82) * 6), 1)' } as React.CSSProperties} />
                    </svg>
                    <div className="absolute inset-0" style={{ clipPath: 'inset(-10px calc(100% - min(1, var(--p) * 1.25) * 56%) -10px 0)' }}>
                        <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                            <path d="M0 40 C120 40 160 150 260 160 S420 162 560 162" fill="none" stroke="#71FC8F" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                    </div>
                    <span className="absolute bottom-[19%] left-[56%] -translate-x-full whitespace-nowrap pb-3 pr-4 text-sm font-medium text-[var(--accent)] max-sm:hidden sm:text-lg [opacity:clamp(0,calc((var(--p)-0.8)*8),1)]">Dia 10 · pronto para envasar</span>
                    <span className="absolute bottom-[19%] left-[56%] h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border-[3px] border-[var(--ink)] bg-[var(--accent)] [opacity:clamp(0,calc((var(--p)-0.8)*8),1)]" />
                    <span className="absolute bottom-[70%] left-[56%] whitespace-nowrap pb-2 pl-3 text-sm font-medium text-white/70 sm:text-lg [opacity:clamp(0,calc((var(--p)-0.85)*6),1)]">Próximo lote · Primária</span>
                </div>
                <div className="relative mx-auto max-w-6xl px-4 pb-[280px] pt-24 sm:px-6 sm:pb-72 lg:pt-32">
                                        <h2 className="max-w-4xl text-balance [font-family:var(--font-display)] text-[44px] font-light leading-[1] tracking-[-0.035em] sm:text-7xl lg:text-[84px]">
                        Seu próximo lote <span className="text-[var(--accent)]">começa no Dia 1.</span>
                    </h2>
                    <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-[#c9ccd3]">Toda cerveja caseira merece o controle de uma cervejaria.</p>
                    <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-7">
                        <Link to="/instalar" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                            Monte o seu controlador <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <Link to="/register" className={`justify-center text-white ${textLink}`}>Criar conta grátis</Link>
                    </div>
                </div>
            </div>
        </section>
    );
});
Closing.displayName = 'Closing';
