import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Cpu, Smartphone, Thermometer, ToggleRight, Usb, Wifi, Plug, Monitor, Droplets, CircleDot, Gauge } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';

// Guia "Monte o seu" (/instalar), no mundo da home ("a curva e a pagina"): malha milimetrada so no topo,
// uma trilha fixa dos 4 passos com a linha verde enchendo conforme a leitura avanca, e cada secao no seu tom
// de cinza. Cheio = obrigatorio/ja existe; tracejado = opcional/ainda nao. A gravacao fica no assistente.

export type Wire = { pin: string; to: string; note?: string; free?: boolean }; // free = o firmware acha sozinho (contorno tracejado)
// sensorPins: onde o DS18B20 e o DHT22 podem ir (o firmware procura sozinho; igual a pins_sensor_candidate)
export type Board = { id: string; name: string; hint: string; wires: Wire[]; relayDefault: string; sensorPins?: number[] };

// Reles e I2C: pinos fixos de boards/*.h. Sensores: qualquer pino de sensorPins (detectados sozinhos, v2.9.2+)
export const BOARDS: Board[] = [
    {
        id: 'esp32-devkit', name: 'ESP32 DevKit', hint: 'O mais barato e fácil de achar (WROOM-32 / DevKit V1).',
        wires: [
            { pin: 'Qualquer livre', to: 'Sensor DS18B20 · dados', note: 'resistor de 4,7 kΩ para o 3,3 V', free: true },
            { pin: 'GPIO 26', to: 'Relé de aquecer · IN' },
            { pin: 'GPIO 27', to: 'Relé de resfriar · IN' },
            { pin: 'Qualquer livre', to: 'DHT22 · dados', note: 'opcional', free: true },
            { pin: 'GPIO 21 / 22', to: 'Tela ou sensor I²C · SDA / SCL', note: 'opcional' },
        ],
        relayDefault: 'Módulo de relé comum (liga em nível baixo)',
        sensorPins: [4, 13, 14, 16, 17, 18, 19, 23, 25, 32, 33],
    },
    {
        id: 's3-headless', name: 'ESP32-S3', hint: 'ESP32-S3-DevKitC ou similar, sem tela.',
        wires: [
            { pin: 'Qualquer livre', to: 'Sensor DS18B20 · dados', note: 'resistor de 4,7 kΩ para o 3,3 V', free: true },
            { pin: 'GPIO 9', to: 'Relé de aquecer · IN' },
            { pin: 'GPIO 14', to: 'Relé de resfriar · IN' },
            { pin: 'Qualquer livre', to: 'DHT22 · dados', note: 'opcional', free: true },
            { pin: 'GPIO 4 / 5', to: 'Tela ou sensor I²C · SDA / SCL', note: 'opcional' },
        ],
        relayDefault: 'Módulo de relé comum (liga em nível baixo)',
        sensorPins: [1, 2, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47],
    },
    {
        id: 'c3-headless', name: 'ESP32-C3 SuperMini', hint: 'Bem pequeno. Poucos pinos, mas suficiente.',
        wires: [
            { pin: 'Qualquer livre', to: 'Sensor DS18B20 · dados', note: 'resistor de 4,7 kΩ para o 3,3 V', free: true },
            { pin: 'GPIO 5', to: 'Relé de aquecer · IN' },
            { pin: 'GPIO 6', to: 'Relé de resfriar · IN' },
            { pin: 'Qualquer livre', to: 'DHT22 · dados', note: 'opcional', free: true },
            { pin: 'GPIO 7 / 10', to: 'Tela ou sensor I²C · SDA / SCL', note: 'opcional' },
        ],
        relayDefault: 'Módulo de relé comum (liga em nível baixo)',
        sensorPins: [0, 1, 3, 4, 20, 21],
    },
    {
        id: 's3-35', name: 'Breww com tela 3,5"', hint: 'A placa oficial com tela touch.',
        wires: [
            { pin: 'JST 4P · 3 ou 4', to: 'Sensor DS18B20 · dados', free: true },
            { pin: 'JST 8P · pino 1', to: 'Relé de aquecer' },
            { pin: 'JST 8P · pino 2', to: 'Relé de resfriar' },
            { pin: 'JST 4P · o outro', to: 'DHT22 · dados', note: 'opcional', free: true },
        ],
        relayDefault: 'Relés da placa oficial (nível alto)',
    },
];

