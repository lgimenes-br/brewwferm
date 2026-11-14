import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell, Check, Cpu, Smartphone, Wrench, Package, Thermometer, Usb, Github } from 'lucide-react';
import { SiteHeader, SiteFooter } from '../SiteChrome';
import { TempDisplay, SmallValue, Chip } from '../app/AppUI';
import { WaitlistForm } from '../landing/sections';

// Home nova (versao 2): "O app e a vitrine". A pagina e feita das proprias telas do app Breww em tamanho
// grande. A primeira tela e o cartao do aparelho, gigante e ao vivo; logo abaixo, a oferta em tres caminhos;
// depois o perfil, os alertas e o historico como o app mostra. Dados de exemplo, sempre rotulados.
// A home atual (components/Landing.tsx) continua em "/"; esta fica em /home-nova para comparar.

const useReducedMotion = () => {
    const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    useEffect(() => {
        const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (!mq) return;
        const on = () => setReduced(mq.matches);
        mq.addEventListener?.('change', on);
        return () => mq.removeEventListener?.('change', on);
    }, []);
    return reduced;
};

/** Temperatura de exemplo que oscila pouco em volta do alvo, como um controlador segurando 18 °C */
const useLiveTemp = (reduced: boolean) => {
    const [t, setT] = useState(18.1);
    useEffect(() => {
        if (reduced) return;
        const id = setInterval(() => setT(v => {
            const next = v + (18 - v) * 0.35 + (Math.random() - 0.5) * 0.18;
            return Math.round(next * 10) / 10;
        }), 2600);
        return () => clearInterval(id);
    }, [reduced]);
    return t;
};

/** Revela um bloco quando entra na tela (uma vez) */
const useInView = <T extends HTMLElement>(reduced: boolean) => {
    const ref = useRef<T>(null);
    const [seen, setSeen] = useState(reduced);
    useEffect(() => {
        if (reduced || !ref.current || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.35 });
        io.observe(ref.current);
        return () => io.disconnect();
    }, [reduced]);
    return [ref, seen] as const;
};

const btnMain = 'group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--on-accent)] hover:brightness-95';
const btnQuiet = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--fill)] px-6 text-[15px] font-medium text-[var(--ink)] hover:bg-white/10';
const h2 = 'text-balance text-[36px] sm:text-[52px] font-light leading-[1.04] tracking-[-0.03em] text-[var(--ink)]';

/** Moldura de celular em codigo (sem foto): a tela do app vai dentro */
const Phone: React.FC<{ children: React.ReactNode; label: string; className?: string }> = ({ children, label, className }) => (
    <figure className={`relative mx-auto w-[300px] sm:w-[330px] ${className ?? ''}`} aria-label={label}>
        <div className="rounded-[48px] border border-white/10 bg-[#0A0D13] p-2.5 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.9)]">
            <div className="relative overflow-hidden rounded-[40px] bg-[#04070B] [background:radial-gradient(90%_50%_at_100%_0%,rgba(113,252,143,0.10),transparent_70%),#04070B]">
                <div className="mx-auto mt-2.5 h-6 w-24 rounded-full bg-black" aria-hidden />
                <div className="px-4 pb-6 pt-4" aria-hidden>{children}</div>
            </div>
        </div>
        <figcaption className="mt-3 text-center text-[13px] text-[var(--tertiary)]">{label}</figcaption>
    </figure>
);

