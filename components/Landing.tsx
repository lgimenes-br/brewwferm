import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { ArrowRight, ArrowUpRight, Bell, Activity, Layers, History, Radio, Cpu, Usb, Wifi, Smartphone, Check, Download } from 'lucide-react';

// Home de vendas (visitante sem login em "/").
// Direcao: editorial de laboratorio — fundo claro, tipografia grande e leve, verde #71FC8F como
// "marca-texto" das palavras-chave e dos dados. Visuais feitos em codigo (sem imagens de banco).

// Grifo de marca-texto que acompanha a quebra de linha (box-decoration-break: clone)
const Mark: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="landing-mark">{children}</span>
);

// Curva de fermentacao: alvo em degraus (tracejado) e temperatura real (verde) que se desenha uma vez
const FermentationCurve: React.FC = () => (
    <svg viewBox="0 0 320 150" className="w-full h-auto" role="img" aria-label="Gráfico: temperatura acompanhando o perfil Primária 18°C, Diacetil 22°C e Cold crash 2°C">
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
        <circle cx="320" cy="126" r="4" fill="#71FC8F" className="landing-curve-dot" />
        <g fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="Inter, sans-serif">
            <text x="6" y="54">Primária 18°</text>
            <text x="124" y="30">Diacetil 22°</text>
            <text x="248" y="116">Cold crash 2°</text>
        </g>
    </svg>
);