const PARTS = [
    { icon: Cpu, title: 'Uma placa ESP32', text: 'DevKit, S3 ou C3. Qualquer uma das placas abaixo.' },
    { icon: Thermometer, title: 'Sensor DS18B20', text: 'A versão à prova d’água, com cabo. Mais um resistor de 4,7 kΩ.' },
    { icon: ToggleRight, title: 'Relés', text: 'Módulo de 2 canais (aquecer e resfriar) ou SSR.' },
    { icon: Plug, title: 'Fonte 5 V', text: 'Um carregador USB comum serve para a placa.' },
];
const EXTRAS = [
    { icon: Monitor, title: 'Tela OLED 0,96" ou LCD 20x4', text: 'I²C. Reconhecida sozinha ao ligar.' },
    { icon: Droplets, title: 'Umidade', text: 'SHT3x, AHT20, BME280 ou DHT22.' },
    { icon: CircleDot, title: 'Dois botões', text: 'Para ajustar o alvo e o menu na telinha.' },
    { icon: Gauge, title: 'iSpindel', text: 'Densímetro Wi-Fi para acompanhar a gravidade.' },
];

const supportsWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

const STEPS = [
    { id: 'pecas', label: 'Peças' },
    { id: 'ligacoes', label: 'Ligações' },
    { id: 'instalar', label: 'Instalar' },
    { id: 'app', label: 'Wi-Fi e app' },
];
const paperGrid = {
    backgroundImage: 'linear-gradient(rgba(11,13,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,18,0.05) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
} as const;
const h2 = 'text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-6xl';

/** Titulo de passo: o numero e um no da linha verde, nao um rotulo acima do titulo */
const StepTitle: React.FC<{ n: number; children: React.ReactNode; dark?: boolean }> = ({ n, children, dark }) => (
    <div className="flex items-start gap-4 sm:gap-5">
        <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums sm:mt-2 sm:h-11 sm:w-11 sm:text-base ${dark ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[#1fa84a] text-white'}`} aria-hidden>{n}</span>
        <h2 className={h2}>{children}</h2>
    </div>
);

/** Trilha fixa dos passos: o passo da secao visivel acende e a linha verde enche com a leitura */
const StepRail: React.FC = () => {
    const [active, setActive] = useState(-1);
    const fill = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let raf = 0;
        const update = () => {
            raf = 0;
            const els = STEPS.map(s => document.getElementById(s.id));
            if (els.some(e => !e)) return;
            const mid = window.innerHeight * 0.4;
            let a = -1;
            els.forEach((e, k) => { if (e!.getBoundingClientRect().top <= mid) a = k; });
            setActive(a);
            const first = els[0]!.getBoundingClientRect().top;
            const last = els[els.length - 1]!.getBoundingClientRect();
            const p = Math.min(1, Math.max(0, (mid - first) / Math.max(1, last.top + last.height * 0.5 - first)));
            if (fill.current) fill.current.style.transform = `scaleX(${p})`;
        };
        const on = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', on, { passive: true });
        window.addEventListener('resize', on);
        return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
    }, []);
    return (
        <nav aria-label="Passos do guia" className="sticky top-[60px] z-20 border-b border-black/5 bg-[var(--bg)]/90 backdrop-blur-md">
            <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
                <ol className="grid grid-cols-4">
                    {STEPS.map((s, k) => (
                        <li key={s.id}>
                            <a href={`#${s.id}`} aria-current={k === active ? 'step' : undefined}
                                className={`flex min-h-12 items-center gap-2 text-sm transition-colors ${k === active ? 'font-medium text-[var(--ink)]' : k < active ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums transition-colors ${k <= active ? 'bg-[#1fa84a] text-white' : 'border border-dashed border-[var(--ink)]/35'}`}>
                                    {k < active ? <Check size={13} strokeWidth={2.5} /> : k + 1}
                                </span>
                                <span className="truncate max-sm:sr-only">{s.label}</span>
                                {k === active && <span className="truncate text-xs sm:hidden">{s.label}</span>}
                            </a>
                        </li>
                    ))}
                </ol>
                <div className="absolute inset-x-4 bottom-0 h-[3px] sm:inset-x-6" aria-hidden>
                    <div ref={fill} className="h-full origin-left rounded-full bg-[#1fa84a]" style={{ transform: 'scaleX(0)' }} />
                </div>
            </div>
        </nav>
    );
};