// ---------- Primeira tela: o cartao do aparelho, gigante ----------
const Hero: React.FC<{ reduced: boolean }> = ({ reduced }) => {
    const temp = useLiveTemp(reduced);
    const ok = Math.abs(temp - 18) <= 0.3;
    return (
        <section className="relative mx-auto max-w-7xl px-4 pt-8 pb-10 sm:px-6 lg:px-10 lg:pt-12" aria-labelledby="hero-titulo">
            {/* Titulo a esquerda; apoio e as duas acoes a direita, ja na primeira tela */}
            <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-end lg:gap-12">
                <h1 id="hero-titulo" className="text-balance text-[40px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[56px] lg:text-[64px]">
                    Sua cerveja na temperatura certa, <span className="text-[var(--accent)]">sem você vigiar.</span>
                </h1>
                <div className="lg:pb-2">
                    <p className="max-w-md text-pretty text-[17px] leading-relaxed text-[var(--muted)]">
                        O Breww controla a geladeira da fermentação, segue o perfil do lote sozinho e avisa no celular quando algo sai do ponto.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                        <a href="#caminhos" className={btnMain}>Começar <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></a>
                        <Link to="/login" className={btnQuiet}>Já tenho conta</Link>
                    </div>
                </div>
            </div>

            {/* O cartao do app em escala de cartaz: e o produto, nao uma ilustracao dele */}
            <div className="relative mt-8 lg:mt-10">
                <article className="app-card relative overflow-hidden p-6 sm:p-9 lg:p-10 shadow-[0_60px_120px_-60px_rgba(0,0,0,0.95)]" aria-label={`Exemplo de aparelho: ${temp.toFixed(1)} graus, alvo 18 graus, ${ok ? 'no alvo' : 'corrigindo'}`}>
                    <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(113,252,143,0.14),transparent_65%)]" aria-hidden />
                    <div className="relative flex flex-wrap items-start justify-between gap-4" aria-hidden>
                        <div>
                            <p className="text-[19px] font-medium text-[var(--ink)] sm:text-[24px]">Fermentador da garagem</p>
                            <p className="text-[14px] text-[var(--muted)] sm:text-[17px]">Fermentando Pilsen da casa · Primária</p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3.5 h-9 text-[13px] text-[var(--muted)]">
                            <span className={`h-2 w-2 rounded-full bg-[var(--accent)] ${reduced ? '' : 'animate-pulse'}`} /> ao vivo · lote de exemplo
                        </span>
                    </div>
                    <div className="relative mt-4 flex flex-col gap-8 sm:mt-6 lg:flex-row lg:items-end lg:justify-between" aria-hidden>
                        <div className="max-sm:hidden"><TempDisplay value={temp} size={176} /></div>
                        <div className="sm:hidden"><TempDisplay value={temp} size={120} /></div>
                        <div className="flex gap-8 sm:gap-12 lg:pb-6">
                            <div className="flex flex-col gap-1"><span className="text-[13px] text-[var(--muted)] sm:text-[15px]">Densidade</span><SmallValue value="1.021" size={32} /></div>
                            <div className="flex flex-col gap-1"><span className="text-[13px] text-[var(--muted)] sm:text-[15px]">Alvo</span><SmallValue value="18.0" unit="°C" size={32} /></div>
                            <div className="flex flex-col gap-1 max-sm:hidden"><span className="text-[15px] text-[var(--muted)]">Fim da etapa</span><SmallValue value="2d 6h" size={32} /></div>
                        </div>
                    </div>
                    <div className="relative mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-6">
                        <div className="flex flex-wrap gap-2" aria-hidden>
                            <Chip dot={ok ? 'on' : 'warn'}>{ok ? 'No alvo' : 'Corrigindo'}</Chip>
                            <Chip icon={<Thermometer size={14} />}>Geladeira 16,4°C</Chip>
                            <Chip>Dia 4 de 10</Chip>
                        </div>
                        <span className="text-[13px] text-[var(--tertiary)]">É assim que o seu aparelho aparece no app e no site.</span>
                    </div>
                </article>
            </div>
        </section>
    );
};