// Tela do app num celular (recriada em codigo, com a paleta do app)
const PhoneMock: React.FC = () => (
    <div className="relative w-[250px] sm:w-[270px] rounded-[44px] bg-[#0b0d12] p-[10px] shadow-[0_40px_80px_-30px_rgba(11,13,18,0.55)] ring-1 ring-black/10">
        <div className="rounded-[36px] bg-[#04070B] px-4 pt-10 pb-6 text-white overflow-hidden">
            <div className="absolute left-1/2 top-[18px] h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
            <div className="text-[22px] font-semibold tracking-tight">Aparelhos</div>
            <div className="mt-4 rounded-[22px] bg-[#181C25] p-4">
                <div className="flex items-center justify-between text-[11px] text-[#898E99]">
                    <span>Fermentando Pilsen</span>
                    <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#71FC8F]" />Online</span>
                </div>
                <div className="mt-3 flex items-start gap-1">
                    <span className="text-[44px] font-light leading-none tracking-tight tabular-nums">18,0</span>
                    <span className="mt-1 text-[13px] text-[#898E99]">°C</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 whitespace-nowrap text-[10.5px]">
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[#c9ccd3]">Alvo 18°C</span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[#c9ccd3]">SG 1.012</span>
                    <span className="rounded-full bg-[#71FC8F]/15 px-2 py-1 text-[#71FC8F]">Resfriando</span>
                </div>
                <div className="mt-4 text-[11px] text-[#898E99]">Etapa 2 de 3 · Diacetil</div>
                <div className="mt-2 h-1.5 rounded-full bg-white/5"><div className="h-full w-[58%] rounded-full bg-[#71FC8F]" /></div>
            </div>
            <div className="mt-3 rounded-[22px] bg-[#181C25] p-4">
                <div className="flex items-center justify-between text-[11px] text-[#898E99]"><span>Choppeira</span><span>Servindo</span></div>
                <div className="mt-2 flex items-start gap-1">
                    <span className="text-[28px] font-light leading-none tabular-nums">2,0</span>
                    <span className="text-[11px] text-[#898E99]">°C</span>
                </div>
            </div>
        </div>
    </div>
);

const FEATURES = [
    { icon: Layers, title: 'Perfis automáticos', text: 'Primária, diacetil, cold crash. Monte as etapas uma vez e o controlador troca a temperatura sozinho, na hora certa.', wide: true },
    { icon: Bell, title: 'Alertas no celular', text: 'Temperatura fora do alvo, aparelho offline, bateria do densímetro. Você fica sabendo antes de virar problema.' },
    { icon: Activity, title: 'Gravidade e previsão', text: 'Com iSpindel, acompanhe a densidade ao vivo e veja quando o lote deve chegar à FG.' },
    { icon: Cpu, title: 'Três aparelhos em um', text: 'Fermentador, geladeira e choppeira. Troque o modo pelo app ou pela tela.' },
    { icon: History, title: 'Histórico de lotes', text: 'Cada levada guardada com curva, eventos e notas. Compare e repita o que deu certo.' },
    { icon: Radio, title: 'Compartilhe ao vivo', text: 'Um link para os amigos acompanharem a fermentação em tempo real, sem precisar de conta.', wide: true, live: true },
    { icon: Download, title: 'Sempre atualizado', text: 'Versões novas do controlador chegam pelo app, com um toque.' },
];

const STEPS = [
    { icon: Usb, n: '01', title: 'Grave pelo navegador', text: 'Ligue o ESP32 no computador e clique em Instalar. Sem Arduino, sem compilar.' },
    { icon: Wifi, n: '02', title: 'Conecte ao Wi-Fi', text: 'O instalador já pede o Wi-Fi da sua casa. Ou, pelo celular, entre na rede Breww.' },
    { icon: Smartphone, n: '03', title: 'Adicione no app', text: 'Ele aparece sozinho na busca da sua rede. Um toque e pronto.' },
];

const STATS = [
    { value: '4', label: 'placas suportadas, com ou sem tela' },
    { value: '10', label: 'etapas por perfil de fermentação' },
    { value: '5 min', label: 'de proteção para o compressor' },
    { value: '0', label: 'linhas de código para instalar' },
];

export const Landing: React.FC = () => {
    useEffect(() => {
        document.title = 'Breww — Controle de fermentação no celular';
    }, []);

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />

            <main>
                {/* Hero */}
                <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
                    <div className="landing-rise">
                        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#2fbf55]" /> Controle de fermentação · App para iOS e Android
                        </p>
                        <h1 className="[font-family:var(--font-display)] text-[44px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[60px] lg:text-[66px]">
                            Sua cerveja na temperatura certa, <Mark>do primeiro dia</Mark> ao chope.
                        </h1>
                        <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
                            O Breww controla a geladeira da fermentação, segue o perfil do seu lote sozinho e avisa no celular quando algo sai do ponto. Use a placa Breww ou monte a sua com um ESP32.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Link to="/register" className="group inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3.5 text-[15px] font-medium text-white hover:bg-black">
                                Criar conta grátis <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <Link to="/instalar" className="inline-flex items-center gap-2 rounded-full border border-black/15 px-6 py-3.5 text-[15px] font-medium hover:bg-white">
                                Monte o seu controlador
                            </Link>
                        </div>
                        <p className="mt-8 text-sm text-[var(--muted)]">Funciona com iSpindel, Brewfather e Telegram.</p>
                    </div>

                    <div className="landing-rise-late relative mx-auto mb-10 flex w-full max-w-md justify-center sm:mb-0 lg:justify-end">
                        <PhoneMock />
                        <div className="absolute -bottom-10 -left-1 w-[220px] rounded-3xl sm:bottom-8 sm:-left-10 bg-[var(--card)] p-4 text-white shadow-[0_30px_60px_-25px_rgba(11,13,18,0.6)] sm:w-[260px]">
                            <div className="mb-2 flex items-center justify-between text-[11px] text-[#898E99]">
                                <span>Perfil do lote</span><span className="text-[#71FC8F]">no alvo</span>
                            </div>
                            <FermentationCurve />
                        </div>
                    </div>
                </section>

                {/* Declaracao */}
                <section className="border-y border-black/5 bg-white/50">
                    <p className="mx-auto max-w-4xl px-4 py-20 text-center [font-family:var(--font-display)] text-[30px] font-light leading-[1.15] tracking-[-0.02em] sm:px-6 sm:text-[44px]">
                        Um app que transforma a fermentação em <span className="font-medium">dados claros</span> e em <span className="font-medium">ações no ponto certo.</span>
                    </p>
                </section>

                {/* Recursos */}
                <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
                    <div className="mb-12 max-w-2xl">
                        <p className="text-sm font-medium text-[var(--muted)]">Recursos</p>
                        <h2 className="mt-2 [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] sm:text-5xl">Tudo o que uma cervejaria tem. <span className="text-[var(--muted)]">Na sua garagem.</span></h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {FEATURES.map(({ icon: Icon, title, text, wide, live }) => (
                            <article key={title} className={`group rounded-3xl border border-black/5 bg-white p-7 transition-shadow hover:shadow-[0_20px_40px_-24px_rgba(11,13,18,0.25)] ${wide ? 'lg:col-span-2' : ''}`}>
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg)]">
                                    <Icon size={20} strokeWidth={1.75} />
                                </span>
                                <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
                                <p className="mt-2 leading-relaxed text-[var(--muted)]">{text}</p>
                                {wide && FEATURES[0].title === title && (
                                    <div className="mt-6 flex flex-wrap gap-2 text-sm" aria-hidden>
                                        {['Primária · 18°C · 5 dias', 'Diacetil · 22°C · 2 dias', 'Cold crash · 2°C · 3 dias'].map((s, i) => (
                                            <span key={s} className={`rounded-full px-3 py-1.5 ${i === 1 ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>{s}</span>
                                        ))}
                                    </div>
                                )}
                                {live && (
                                    <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-[var(--bg)] py-1.5 pl-3 pr-4 text-sm" aria-hidden>
                                        <span className="flex items-center gap-1.5 font-medium"><span className="h-2 w-2 rounded-full bg-[#2fbf55]" />Ao vivo</span>
                                        <span className="text-[var(--muted)]">breww.live/live/pilsen</span>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                </section>

                {/* Monte o seu */}
                <section id="monte" className="scroll-mt-16 bg-[var(--card)] text-white">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
                        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-end">
                            <div>
                                <p className="text-sm font-medium text-[#898E99]">Firmware aberto</p>
                                <h2 className="mt-2 [font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em] sm:text-6xl">
                                    Um ESP32, um sensor e um relé. <span className="text-[var(--accent)]">Sem compilar nada.</span>
                                </h2>
                            </div>
                            <p className="text-lg leading-relaxed text-[#a3a7b0]">
                                Já tem um ESP32 na gaveta? Grave o Breww direto pelo navegador e use o mesmo app. Começou sem tela? Ligue uma telinha OLED depois: o mesmo firmware reconhece sozinho.
                            </p>
                        </div>
                        <ol className="mt-14 grid gap-4 md:grid-cols-3">
                            {STEPS.map(({ icon: Icon, n, title, text }) => (
                                <li key={n} className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                                    <div className="flex items-center justify-between">
                                        <Icon size={22} strokeWidth={1.75} className="text-[var(--accent)]" />
                                        <span className="font-mono text-sm text-[#6B6F78]">{n}</span>
                                    </div>
                                    <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
                                    <p className="mt-2 leading-relaxed text-[#a3a7b0]">{text}</p>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                            <Link to="/instalar" className="group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                                Abrir o instalador <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <a href="https://github.com/lgimenes-br/breww-firmware" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-[15px] font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-[var(--accent)]">
                                Código aberto no GitHub <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </a>
                            <span className="text-sm text-[#898E99]">ESP32 DevKit · ESP32-S3 · ESP32-C3 · Breww com tela 3,5"</span>
                        </div>
                    </div>
                </section>

                {/* Numeros */}
                <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
                    <dl className="grid gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                        {STATS.map(s => (
                            <div key={s.label} className="border-l border-black/10 pl-6">
                                <dt className="sr-only">{s.label}</dt>
                                <dd className="[font-family:var(--font-display)] text-6xl font-light tracking-[-0.04em] tabular-nums">{s.value}</dd>
                                <dd className="mt-3 max-w-[14rem] text-[var(--muted)]">{s.label}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {/* Firmware aberto (GPL) */}
                <section id="codigo" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
                    <div className="grid items-center gap-10 rounded-[32px] bg-[var(--ink)] px-6 py-12 text-white sm:px-12 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
                        <div>
                            <h2 className="[font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                                Firmware aberto no GitHub. <span className="text-[#8e9199]">Licença <span className="whitespace-nowrap">GPL-3.0.</span></span>
                            </h2>
                            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-[#c9ccd3]">
                                O código que roda no ESP32 está publicado. Placas novas, sensores e correções entram por pull request, e cada um é compilado nas 4 placas antes de entrar.
                            </p>
                            <a href="https://github.com/lgimenes-br/breww-firmware" target="_blank" rel="noopener noreferrer"
                                className="group mt-8 inline-flex items-center gap-2 border-b border-white/30 pb-1 text-[15px] font-medium hover:border-[var(--accent)]">
                                Ver o código no GitHub <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                            </a>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1117] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]" role="img" aria-label="Trecho do firmware: a função que procura o sensor DS18B20 em um pino">
                            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 text-[13px]">
                                <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white"><span className="rounded border border-white/15 px-1 font-mono text-[11px] text-[#a3a7b0]">C++</span>hal_sensors.cpp</span>
                                <span className="hidden items-center gap-1.5 px-2.5 py-1 text-[#8e9199] sm:flex"><span className="rounded border border-white/10 px-1 font-mono text-[11px]">C++</span>board_pins.cpp</span>
                                <span className="ml-auto rounded-md border border-white/10 px-2 py-0.5 font-mono text-[12px] text-[#a3a7b0]">v2.9.5</span>
                            </div>
                            <pre className="overflow-x-auto py-4 text-[13px] leading-[1.8] text-[#c9ccd3] [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]" aria-hidden="true">
{[
    ['152', <><b className="font-medium text-white">static bool</b> probe_ds18b20(<b className="font-medium text-white">int</b> pin) {'{'}</>],
    ['153', <>{'    '}OneWire w(pin);</>],
    ['154', <>{'    '}<b className="font-medium text-white">uint8_t</b> a[8];</>],
    ['155', <>{'    '}w.reset_search();</>],
    ['156', <>{'    '}<b className="font-medium text-white">bool</b> found = w.search(a) &amp;&amp; OneWire::crc8(a, 7) == a[7] &amp;&amp;</>, true],
    ['157', <>{'                 '}(a[0] == 0x28 || a[0] == 0x10 || a[0] == 0x22 || a[0] == 0x3B); <span className="italic text-[#6b6f78]">// familias DS18x20</span></>, true],
    ['158', <>{'    '}pinMode(pin, INPUT);</>],
    ['159', <>{'    '}<b className="font-medium text-white">return</b> found;</>],
    ['160', <>{'}'}</>],
].map(([n, code, mark]) => (
    <div key={n as string} className={`flex pr-4 ${mark ? 'bg-[var(--accent)]/[0.08] shadow-[inset_2px_0_0_var(--accent)]' : ''}`}>
        <span className="w-12 shrink-0 select-none pr-4 text-right text-[#565a63]">{n}</span><span className="whitespace-pre">{code}</span>
    </div>
))}
                            </pre>
                        </div>
                    </div>
                </section>

                {/* Precos */}
                <section id="precos" className="scroll-mt-20 border-t border-black/5 bg-white/50">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
                        <div className="mx-auto max-w-2xl text-center">
                            <p className="text-sm font-medium text-[var(--muted)]">Preços</p>
                            <h2 className="mt-2 [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] sm:text-5xl">Grátis durante o lançamento.</h2>
                            <p className="mt-4 text-lg text-[var(--muted)]">Use tudo sem pagar nada, com até 3 fermentadores, enquanto o Breww cresce com a comunidade.</p>
                        </div>
                        <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
                            <div className="rounded-3xl bg-[var(--ink)] p-8 text-white">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Lançamento</h3>
                                    <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">Agora</span>
                                </div>
                                <p className="mt-6 flex items-baseline gap-1"><span className="[font-family:var(--font-display)] text-6xl font-light tracking-[-0.04em]">R$ 0</span><span className="text-[#898E99]">/mês</span></p>
                                <ul className="mt-8 space-y-3 text-[15px] text-[#c9ccd3]">
                                    {['Até 3 fermentadores', 'App iOS e Android', 'Perfis automáticos e alertas', 'Histórico de lotes', 'iSpindel, Brewfather e Telegram', 'Atualizações de firmware pelo app'].map(f => (
                                        <li key={f} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />{f}</li>
                                    ))}
                                </ul>
                                <Link to="/register" className="mt-10 block rounded-full bg-white py-3.5 text-center text-[15px] font-semibold text-[var(--ink)] hover:bg-[var(--accent)]">Criar conta grátis</Link>
                            </div>
                            <div className="rounded-3xl border border-black/10 bg-white p-8">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Pro</h3>
                                    <span className="rounded-full bg-[var(--bg)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">Em breve</span>
                                </div>
                                <p className="mt-6 [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em]">Para quem produz mais.</p>
                                <p className="mt-6 leading-relaxed text-[var(--muted)]">Mais de 3 fermentadores e recursos avançados para quem quer ir além. Quem já usa o Breww fica sabendo primeiro.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Manifesto */}
                <section className="mx-auto max-w-5xl px-4 py-28 sm:px-6">
                    <blockquote className="[font-family:var(--font-display)] text-[34px] font-light leading-[1.12] tracking-[-0.025em] sm:text-[56px]">
                        “Toda cerveja caseira merece o <Mark>controle de uma cervejaria</Mark>.”
                    </blockquote>
                    <p className="mt-6 text-[var(--muted)]">— Por que criamos o Breww</p>
                </section>

                {/* Chamada final */}
                <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
                    <div className="flex flex-col items-start justify-between gap-8 rounded-[32px] bg-[var(--accent)] p-10 sm:p-14 md:flex-row md:items-end">
                        <h2 className="max-w-xl [font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em] sm:text-6xl">Comece hoje. Sua próxima levada agradece.</h2>
                        <Link to="/register" className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--ink)] px-7 py-4 text-[15px] font-medium text-white hover:bg-black">
                            Criar conta grátis <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    );
};

export default Landing;