export const Installer: React.FC = () => {
    const [boardId, setBoardId] = useState(BOARDS[0].id);
    const [version, setVersion] = useState<string | null>(null);
    const [manifestMissing, setManifestMissing] = useState(false);
    const board = BOARDS.find(b => b.id === boardId)!;
    const headless = board.id !== 's3-35';

    useEffect(() => { document.title = 'Monte o seu Breww — Instalador'; }, []);


    useEffect(() => {
        setVersion(null);
        setManifestMissing(false);
        fetch(`/firmware/manifest/${board.id}.json?t=${Date.now()}`)
            .then(r => (r.ok ? r.json() : Promise.reject()))
            .then(m => setVersion(m.version))
            .catch(() => setManifestMissing(true));
    }, [board.id]);

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />
            <main>
                {/* Topo, no papel milimetrado */}
                <section className="relative" style={paperGrid}>
                    <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 lg:pb-24 lg:pt-20">
                        <h1 className="max-w-[18ch] text-balance [font-family:var(--font-display)] text-[44px] font-light leading-[0.98] tracking-[-0.035em] sm:text-7xl lg:text-[84px]">
                            Monte o seu Breww. <span className="landing-mark">Sem compilar nada.</span>
                        </h1>
                        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-[var(--muted)]">
                            Compre as peças, ligue os fios, grave o firmware pelo navegador e configure o Wi-Fi. Em menos de meia hora ele aparece no app.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <a href="#pecas" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium text-white hover:bg-black">
                                Começar pela lista de peças <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </a>
                            {supportsWebSerial && (
                                <Link to="/instalar/assistente" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-[var(--bg)]/70 px-6 text-[15px] font-medium backdrop-blur-sm hover:bg-white">
                                    <Usb size={17} /> Já montei: instalar
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                <StepRail />

                {/* 1. Pecas */}
                <section id="pecas" className="scroll-mt-28 bg-[#F7F7F8]">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
                        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
                            <StepTitle n={1}>O essencial <span className="text-[var(--muted)]">cabe na palma da mão.</span></StepTitle>
                            <p className="max-w-md text-pretty text-lg leading-relaxed text-[var(--muted)]">Quatro peças fáceis de achar. O resto é opcional e entra quando você quiser.</p>
                        </div>
                        <ul className="mt-14 grid gap-x-12 sm:grid-cols-2">
                            {PARTS.map(({ icon: Icon, title, text }) => (
                                <li key={title} className="flex gap-4 border-t border-black/10 py-6">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--accent)]"><Icon size={20} strokeWidth={1.75} /></span>
                                    <div><h3 className="text-lg font-semibold tracking-tight">{title}</h3><p className="mt-1 leading-relaxed text-[var(--muted)]">{text}</p></div>
                                </li>
                            ))}
                        </ul>
                        <h3 className="mt-14 text-lg font-semibold tracking-tight">Se quiser mais <span className="font-normal text-[var(--muted)]">· opcionais</span></h3>
                        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {EXTRAS.map(({ icon: Icon, title, text }) => (
                                <li key={title} className="flex gap-3 rounded-2xl border border-dashed border-[var(--ink)]/25 p-4">
                                    <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                                    <div><p className="font-medium">{title}</p><p className="text-sm text-[var(--muted)]">{text}</p></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* 2. Ligacoes */}
                <section id="ligacoes" className="scroll-mt-28 bg-[var(--bg)]">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
                        <StepTitle n={2}>Escolha a placa. <span className="text-[var(--muted)]">Cada fio no seu lugar.</span></StepTitle>
                        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Placa">
                            {BOARDS.map(b => (
                                <button
                                    key={b.id}
                                    role="radio"
                                    aria-checked={b.id === boardId}
                                    onClick={() => setBoardId(b.id)}
                                    className={`rounded-2xl border p-4 text-left transition-colors ${b.id === boardId ? 'border-[var(--card)] bg-[var(--card)] text-white' : 'border-black/10 bg-white/60 hover:bg-white'}`}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="font-semibold">{b.name}</span>
                                        {b.id === boardId && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]"><Check size={13} strokeWidth={2.5} className="text-[var(--ink)]" /></span>}
                                    </span>
                                    <span className={`mt-1 block text-sm ${b.id === boardId ? 'text-[#a3a7b0]' : 'text-[var(--muted)]'}`}>{b.hint}</span>
                                </button>
                            ))}
                        </div>

                        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                            <div className="rounded-3xl bg-white p-6 sm:p-8">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="text-lg font-semibold tracking-tight">Mapa de ligações · {board.name}</h3>
                                    <span className="flex items-center gap-3 text-xs text-[var(--muted)]">
                                        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-full bg-[var(--ink)]" />pino fixo</span>
                                        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-full border border-dashed border-[var(--ink)]/50" />qualquer livre</span>
                                    </span>
                                </div>
                                <ul className="mt-6 space-y-3">
                                    {board.wires.map(w => (
                                        <li key={w.to} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <span className={`w-[8.5rem] shrink-0 rounded-full px-3 py-1.5 text-center text-sm ${w.free ? 'border border-dashed border-[var(--ink)]/40 text-[var(--ink)]' : 'bg-[var(--ink)] font-mono text-white'}`}>{w.pin}</span>
                                            <span aria-hidden className="hidden h-[2px] flex-1 rounded-full bg-[#1fa84a]/70 sm:block" />
                                            <span className="font-medium">{w.to}</span>
                                            {w.note && <span className={`rounded-full px-2.5 py-0.5 text-xs ${w.note === 'opcional' ? 'border border-dashed border-[var(--ink)]/25 text-[var(--muted)]' : 'bg-[var(--accent)] text-[var(--ink)]'}`}>{w.note}</span>}
                                        </li>
                                    ))}
                                </ul>
                                {board.sensorPins && (
                                    <div className="mt-6 rounded-2xl bg-[var(--bg)] p-4">
                                        <p className="text-sm font-medium">Pinos livres para os sensores</p>
                                        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Pinos livres para os sensores">
                                            {board.sensorPins.map(n => (
                                                <li key={n} className="rounded-full border border-dashed border-[var(--ink)]/30 bg-white px-2.5 py-0.5 font-mono text-xs">{n}</li>
                                            ))}
                                        </ul>
                                        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                                            Ligue o DS18B20 e o DHT22 em qualquer um deles: a placa procura e acha sozinha. Os outros pinos são da própria placa (memória, boot, USB) ou dos relés e do I²C. Não ligue sensor neles.
                                        </p>
                                    </div>
                                )}
                                <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">
                                    Alimente os sensores no 3,3 V e todos os GND juntos. Dois DS18B20 podem dividir o mesmo pino.
                                    {board.id === 's3-35' && ' Os fios de dados do DS18B20 e do DHT22 podem ir em qualquer ordem nos pinos 3 e 4 do JST 4P: a placa percebe e se ajusta sozinha.'}
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="on-dark rounded-3xl bg-[var(--card)] p-6 text-white shadow-[0_30px_60px_-35px_rgba(11,13,18,0.7)]">
                                    <p className="text-sm text-[#a3a7b0]">Tipo de relé padrão</p>
                                    <p className="mt-2 text-lg font-medium">{board.relayDefault}</p>
                                    <p className="mt-2 text-sm leading-relaxed text-[#a3a7b0]">Usa SSR ou outro tipo? Troque no app, em Hardware, depois de instalar.</p>
                                </div>
                                <div className="flex gap-3 rounded-3xl border border-[#FF5A6E]/30 bg-[#FF5A6E]/10 p-6 text-sm leading-relaxed text-[#7a1f2b]" role="note">
                                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#d63a4d]" />
                                    <span>Os relés comandam aparelhos na tomada (110/220 V). Faça a parte elétrica com tudo desligado, use caixa fechada e, sem experiência, peça ajuda a um eletricista.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Instalar (Grafite) */}
                <section id="instalar" className="on-dark scroll-mt-28 bg-[var(--card)] text-white">
                    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
                        <div>
                            <StepTitle n={3} dark>Um clique e o firmware <span className="text-[var(--accent)]">está gravado.</span></StepTitle>
                            <ul className="mt-10 space-y-3 text-[#c9ccd3]">
                                {['Chrome ou Edge, no computador', 'Cabo USB de dados (alguns só carregam)', 'Se a placa não aparecer, segure o BOOT ao conectar', ...(headless ? ['Ao terminar, o instalador já pede o Wi-Fi da sua casa'] : [])].map(t => (
                                    <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />{t}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-[#0e1117]/70 p-7 sm:p-8">
                            <p className="flex items-center gap-2 text-sm text-[#a3a7b0]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />Firmware para {board.name}</p>
                            <p className="mt-2 [font-family:var(--font-display)] text-[56px] font-light leading-none tracking-[-0.04em] tabular-nums">
                                {version ?? (manifestMissing ? '—' : '…')}
                            </p>
                            <p className="mt-2 text-sm text-[#a3a7b0]">{version ? 'versão atual, gravada direto pelo navegador' : manifestMissing ? 'Firmware indisponível no momento' : 'Carregando a versão…'}</p>
                            <p className="mt-6 border-t border-white/10 pt-6 text-[15px] leading-relaxed text-[#c9ccd3]">Não sabe qual placa tem? O assistente descobre pelo USB, grava o firmware certo, configura o Wi-Fi pelo mesmo cabo e coloca o aparelho na sua conta.</p>
                            <div className="mt-7">
                                {!supportsWebSerial ? (
                                    <p className="rounded-2xl bg-white/5 p-4 text-sm text-[#c9ccd3]">Este navegador não acessa o USB. Abra esta página no <b>Chrome</b> ou no <b>Edge</b> de um computador.</p>
                                ) : (
                                    <Link to="/instalar/assistente" className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                                        <Usb size={18} /> Instalar no seu ESP32 <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                                    </Link>
                                )}
                            </div>
                            <p className="mt-4 text-xs text-[#a3a7b0]">A instalação apaga o que estiver gravado na placa.</p>
                        </div>
                    </div>
                </section>

                {/* 4. Wi-Fi e app (Cinza Regua) */}
                <section id="app" className="scroll-mt-28 bg-[#E4E6E9]">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
                        <StepTitle n={4}>Do celular, <span className="text-[var(--muted)]">em três toques.</span></StepTitle>
                        {headless ? (
                            <>
                                <p className="mt-6 max-w-2xl text-pretty text-lg text-[var(--muted)]">Configurou o Wi-Fi no instalador? Então pule direto para o app. Se pulou essa etapa, use a rede Breww:</p>
                                <ol className="relative mt-14 grid gap-8 max-md:pl-12 md:grid-cols-3 md:gap-6">
                                    <div className="absolute bottom-4 left-[17px] top-4 w-[3px] rounded-full bg-[#1fa84a] md:bottom-auto md:left-0 md:right-0 md:top-[17px] md:h-[3px] md:w-auto" aria-hidden />
                                    {[
                                        { icon: Wifi, title: 'Conecte na rede Breww', text: 'No celular, entre na rede Breww-XXXX. A página abre sozinha: escolha o Wi-Fi da sua casa e digite a senha.' },
                                        { icon: Smartphone, title: 'Abra o app', text: 'Volte para o Wi-Fi de casa e toque em Adicionar aparelho.' },
                                        { icon: Check, title: 'Pronto', text: 'Escolha o aparelho em Buscar na rede (ou digite o código da página de Wi-Fi). Ele entra na hora.' },
                                    ].map(({ icon: Icon, title, text }) => (
                                        <li key={title} className="relative">
                                            <span className="absolute -left-12 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#1fa84a] text-white md:static" aria-hidden><Icon size={16} /></span>
                                            <h3 className="text-xl font-semibold tracking-tight md:mt-6">{title}</h3>
                                            <p className="mt-2 leading-relaxed text-[var(--muted)]">{text}</p>
                                        </li>
                                    ))}
                                </ol>
                                <p className="mt-10 text-sm text-[var(--muted)]">LED da placa: piscando devagar = sem Wi-Fi; aceso = conectado. Segurar o BOOT por 10 segundos apaga o Wi-Fi e abre a rede Breww de novo.</p>
                            </>
                        ) : (
                            <p className="mt-6 max-w-2xl text-pretty text-lg text-[var(--muted)]">Siga o assistente na tela do aparelho para escolher o Wi-Fi. Depois, no app, toque em Adicionar aparelho e leia o QR code da tela.</p>
                        )}
                        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
                            <Link to="/register" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium text-white hover:bg-black">
                                Criar conta grátis <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </Link>
                            <p className="text-sm text-[var(--muted)]">Você vai precisar de uma conta no app. Algo deu errado? Veja a <Link to="/ajuda" className="font-medium text-[var(--ink)] underline underline-offset-4">ajuda</Link>.</p>
                        </div>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};

export default Installer;