// ---------- Oferta: tres caminhos, sem ambiguidade ----------
const Paths: React.FC = () => (
    <section id="caminhos" className="scroll-mt-20 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-24" aria-labelledby="caminhos-titulo">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr] lg:items-end">
            <h2 id="caminhos-titulo" className={h2}>Três jeitos de <span className="text-[var(--muted)]">ter o seu.</span></h2>
            <p className="max-w-xl text-pretty text-[17px] leading-relaxed text-[var(--muted)] lg:justify-self-end">A conta é grátis para até 3 fermentadores, em qualquer caminho. O app para iPhone e Android está em teste e chega às lojas em breve.</p>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
            <li className="app-card flex flex-col p-6 sm:p-7 border-[rgba(113,252,143,0.3)]">
                <div className="flex items-center justify-between">
                    <span className="app-icon-btn text-[var(--accent)]" aria-hidden><Wrench size={18} /></span>
                    <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-medium text-[var(--on-accent)]">Disponível agora</span>
                </div>
                <h3 className="mt-6 text-[24px] font-light text-[var(--ink)]">Monte o seu</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">Uma placa ESP32, um sensor e um relé. O site grava o firmware e configura o Wi-Fi pelo cabo USB.</p>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-[14px]">
                    <div><dt className="text-[var(--tertiary)]">Tempo</dt><dd className="text-[var(--ink)]">cerca de 30 min</dd></div>
                    <div><dt className="text-[var(--tertiary)]">Firmware</dt><dd className="text-[var(--ink)]">grátis e aberto</dd></div>
                </dl>
                <div className="mt-auto pt-7"><Link to="/instalar" className={`${btnMain} w-full`}>Ver o guia de montagem <ArrowRight size={18} aria-hidden /></Link></div>
            </li>
            <li className="app-card flex flex-col p-6 sm:p-7">
                <div className="flex items-center justify-between">
                    <span className="app-icon-btn" aria-hidden><Package size={18} /></span>
                    <span className="rounded-full border border-dashed border-white/25 px-3 py-1 text-[12px] text-[var(--muted)]">Em preparação</span>
                </div>
                <h3 className="mt-6 text-[24px] font-light text-[var(--ink)]">Controlador pronto</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">O Breww com tela de 3,5", já montado, para quem não quer mexer com eletrônica. Ainda sem data e sem preço.</p>
                <div className="mt-auto pt-7"><WaitlistForm interest="pronto" cta="Avise-me" /></div>
            </li>
            <li className="app-card flex flex-col p-6 sm:p-7">
                <div className="flex items-center justify-between">
                    <span className="app-icon-btn" aria-hidden><Smartphone size={18} /></span>
                    <span className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-[12px] text-[var(--muted)]">1 minuto</span>
                </div>
                <h3 className="mt-6 text-[24px] font-light text-[var(--ink)]">Já tenho o aparelho</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">Crie a conta e vincule pelo código que aparece na tela do aparelho ou na rede Wi-Fi dele.</p>
                <div className="mt-auto flex flex-col gap-2 pt-7">
                    <Link to="/register" className={`${btnQuiet} w-full`}>Criar conta grátis</Link>
                    <Link to="/login" className="inline-flex min-h-11 items-center justify-center text-[15px] text-[var(--muted)] hover:text-[var(--ink)]">Já tenho conta: entrar</Link>
                </div>
            </li>
        </ol>
    </section>
);

// ---------- Telas do app ----------
const ProfileScreen: React.FC = () => (
    <div className="flex flex-col gap-3">
        <p className="text-[24px] font-light text-[var(--ink)]">Pilsen da casa</p>
        <div className="app-card p-4">
            <p className="text-[13px] text-[var(--muted)]">Etapa 1 de 3</p>
            <p className="text-[16px] font-medium text-[var(--ink)]">Primária</p>
            <div className="mt-3 h-1.5 rounded-full bg-[var(--fill)]"><div className="h-full w-[58%] rounded-full bg-[var(--accent)]" /></div>
            <p className="mt-2 text-[12px] text-[var(--tertiary)]">2d 6h restantes</p>
        </div>
        {[['Primária', '18°C', '5 dias', true], ['Descanso de diacetil', '22°C', '2 dias', false], ['Cold crash', '2°C', '3 dias', false]].map(([n, t, d, on]) => (
            <div key={n as string} className={`flex items-center gap-3 rounded-[18px] border px-3.5 py-3 ${on ? 'border-[rgba(113,252,143,0.35)] bg-[rgba(113,252,143,0.06)]' : 'border-[var(--line)] bg-[var(--cell)]'}`}>
                <span className={`h-2 w-2 rounded-full ${on ? 'bg-[var(--accent)]' : 'bg-[var(--tertiary)]'}`} />
                <span className="flex-1 text-[14px] text-[var(--ink)]">{n}</span>
                <span className="text-[13px] tabular text-[var(--muted)]">{t} · {d}</span>
            </div>
        ))}
    </div>
);

