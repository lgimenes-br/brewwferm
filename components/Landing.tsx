import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { ArrowRight, ArrowUpRight, Bell, Check, Cpu, Thermometer, ToggleRight, Usb, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

// Home de vendas (visitante sem login em "/"). Sistema: DESIGN.md ("O instrumento calmo").
// Caminho por tipo de visitante: quem tem (ou vai comprar) um ESP32 vai para o guia de montagem;
// quem quer o controlador pronto entra na lista de espera; criar a conta e o passo seguinte.

const Mark: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="landing-mark">{children}</span>;

// Um unico estilo de link de texto (claro e escuro herdam a cor do contexto)
const textLink = 'group inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium underline decoration-current/30 underline-offset-[5px] hover:decoration-current';

// Curva de fermentacao: alvo em degraus (tracejado) e temperatura real (verde) que se desenha uma vez
const FermentationCurve: React.FC = () => (
    <svg viewBox="0 0 320 150" className="h-auto w-full" role="img" aria-label="Gráfico: temperatura acompanhando o perfil Primária 18°C, Diacetil 22°C e Cold crash 2°C">
        <defs>
            <linearGradient id="lg-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#71FC8F" stopOpacity="0.28" />
                <stop offset="1" stopColor="#71FC8F" stopOpacity="0" />
            </linearGradient>
        </defs>
        {[30, 70, 110].map(y => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />)}
        <path d="M0 62 H118 V38 H196 V126 H320" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeDasharray="4 5" />
        <path className="landing-curve-fill" d="M0 70 C20 66 40 62 70 62 S110 63 120 60 C130 46 140 40 160 39 S190 39 198 44 C210 90 220 120 240 124 S300 126 320 126 V150 H0 Z" fill="url(#lg-fill)" />
        <path className="landing-curve" d="M0 70 C20 66 40 62 70 62 S110 63 120 60 C130 46 140 40 160 39 S190 39 198 44 C210 90 220 120 240 124 S300 126 320 126" fill="none" stroke="#71FC8F" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="314" cy="126" r="4" fill="#71FC8F" className="landing-curve-dot" />
        <g fill="rgba(255,255,255,0.6)" fontSize="10" fontFamily="Inter, sans-serif">
            <text x="6" y="54">Primária 18°</text>
            <text x="124" y="30">Diacetil 22°</text>
            <text x="240" y="116">Cold crash 2°</text>
        </g>
    </svg>
);

// Tela do app num celular (recriada em codigo, com a paleta do app)
const PhoneMock: React.FC = () => (
    <div className="relative w-[250px] rounded-[44px] bg-[#0b0d12] p-[10px] shadow-[0_40px_80px_-30px_rgba(11,13,18,0.55)] ring-1 ring-black/10 sm:w-[270px]" aria-hidden>
        <div className="overflow-hidden rounded-[36px] bg-[#04070B] px-4 pb-6 pt-10 text-white">
            <div className="absolute left-1/2 top-[18px] h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
            <div className="text-xl font-semibold tracking-tight">Aparelhos</div>
            <div className="mt-4 rounded-[22px] bg-[#181C25] p-4">
                <div className="flex items-center justify-between text-[11px] text-[#898E99]">
                    <span>Fermentando Pilsen</span>
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#71FC8F]" />Online</span>
                </div>
                <div className="mt-3 flex items-start gap-1">
                    <span className="text-[44px] font-light leading-none tracking-tight tabular-nums">18,0</span>
                    <span className="mt-1 text-[13px] text-[#898E99]">°C</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 whitespace-nowrap text-[11px]">
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[#c9ccd3]">Alvo 18°C</span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[#c9ccd3]">SG 1.012</span>
                    <span className="rounded-full bg-[#71FC8F]/15 px-2 py-1 text-[#71FC8F]">Resfriando</span>
                </div>
                <div className="mt-4 text-[11px] text-[#898E99]">Etapa 2 de 3 · Diacetil</div>
                <div className="mt-2 h-1.5 rounded-full bg-white/5"><div className="h-full w-[58%] rounded-full bg-[#71FC8F]" /></div>
            </div>
            {/* No celular o cartao da curva cobre esta parte da tela; so aparece de 640 px para cima */}
            <div className="mt-3 hidden rounded-[22px] bg-[#181C25] p-4 sm:block">
                <div className="flex items-center justify-between text-[11px] text-[#898E99]"><span>Chopeira</span><span>Servindo</span></div>
                <div className="mt-2 flex items-start gap-1">
                    <span className="text-[28px] font-light leading-none tabular-nums">2,0</span>
                    <span className="text-[11px] text-[#898E99]">°C</span>
                </div>
            </div>
        </div>
    </div>
);

// O assistente de instalacao em acao (o diferencial: tudo pelo navegador, sem programa)
const InstallerMock: React.FC = () => (
    <figure className="overflow-hidden rounded-3xl border border-white/10 bg-[#0e1117] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map(i => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white/10" />)}</span>
            <span className="mx-auto rounded-full bg-white/[0.06] px-3 py-1 text-xs text-[#a3a7b0]">breww.live/instalar/assistente</span>
        </div>
        <ol className="space-y-3 p-5 sm:p-6">
            <li className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--ink)]"><Check size={16} strokeWidth={2.5} /></span>
                <div className="min-w-0">
                    <p className="text-[15px] text-white">Placa encontrada no USB</p>
                    <p className="text-[13px] text-[#a3a7b0]">ESP32-C3 · firmware certo escolhido sozinho</p>
                </div>
            </li>
            <li className="rounded-2xl bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent)]/50 text-[var(--accent)]"><Usb size={15} /></span>
                    <p className="flex-1 text-[15px] text-white">Gravando o Breww</p>
                    <span className="text-[13px] tabular-nums text-[var(--accent)]">64%</span>
                </div>
                <div className="ml-11 mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-[64%] rounded-full bg-[var(--accent)]" /></div>
            </li>
            <li className="flex items-center gap-3 rounded-2xl p-4 text-[#a3a7b0]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-[13px]">3</span>
                <p className="text-[15px]">Wi-Fi da sua casa pelo mesmo cabo</p>
            </li>
            <li className="flex items-center gap-3 rounded-2xl p-4 text-[#a3a7b0]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-[13px]">4</span>
                <p className="text-[15px]">Pronto para adicionar no app</p>
            </li>
        </ol>
        <figcaption className="sr-only">O assistente de instalação encontra a placa pelo USB, grava o firmware, configura o Wi-Fi e deixa o aparelho pronto para o app.</figcaption>
    </figure>
);