const HistoryScreen: React.FC = () => (
    <div className="flex flex-col gap-3">
        <p className="text-[24px] font-light text-[var(--ink)]">Histórico</p>
        <div className="app-card p-4">
            <p className="text-[12px] text-[var(--muted)]">Últimos 4 meses</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
                {[['7', 'dias com lote'], ['5', 'lotes'], ['5', 'dias seguidos']].map(([v, l]) => (
                    <div key={l}><p className="text-[22px] font-light tabular text-[var(--ink)]">{v}</p><p className="text-[11px] text-[var(--muted)]">{l}</p></div>
                ))}
            </div>
            <div className="mt-3 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]">
                {Array.from({ length: 56 }, (_, i) => {
                    const on = [9, 10, 23, 24, 25, 26, 27, 40, 47, 48, 49, 50].includes(i);
                    const edge = [9, 23, 27, 40, 47, 50].includes(i);
                    return <span key={i} className="aspect-square rounded-[3px]" style={{ background: edge ? '#71FC8F' : on ? 'rgba(113,252,143,0.42)' : 'rgba(255,255,255,0.05)' }} />;
                })}
            </div>
        </div>
        {[['IPA do quintal', 'American IPA · 14 dias', '6.6%'], ['Weiss de verão', 'Weissbier · 12 dias', '5.1%']].map(([n, d, a]) => (
            <div key={n} className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--cell)] px-3.5 py-3">
                <span className="flex-1 min-w-0"><span className="block text-[14px] font-medium text-[var(--ink)]">{n}</span><span className="block text-[12px] text-[var(--muted)]">{d}</span></span>
                <span className="text-[15px] tabular text-[var(--ink)]">{a}</span>
            </div>
        ))}
    </div>
);

const NOTES = [
    { time: 'Dia 1 · 08:00', title: 'Primária começou', text: 'Alvo 18 °C por 5 dias.' },
    { time: 'Dia 3 · 15:42', title: '19,6 °C, 1,6° acima do alvo', text: 'Porta aberta? Já estou resfriando.', warn: true },
    { time: 'Dia 3 · 16:10', title: 'De volta ao alvo', text: '18,0 °C. Tudo certo.' },
    { time: 'Dia 6 · 09:00', title: 'Descanso de diacetil', text: 'Subindo para 22 °C.' },
    { time: 'Dia 8 · 07:30', title: 'Densidade estável há 2 dias', text: '1.012. Hora do cold crash.' },
];