const NEEDS = [
    { icon: Cpu, title: 'Uma placa ESP32', text: 'DevKit, S3 ou C3, das mais fáceis de achar.' },
    { icon: Thermometer, title: 'Sensor de temperatura DS18B20', text: 'O à prova d’água, com um resistor de 4,7 kΩ.' },
    { icon: ToggleRight, title: 'Relé de 2 canais', text: 'Um liga o aquecimento, o outro a geladeira.' },
    { icon: Usb, title: 'Chrome ou Edge e um cabo USB', text: 'No computador, só para gravar uma vez.' },
];

// Formulario da lista de espera (controlador pronto ou plano Pro)
const WaitlistForm: React.FC<{ interest: 'pronto' | 'pro'; dark?: boolean; cta: string }> = ({ interest, dark, cta }) => {
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
            <p role="status" className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] ${dark ? 'bg-white/[0.06] text-white' : 'bg-[var(--bg)] text-[var(--ink)]'}`}>
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
                    id={id}
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                    placeholder="seu@email.com"
                    aria-invalid={state === 'error'}
                    aria-describedby={state === 'error' ? `${id}-erro` : undefined}
                    className={`min-h-12 flex-1 rounded-full border px-5 text-[15px] outline-none transition-colors ${dark ? 'border-white/15 bg-white/[0.06] text-white placeholder:text-[#898E99] focus:border-white/40' : 'border-black/10 bg-white text-[var(--ink)] placeholder:text-black/35 focus:border-black/30'}`}
                />
                <button type="submit" disabled={state === 'sending'} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium transition-colors disabled:opacity-60 ${dark ? 'bg-[var(--accent)] text-[var(--ink)] hover:brightness-95' : 'bg-[var(--ink)] text-white hover:bg-black'}`}>
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