const Alerts: React.FC<{ reduced: boolean }> = ({ reduced }) => {
    const [ref, seen] = useInView<HTMLDivElement>(reduced);
    return (
        <section className="border-y border-[var(--line)] bg-[radial-gradient(60%_80%_at_50%_0%,rgba(113,252,143,0.06),transparent_70%)]" aria-labelledby="alertas-titulo">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
                <div className="mx-auto max-w-2xl text-center">
                    <h2 id="alertas-titulo" className={h2}>O celular avisa. <span className="text-[var(--muted)]">O Breww já está corrigindo.</span></h2>
                    <p className="mx-auto mt-4 max-w-lg text-pretty text-[17px] leading-relaxed text-[var(--muted)]">Dia quente, porta aberta, aparelho desligado, etapa nova: você fica sabendo na hora, sem abrir o app.</p>
                </div>
                {/* As notificacoes de um lote inteiro, empilhadas como na tela de bloqueio */}
                <div ref={ref} className="mx-auto mt-12 flex max-w-md flex-col gap-2.5" aria-label="Notificações de um lote de exemplo">
                    {NOTES.map((n, i) => (
                        <div
                            key={n.time}
                            className="flex items-start gap-3 rounded-[22px] border border-[var(--line)] bg-[rgba(24,28,37,0.85)] p-4 backdrop-blur-md transition-[opacity,transform] duration-700 ease-out"
                            style={{ opacity: seen ? 1 : 0, transform: seen ? 'none' : 'translateY(18px)', transitionDelay: seen && !reduced ? `${i * 120}ms` : '0ms' }}
                        >
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fill)] ${n.warn ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`} aria-hidden><Bell size={16} /></span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-3"><span className="text-[14px] font-medium text-[var(--ink)]">Breww · {n.title}</span></span>
                                <span className="block text-[14px] text-[var(--muted)]">{n.text}</span>
                            </span>
                            <span className="shrink-0 text-[12px] tabular text-[var(--tertiary)]">{n.time}</span>
                        </div>
                    ))}
                </div>
                <p className="mt-4 text-center text-[13px] text-[var(--tertiary)]">Notificações de um lote de exemplo</p>
            </div>
        </section>
    );
};

const Showcase: React.FC<{ reduced: boolean }> = ({ reduced }) => (
    <div id="recursos" className="scroll-mt-20">
        {/* Perfil: celular a direita */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-10 lg:py-24" aria-labelledby="perfil-titulo">
            <div>
                <h2 id="perfil-titulo" className={h2}>Monte o perfil uma vez. <span className="text-[var(--muted)]">Ele segue sozinho.</span></h2>
                <p className="mt-5 max-w-lg text-pretty text-[17px] leading-relaxed text-[var(--muted)]">Primária, descanso de diacetil, cold crash: o controlador liga o aquecimento ou a geladeira e troca de etapa na hora certa. Comece de um perfil pronto da biblioteca ou do seu.</p>
                <ul className="mt-7 flex flex-col gap-3 text-[16px] text-[var(--ink)]">
                    {['Decide no próprio aparelho, mesmo sem internet', 'Protege o compressor entre ligamentos', 'Densidade ao vivo com iSpindel'].map(t => (
                        <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />{t}</li>
                    ))}
                </ul>
            </div>
            <Phone label="Tela do lote no app (exemplo)"><ProfileScreen /></Phone>
        </section>

        <Alerts reduced={reduced} />

        {/* Historico: celular a esquerda */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-10 lg:py-24" aria-labelledby="historico-titulo">
            <Phone label="Histórico no app (exemplo)" className="lg:order-1"><HistoryScreen /></Phone>
            <div className="lg:order-2">
                <h2 id="historico-titulo" className={h2}>Cada lote guardado. <span className="text-[var(--muted)]">O próximo sai melhor.</span></h2>
                <p className="mt-5 max-w-lg text-pretty text-[17px] leading-relaxed text-[var(--muted)]">Curva, eventos e notas de cada fermentação ficam no histórico. Compare dois lotes lado a lado e mande um link para os amigos acompanharem ao vivo, sem conta.</p>
                <p className="mt-7 flex flex-wrap gap-2 text-[14px]">
                    <Chip>Comparar lotes</Chip><Chip>Link ao vivo</Chip><Chip>Brewfather e Telegram</Chip>
                </p>
            </div>
        </section>
    </div>
);

// ---------- Aberto e instalado pelo navegador ----------
const BOARDS = ['ESP32-S3 com tela 3,5"', 'ESP32 DevKit', 'ESP32-S3', 'ESP32-C3 SuperMini', 'ESP8266 (Lite)'];
const Open: React.FC = () => (
    <section className="border-t border-[var(--line)]" aria-labelledby="aberto-titulo">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-10 lg:py-24">
            <div>
                <h2 id="aberto-titulo" className={h2}>Firmware aberto. <span className="text-[var(--muted)]">Instala pelo navegador.</span></h2>
                <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-[var(--muted)]">O código está no GitHub sob a licença GPL-3.0. Ligue a placa no USB, abra o assistente no Chrome ou no Edge e ele reconhece a placa, grava o Breww e configura o Wi-Fi. Sem Arduino, sem compilar nada.</p>
                <div className="mt-7 flex flex-wrap gap-2">
                    <Link to="/instalar/assistente" className={btnQuiet}><Usb size={17} aria-hidden /> Abrir o assistente</Link>
                    <a href="https://github.com/lgimenes-br/breww-firmware" target="_blank" rel="noopener noreferrer" className={btnQuiet}><Github size={17} aria-hidden /> Código no GitHub <ArrowUpRight size={15} aria-hidden /></a>
                </div>
            </div>
            <div className="app-card p-2" aria-label="Placas suportadas">
                <p className="px-4 pt-3 pb-2 text-[15px] text-[var(--muted)]">Placas suportadas</p>
                <ul>
                    {BOARDS.map(b => (
                        <li key={b} className="flex items-center gap-3 rounded-[18px] px-4 h-12 text-[15px] text-[var(--ink)]">
                            <Cpu size={16} className="text-[var(--accent)]" aria-hidden />
                            <span className="flex-1">{b}</span>
                            <Check size={16} className="text-[var(--tertiary)]" aria-label="compatível" />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    </section>
);

// ---------- Preco e fecho ----------
const Price: React.FC = () => (
    <section id="precos" className="scroll-mt-20 border-t border-[var(--line)]" aria-labelledby="preco-titulo">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
            <div className="grid gap-4 md:grid-cols-2">
                <div className="app-card p-7 sm:p-9">
                    <p className="flex items-center gap-3 text-[17px] text-[var(--ink)]">Lançamento <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--on-accent)]">Agora</span></p>
                    <h2 id="preco-titulo" className="mt-5 flex items-baseline gap-2"><span className="text-[72px] font-light leading-none tracking-[-0.04em] text-[var(--ink)]">R$ 0</span><span className="text-[var(--muted)]">/mês</span></h2>
                    <p className="mt-3 text-[16px] text-[var(--muted)]">Até 3 fermentadores, enquanto o Breww cresce com a comunidade.</p>
                    <ul className="mt-7 flex flex-col gap-3 text-[15px] text-[var(--ink)]">
                        {['Perfis automáticos e alertas no celular', 'Histórico, comparação e link ao vivo', 'iSpindel, Brewfather e Telegram', 'App para iPhone e Android (em teste)'].map(f => (
                            <li key={f} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />{f}</li>
                        ))}
                    </ul>
                    <Link to="/register" className={`${btnQuiet} mt-8`}>Criar conta grátis <ArrowRight size={18} aria-hidden /></Link>
                </div>
                <div className="rounded-[26px] border border-dashed border-white/20 p-7 sm:p-9">
                    <p className="flex items-center gap-3 text-[17px] text-[var(--ink)]">Pro <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[12px] text-[var(--muted)]">Em breve</span></p>
                    <p className="mt-5 text-[40px] font-light leading-[1.05] tracking-[-0.03em] text-[var(--ink)]">Para quem produz mais.</p>
                    <p className="mt-3 max-w-md text-[16px] leading-relaxed text-[var(--muted)]">Mais fermentadores e recursos avançados para nanocervejarias e cervejeiros ciganos. Sem data e sem preço ainda.</p>
                    <div className="mt-8"><WaitlistForm interest="pro" cta="Avise-me" /></div>
                </div>
            </div>
        </div>
    </section>
);

const Closing: React.FC = () => (
    <section className="border-t border-[var(--line)] bg-[radial-gradient(70%_80%_at_50%_100%,rgba(113,252,143,0.10),transparent_70%)]" aria-labelledby="fecho-titulo">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 lg:px-10 lg:py-28">
            <h2 id="fecho-titulo" className="mx-auto max-w-3xl text-balance text-[40px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[64px]">
                Seu próximo lote <span className="text-[var(--accent)]">começa no Dia 1.</span>
            </h2>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/instalar" className={btnMain}>Monte o seu controlador <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>
                <Link to="/register" className={btnQuiet}>Criar conta grátis</Link>
            </div>
        </div>
    </section>
);

export const LandingApp: React.FC = () => {
    const reduced = useReducedMotion();
    useEffect(() => { document.title = 'Breww — Controle de fermentação no celular'; }, []);
    return (
        <div className="min-h-screen text-[var(--ink)]">
            <SiteHeader
                signIn
                nav={[
                    { label: 'Como funciona', to: '#recursos', anchor: true },
                    { label: 'Monte o seu', to: '/instalar' },
                    { label: 'Preços', to: '#precos', anchor: true },
                    { label: 'Ajuda', to: '/ajuda' },
                ]}
            />
            <main>
                <Hero reduced={reduced} />
                <Paths />
                <Showcase reduced={reduced} />
                <Open />
                <Price />
                <Closing />
            </main>
            <SiteFooter />
        </div>
    );
};

export default LandingApp;