export const Landing: React.FC = () => {
    const heroCtas = useRef<HTMLDivElement>(null);
    const finalCta = useRef<HTMLElement>(null);
    const [showBar, setShowBar] = useState(false);

    useEffect(() => {
        document.title = 'Breww — Controle de fermentação no celular';
    }, []);

    // Barra fixa no celular: aparece quando os botoes do topo saem da tela e some no fecho da pagina
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return;
        const seen = { hero: true, end: false };
        const io = new IntersectionObserver(entries => {
            for (const e of entries) {
                if (e.target === heroCtas.current) seen.hero = e.isIntersecting;
                if (e.target === finalCta.current) seen.end = e.isIntersecting;
            }
            setShowBar(!seen.hero && !seen.end);
        });
        if (heroCtas.current) io.observe(heroCtas.current);
        if (finalCta.current) io.observe(finalCta.current);
        return () => io.disconnect();
    }, []);

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />

            <main>
                {/* Topo */}
                <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:gap-10 lg:pb-24 lg:pt-20">
                    <div className="landing-rise">
                        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#2fbf55]" /> Firmware aberto · Feito no Brasil
                        </p>
                        <h1 className="text-balance [font-family:var(--font-display)] text-[44px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[60px] lg:text-[66px]">
                            Sua cerveja na temperatura certa, <Mark>do primeiro dia</Mark> ao chope.
                        </h1>
                        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[var(--muted)]">
                            O Breww controla a geladeira da fermentação, segue o perfil do seu lote sozinho e avisa no celular quando algo sai do ponto. Monte o seu com um ESP32 em minutos, direto pelo navegador.
                        </p>
                        <div ref={heroCtas} className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link to="/instalar" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium text-white hover:bg-black">
                                Monte o seu controlador <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <a href="#pronto" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 px-6 text-[15px] font-medium hover:bg-white">
                                Prefiro o pronto
                            </a>
                        </div>
                        <p className="mt-6 text-sm text-[var(--muted)]">
                            Já tem o aparelho? <Link to="/register" className="font-medium text-[var(--ink)] underline decoration-current/30 underline-offset-4 hover:decoration-current">Crie sua conta grátis</Link>
                        </p>
                    </div>

                    <div className="landing-rise-late relative mx-auto mb-24 flex w-full max-w-md justify-center sm:mb-0 lg:justify-end">
                        <PhoneMock />
                        <div className="absolute -bottom-24 left-1/2 w-[260px] -translate-x-1/2 rounded-3xl bg-[var(--card)] p-4 text-white shadow-[0_30px_60px_-25px_rgba(11,13,18,0.6)] sm:bottom-8 sm:left-auto sm:-left-6 sm:translate-x-0 lg:-left-12">
                            <div className="mb-2 flex items-center justify-between text-xs text-[#898E99]">
                                <span>Perfil do lote</span><span className="text-[#71FC8F]">no alvo</span>
                            </div>
                            <FermentationCurve />
                        </div>
                    </div>
                </section>

                {/* Recursos: controlar, avisar, medir, guardar */}
                <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
                    <h2 className="max-w-2xl text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                        Tudo o que uma cervejaria tem. <span className="text-[var(--muted)]">Na sua garagem.</span>
                    </h2>
                    <div className="mt-12 grid gap-4 md:grid-cols-2">
                        <article className="rounded-3xl bg-white p-7 sm:p-8">
                            <h3 className="text-xl font-semibold tracking-tight">Segue o perfil sozinho</h3>
                            <p className="mt-2 text-pretty leading-relaxed text-[var(--muted)]">Monte as etapas uma vez e o controlador troca a temperatura na hora certa. Serve de fermentador, geladeira ou chopeira.</p>
                            <ol className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Exemplo de perfil">
                                {['Primária · 18°C · 5 dias', 'Diacetil · 22°C · 2 dias', 'Cold crash · 2°C · 3 dias'].map((s, i) => (
                                    <li key={s} className={`rounded-full px-3 py-1.5 ${i === 1 ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>{s}</li>
                                ))}
                            </ol>
                        </article>
                        <article className="rounded-3xl bg-white p-7 sm:p-8">
                            <h3 className="text-xl font-semibold tracking-tight">Avisa antes de virar problema</h3>
                            <p className="mt-2 text-pretty leading-relaxed text-[var(--muted)]">Temperatura fora do alvo, aparelho desligado, densímetro sem bateria: a notificação chega no celular.</p>
                            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--bg)] p-4" aria-hidden>
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--accent)]"><Bell size={16} /></span>
                                <div className="min-w-0 text-sm">
                                    <p className="font-medium">Fermentador Inox</p>
                                    <p className="text-[var(--muted)]">A cerveja está a 21,4°C, 3,4° acima do alvo.</p>
                                </div>
                            </div>
                        </article>
                        <article className="rounded-3xl bg-white p-7 sm:p-8">
                            <h3 className="text-xl font-semibold tracking-tight">Mede a densidade</h3>
                            <p className="mt-2 text-pretty leading-relaxed text-[var(--muted)]">Com um iSpindel, o densímetro que boia no mosto, você vê o açúcar virar álcool e sabe quando o lote termina.</p>
                            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums" aria-hidden>
                                <span className="[font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] text-[var(--muted)]">1,048</span>
                                <ArrowRight size={18} className="text-[var(--muted)]" />
                                <span className="[font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em]">1,012</span>
                                <span className="whitespace-nowrap text-sm text-[var(--muted)]">final em ~2 dias</span>
                            </div>
                        </article>
                        <article className="rounded-3xl bg-white p-7 sm:p-8">
                            <h3 className="text-xl font-semibold tracking-tight">Guarda cada lote</h3>
                            <p className="mt-2 text-pretty leading-relaxed text-[var(--muted)]">Curva, eventos e notas de cada fermentação, para comparar e repetir o que deu certo. E um link para os amigos acompanharem ao vivo, sem conta.</p>
                            <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--bg)] px-3.5 py-1.5 text-sm" aria-hidden>
                                <span className="h-2 w-2 rounded-full bg-[#2fbf55]" /><span className="font-medium">Ao vivo</span><span className="text-[var(--muted)]">Pilsen da casa · dia 5</span>
                            </p>
                        </article>
                    </div>
                    <p className="mt-6 text-sm text-[var(--muted)]">Funciona com iSpindel, Brewfather e Telegram.</p>
                </section>

                {/* Monte o seu: instalador, o que precisa e firmware aberto */}
                <section id="monte" className="on-dark scroll-mt-16 bg-[var(--card)] text-white">
                    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
                        <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
                            <div>
                                <h2 className="text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                                    Um ESP32, um sensor e um relé. <span className="text-[var(--accent)]">Sem programar nada.</span>
                                </h2>
                                <p className="mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-[#c9ccd3]">
                                    Ligue a placa no computador e o site faz o resto: descobre qual é, grava o Breww, configura o Wi-Fi pelo mesmo cabo e deixa tudo pronto para o app.
                                </p>
                                <ul className="mt-10 grid gap-5 sm:grid-cols-2">
                                    {NEEDS.map(({ icon: Icon, title, text }) => (
                                        <li key={title} className="flex gap-3">
                                            <Icon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                                            <div>
                                                <p className="font-medium">{title}</p>
                                                <p className="mt-1 text-[15px] leading-relaxed text-[#a3a7b0]">{text}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-7">
                                    <Link to="/instalar" className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                                        Ver o guia de montagem <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                                    </Link>
                                    <span className="text-sm text-[#a3a7b0]">Quer uma tela? Ligue uma OLED depois: o Breww reconhece sozinho.</span>
                                </div>
                            </div>
                            <InstallerMock />
                        </div>

                        {/* Firmware aberto (GPL-3.0) */}
                        <div className="mt-20 grid gap-10 border-t border-white/10 pt-16 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-16">
                            <div>
                                <h3 className="text-balance [font-family:var(--font-display)] text-3xl font-light leading-[1.1] tracking-[-0.025em] sm:text-4xl">
                                    O código da placa é aberto. <span className="text-[#a3a7b0]">De verdade.</span>
                                </h3>
                                <p className="mt-5 max-w-[34rem] text-pretty text-lg leading-relaxed text-[#c9ccd3]">
                                    Está publicado no GitHub sob a licença GPL-3.0: qualquer pessoa pode conferir o que roda na sua geladeira, sugerir melhorias e montar o seu. Toda mudança é testada nas 4 placas antes de entrar.
                                </p>
                                <a href="https://github.com/lgimenes-br/breww-firmware" target="_blank" rel="noopener noreferrer" className={`mt-6 text-white ${textLink}`}>
                                    Ver o código no GitHub <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                </a>
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1117]" role="img" aria-label="Trecho do firmware: a função que procura o sensor DS18B20 em um pino">
                                <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 text-[13px]">
                                    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white"><span className="rounded border border-white/15 px-1 font-mono text-[11px] text-[#a3a7b0]">C++</span>hal_sensors.cpp</span>
                                    <span className="ml-auto rounded-md border border-white/10 px-2 py-0.5 font-mono text-xs text-[#a3a7b0]">v2.9.6</span>
                                </div>
                                <pre className="overflow-x-auto py-4 text-[13px] leading-[1.8] text-[#c9ccd3] [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]" aria-hidden="true">
{[
    ['152', <><b className="font-medium text-white">static bool</b> probe_ds18b20(<b className="font-medium text-white">int</b> pin) {'{'}</>],
    ['153', <>{'  '}OneWire w(pin);</>],
    ['154', <>{'  '}<b className="font-medium text-white">uint8_t</b> a[8];</>],
    ['155', <>{'  '}w.reset_search();</>],
    ['156', <>{'  '}<b className="font-medium text-white">bool</b> found = w.search(a) &amp;&amp;</>, true],
    ['157', <>{'    '}OneWire::crc8(a, 7) == a[7] &amp;&amp;</>, true],
    ['158', <>{'    '}(a[0] == 0x28 || a[0] == 0x10);<span className="hidden italic text-[#8e9199] sm:inline"> // DS18x20</span></>, true],
    ['159', <>{'  '}<b className="font-medium text-white">return</b> found;</>],
    ['160', <>{'}'}</>],
].map(([n, code, mark]) => (
    <div key={n as string} className={`flex pr-4 ${mark ? 'bg-[var(--accent)]/[0.08] shadow-[inset_2px_0_0_var(--accent)]' : ''}`}>
        <span className="w-12 shrink-0 select-none pr-4 text-right text-[#7a7f89]">{n}</span><span className="whitespace-pre">{code}</span>
    </div>
))}
                                </pre>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Controlador pronto: lista de espera */}
                <section id="pronto" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
                    <div className="grid gap-10 rounded-[32px] bg-white p-7 sm:p-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
                        <div>
                            <h2 className="text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                                Prefere o controlador pronto? <span className="text-[var(--muted)]">Estamos preparando.</span>
                            </h2>
                            <p className="mt-5 max-w-[34rem] text-pretty text-lg leading-relaxed text-[var(--muted)]">
                                O controlador Breww com tela de 3,5", já montado, para quem não quer mexer com eletrônica. Ainda sem data e sem preço: deixe seu e-mail e você fica sabendo primeiro.
                            </p>
                        </div>
                        <div>
                            <WaitlistForm interest="pronto" cta="Quero ser avisado" />
                            <p className="mt-6 border-t border-black/[0.07] pt-5 text-sm leading-relaxed text-[var(--muted)]">
                                O app para iPhone e Android está em teste e chega às lojas em breve.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Precos */}
                <section id="precos" className="scroll-mt-20 border-t border-black/5 bg-white/50">
                    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-balance [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] sm:text-5xl">Grátis durante o lançamento.</h2>
                            <p className="mt-4 text-pretty text-lg text-[var(--muted)]">Use tudo sem pagar nada, com até 3 fermentadores, enquanto o Breww cresce com a comunidade.</p>
                        </div>
                        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
                            <div className="on-dark flex flex-col rounded-3xl bg-[var(--ink)] p-8 text-white">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Lançamento</h3>
                                    <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">Agora</span>
                                </div>
                                <p className="mt-6 flex items-baseline gap-1"><span className="[font-family:var(--font-display)] text-6xl font-light tracking-[-0.04em]">R$ 0</span><span className="text-[#a3a7b0]">/mês</span></p>
                                <ul className="mt-8 space-y-3 text-[15px] text-[#c9ccd3]">
                                    {['Até 3 fermentadores', 'Perfis, alertas e histórico de lotes', 'iSpindel, Brewfather e Telegram', 'App para iPhone e Android (em teste)'].map(f => (
                                        <li key={f} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />{f}</li>
                                    ))}
                                </ul>
                                <div className="mt-auto pt-10"><Link to="/register" className="flex min-h-12 items-center justify-center rounded-full bg-white text-[15px] font-semibold text-[var(--ink)] hover:bg-[var(--accent)]">Criar conta grátis</Link></div>
                            </div>
                            <div className="flex flex-col rounded-3xl border border-black/10 bg-white p-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Pro</h3>
                                    <span className="rounded-full bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">Em breve</span>
                                </div>
                                <p className="mt-6 [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em]">Para quem produz mais.</p>
                                <p className="mt-6 text-pretty leading-relaxed text-[var(--muted)]">Mais de 3 fermentadores e recursos avançados para quem quer ir além. Sem data e sem preço ainda.</p>
                                <div className="mt-auto pt-8"><WaitlistForm interest="pro" cta="Avise-me" /></div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Fecho */}
                <section ref={finalCta} className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
                    <div className="on-dark rounded-[32px] bg-[var(--ink)] p-8 text-white sm:p-14">
                        <p className="max-w-3xl text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.1] tracking-[-0.025em] sm:text-5xl">
                            Toda cerveja caseira merece o <span className="text-[var(--accent)]">controle de uma cervejaria</span>.
                        </p>
                        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-7">
                            <Link to="/instalar" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                                Monte o seu controlador <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <Link to="/register" className={`justify-center text-white ${textLink}`}>Criar conta grátis</Link>
                        </div>
                    </div>
                </section>
            </main>

            <SiteFooter />

            {/* Celular: acao principal sempre ao alcance do polegar */}
            <div
                className={`fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-[var(--bg)]/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${showBar ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
                aria-hidden={!showBar}
            >
                <div className="flex gap-2">
                    <Link to="/instalar" tabIndex={showBar ? 0 : -1} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-[15px] font-medium text-white">
                        Monte o seu <ArrowRight size={17} />
                    </Link>
                    <a href="#pronto" tabIndex={showBar ? 0 : -1} className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-5 text-[15px] font-medium">Prefiro o pronto</a>
                </div>
            </div>
        </div>
    );
};

export default Landing;
