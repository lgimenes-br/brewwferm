import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Smartphone, Thermometer, ToggleRight, Usb, Plug, Monitor, Droplets, CircleDot, Gauge, Link2, Unplug, Box, Power, Ear, LineChart } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';

// Guia "Monte o seu" (/instalar), no mundo da home: malha so no topo, trilha fixa dos passos na linha verde,
// um tom de cinza por secao. Ordem segura (boas praticas de ESP32 com reles): pecas -> gravar e conectar a placa
// sozinha no USB -> sensores (baixa tensao) -> reles e tomada por ultimo, desligado -> primeiro lote no app.
// Cheio = fixo/ja existe; tracejado = nao fixo (opcional, a sua escolha ou ainda nao). A gravacao e no assistente.

export type Wire = { pin: string; to: string; note?: string; free?: boolean }; // free = o firmware acha sozinho (contorno tracejado)
// sensorPins: onde o DS18B20 e o DHT22 podem ir (o firmware procura sozinho; igual a pins_sensor_candidate)
export type Board = { id: string; name: string; hint: string; wires: Wire[]; relayDefault: string; sensorPins?: number[] };

// Reles e I2C: pinos fixos de boards/*.h. Sensores: qualquer pino de sensorPins (detectados sozinhos, v2.9.2+)
export const BOARDS: Board[] = [
    {
        id: 'esp32-devkit', name: 'ESP32 DevKit', hint: 'A mais barata e fácil de achar (WROOM-32 / DevKit V1).',
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
        id: 'c3-headless', name: 'ESP32-C3', hint: 'SuperMini e parecidas. Bem pequena, poucos pinos, mas suficiente.',
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
        id: 's3-35', name: 'Breww com tela 3,5"', hint: 'A placa oficial com tela touch. À venda em breve.',
        wires: [
            { pin: 'JST 4P · 3 ou 4', to: 'Sensor DS18B20 · dados', free: true },
            { pin: 'JST 8P · pino 1', to: 'Relé de aquecer' },
            { pin: 'JST 8P · pino 2', to: 'Relé de resfriar' },
            { pin: 'JST 4P · o outro', to: 'DHT22 · dados', note: 'opcional', free: true },
        ],
        relayDefault: 'Relés da placa oficial (nível alto)',
    },
];

const partsFor = (official: boolean) => [
    official
        ? { icon: Thermometer, title: 'Sensor DS18B20', text: 'A versão à prova d’água, com conector JST para encaixar na placa.' }
        : { icon: Thermometer, title: 'Sensor DS18B20', text: 'A versão à prova d’água, com cabo, e um resistor de 4,7 kΩ.' },
    official
        ? { icon: ToggleRight, title: 'Módulo de relé de 2 canais', text: 'Liga em nível alto, no conector JST 8P. Pelo menos 10 A por canal para a geladeira.' }
        : { icon: ToggleRight, title: 'Módulo de relé de 2 canais', text: 'Um canal liga o aquecimento, o outro a geladeira. Pelo menos 10 A por canal.' },
    { icon: Plug, title: 'Fonte 5 V', text: official ? 'Um carregador USB comum alimenta a placa.' : 'Um carregador USB comum alimenta a placa e o módulo de relé.' },
    { icon: Box, title: 'Fios e uma caixa fechada', text: 'Fios para os sensores e uma caixa para a parte que vai na tomada.' },
];
const EXTRAS = [
    { icon: Monitor, title: 'Tela OLED 0,96" ou LCD 20x4', text: 'I²C. Reconhecida sozinha ao ligar.' },
    { icon: Droplets, title: 'Umidade', text: 'SHT3x, AHT20, BME280 ou DHT22.' },
    { icon: CircleDot, title: 'Dois botões', text: 'Para ajustar o alvo e o menu na telinha.' },
    { icon: Gauge, title: 'iSpindel', text: 'Densímetro Wi-Fi para acompanhar a densidade.' },
];

const supportsWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator;
const isRelay = (w: Wire) => w.to.startsWith('Relé');
const SENSOR_POWER: Wire[] = [{ pin: '3,3 V', to: 'Sensores · alimentação (fio vermelho)' }, { pin: 'GND', to: 'Sensores · terra (fio preto)' }];
const RELAY_POWER: Wire[] = [{ pin: '5 V da fonte', to: 'Módulo de relé · VCC' }, { pin: 'GND', to: 'Módulo de relé · GND' }];

const STEPS = [
    { id: 'pecas', label: 'Peças' },
    { id: 'gravar', label: 'Gravar' },
    { id: 'sensores', label: 'Sensores' },
    { id: 'reles', label: 'Relés' },
    { id: 'app', label: 'Primeiro lote' },
];
const paperGrid = {
    backgroundImage: 'linear-gradient(rgba(11,13,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,18,0.05) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
} as const;
const h2 = 'text-balance [font-family:var(--font-display)] text-4xl font-light leading-[1.02] tracking-[-0.035em] sm:text-6xl';
const warnBox = 'flex gap-3 rounded-3xl border border-[#d63a4d]/30 bg-[#d63a4d]/[0.07] p-5 text-[15px] leading-relaxed text-[#7a1f2b] sm:p-6';

/** Titulo de passo: o numero e um no da linha (Verde No Alvo com Tinta: contraste alto) e faz parte do titulo para leitor de tela */
const StepTitle: React.FC<{ n: number; label: string; children: React.ReactNode; dark?: boolean }> = ({ n, label, children, dark }) => (
    <div className="flex items-start gap-4 sm:gap-5">
        <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums sm:mt-2 sm:h-11 sm:w-11 sm:text-base ${dark ? 'bg-[var(--accent)] text-[var(--ink)]' : 'bg-[var(--accent)] text-[var(--ink)] ring-4 ring-[#1fa84a]/15'}`} aria-hidden>{n}</span>
        <h2 className={h2}><span className="sr-only">Passo {n}, {label}: </span>{children}</h2>
    </div>
);

/** Trilha fixa: mostra onde a leitura esta (nao marca como "feito" so por rolar) e permite pular de passo */
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
        <nav aria-label="Passos do guia" className="sticky top-[60px] z-20 border-b border-black/5 bg-[var(--bg)]">
            <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
                <ol className="grid grid-cols-5">
                    {STEPS.map((s, k) => (
                        <li key={s.id}>
                            <a href={`#${s.id}`} aria-current={k === active ? 'step' : undefined}
                                className={`flex min-h-12 items-center gap-2 text-sm transition-colors ${k === active ? 'font-medium text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums transition-colors ${k === active ? 'bg-[var(--accent)] text-[var(--ink)] ring-4 ring-[#1fa84a]/20' : k < active ? 'border border-[var(--ink)]/40' : 'border border-dashed border-[var(--ink)]/35'}`}>{k + 1}</span>
                                <span className={`truncate ${k === active || (active < 0 && k === 0) ? '' : 'max-md:sr-only'}`}>{s.label}</span>
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

/** Mapa de fios em colunas fixas: pino | fio | destino (+ nota) */
const WireMap: React.FC<{ wires: Wire[] }> = ({ wires }) => (
    <ul className="space-y-3">
        {wires.map(w => (
            <li key={w.to} className="grid grid-cols-[8.5rem_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[8.5rem_2rem_1fr]">
                <span className={`rounded-full px-3 py-1.5 text-center text-sm ${w.free ? 'border border-dashed border-[var(--ink)]/40 text-[var(--ink)]' : 'bg-[var(--ink)] font-mono text-white'}`}>{w.pin}</span>
                <span aria-hidden className="hidden h-[2px] rounded-full bg-[#1fa84a] sm:block" />
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{w.to}</span>
                    {w.note && <span className={`rounded-full px-2.5 py-1 text-xs ${w.note === 'opcional' ? 'border border-dashed border-[var(--ink)]/25 text-[var(--muted)]' : 'border border-[var(--ink)]/20 text-[var(--ink)]'}`}>{w.note}</span>}
                </span>
            </li>
        ))}
    </ul>
);

const WireLegend: React.FC = () => (
    <span className="flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-full bg-[var(--ink)]" />pino fixo</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-full border border-dashed border-[var(--ink)]/50" />à sua escolha</span>
    </span>
);

/** Celular sem USB: manda o link desta etapa para abrir no computador */
const SendToComputer: React.FC<{ dark?: boolean; url: string }> = ({ dark, url }) => {
    const [copied, setCopied] = useState(false);
    const share = async () => {
        try {
            if (navigator.share) { await navigator.share({ title: 'Instalar o Breww', text: 'Abra no computador, com Chrome ou Edge:', url }); return; }
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch { /* fechou o compartilhamento */ }
    };
    return (
        <div className={`rounded-2xl p-4 text-sm ${dark ? 'bg-white/5 text-[#c9ccd3]' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>
            <p>A gravação é feita no computador, com <b className={dark ? 'text-white' : 'text-[var(--ink)]'}>Chrome</b> ou <b className={dark ? 'text-white' : 'text-[var(--ink)]'}>Edge</b> e a placa no USB.</p>
            <button type="button" onClick={share} className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-medium ${dark ? 'bg-white text-[var(--ink)]' : 'bg-[var(--ink)] text-white'}`}>
                <Link2 size={16} /> {copied ? 'Link copiado' : 'Mandar o link para o computador'}
            </button>
        </div>
    );
};

export const Installer: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const initial = BOARDS.some(b => b.id === params.get('placa')) ? params.get('placa')! : BOARDS[0].id;
    const [boardId, setBoardIdState] = useState(initial);
    const [boardNews, setBoardNews] = useState('');
    const setBoardId = (id: string) => {
        setBoardIdState(id);
        setParams(p => { p.set('placa', id); return p; }, { replace: true, preventScrollReset: true });
        setBoardNews(`Mostrando peças e ligações da ${BOARDS.find(b => b.id === id)?.name}`);
    };
    const [version, setVersion] = useState<string | null>(null);
    const [manifestMissing, setManifestMissing] = useState(false);
    const boardButtons = useRef<(HTMLButtonElement | null)[]>([]);
    const board = BOARDS.find(b => b.id === boardId)!;
    const official = board.id === 's3-35';
    const sensorWires = official ? board.wires.filter(w => !isRelay(w)) : [...board.wires.filter(w => !isRelay(w)), ...SENSOR_POWER];
    const relayWires = official ? board.wires.filter(isRelay) : [...board.wires.filter(isRelay), ...RELAY_POWER];
    const PARTS = partsFor(official);
    const wizardUrl = `/instalar/assistente?placa=${board.id}`;
    const absWizardUrl = typeof window !== 'undefined' ? `${window.location.origin}${wizardUrl}` : wizardUrl;

    useEffect(() => { document.title = 'Monte o seu Breww — Guia de montagem'; }, []);

    useEffect(() => {
        setVersion(null);
        setManifestMissing(false);
        fetch(`/firmware/manifest/${board.id}.json?t=${Date.now()}`)
            .then(r => (r.ok ? r.json() : Promise.reject()))
            .then(m => setVersion(m.version))
            .catch(() => setManifestMissing(true));
    }, [board.id]);

    // Radio de placas com setas (foco itinerante)
    const onBoardKey = (e: React.KeyboardEvent, k: number) => {
        const last = BOARDS.length - 1;
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? last
            : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (k + 1) % BOARDS.length
            : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (k + last) % BOARDS.length : -1;
        if (n < 0) return;
        e.preventDefault();
        setBoardId(BOARDS[n].id);
        boardButtons.current[n]?.focus();
    };

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />
            <p className="sr-only" aria-live="polite">{boardNews}</p>
            <main>
                {/* Topo, no papel milimetrado */}
                <section className="relative" style={paperGrid}>
                    <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 lg:pb-24 lg:pt-20">
                        <h1 className="max-w-[18ch] text-balance [font-family:var(--font-display)] text-[44px] font-light leading-[0.98] tracking-[-0.035em] sm:text-7xl lg:text-[84px]">
                            Monte o seu Breww. <span className="landing-mark">Sem compilar nada.</span>
                        </h1>
                        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-[var(--muted)]">
                            Compre as peças, grave o firmware pelo navegador e só depois ligue os fios. Sem instalar programa, do pacote à primeira leitura em cerca de meia hora.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <a href="#pecas" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[15px] font-medium text-white hover:bg-black">
                                Começar pela lista de peças <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                            </a>
                            <a href="#gravar" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-[var(--bg)]/70 px-6 text-[15px] font-medium backdrop-blur-sm hover:bg-white">
                                <Usb size={17} /> Já tenho as peças: gravar
                            </a>
                        </div>
                    </div>
                </section>

                <StepRail />

                {/* 1. Pecas, com a escolha da placa */}
                <section id="pecas" className="scroll-mt-28 bg-[#F7F7F8]">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
                        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
                            <StepTitle n={1} label="Peças">O essencial <span className="text-[var(--muted)]">cabe na palma da mão.</span></StepTitle>
                            <p className="max-w-md text-pretty text-lg leading-relaxed text-[var(--muted)]">Escolha a placa e junte mais quatro coisas. O resto é opcional e entra quando você quiser.</p>
                        </div>

                        <h3 className="mt-14 text-lg font-semibold tracking-tight" id="placa-titulo">Qual placa?</h3>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-labelledby="placa-titulo">
                            {BOARDS.map((b, k) => {
                                const on = b.id === boardId;
                                return (
                                    <button
                                        key={b.id}
                                        ref={el => { boardButtons.current[k] = el; }}
                                        role="radio"
                                        aria-checked={on}
                                        tabIndex={on ? 0 : -1}
                                        onClick={() => setBoardId(b.id)}
                                        onKeyDown={e => onBoardKey(e, k)}
                                        className={`rounded-2xl border p-4 text-left transition-colors ${on ? 'border-[var(--card)] bg-[var(--card)] text-white' : 'border-black/10 bg-white hover:border-black/25'}`}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="font-semibold">{b.name}</span>
                                            {on && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]"><Check size={13} strokeWidth={2.5} className="text-[var(--ink)]" /></span>}
                                        </span>
                                        <span className={`mt-1 block text-sm ${on ? 'text-[#a3a7b0]' : 'text-[var(--muted)]'}`}>{b.hint}</span>
                                        {b.id === 'esp32-devkit' && <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-[var(--accent)] text-[var(--ink)]' : 'border border-[var(--ink)]/25 text-[var(--ink)]'}`}>Recomendada</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <ul className="mt-12 grid gap-x-12 sm:grid-cols-2">
                            {PARTS.map(({ icon: Icon, title, text }) => (
                                <li key={title} className="flex gap-4 border-t border-black/10 py-6">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--accent)]"><Icon size={20} strokeWidth={1.75} /></span>
                                    <div><h3 className="text-lg font-semibold tracking-tight">{title}</h3><p className="mt-1 text-pretty leading-relaxed text-[var(--muted)]">{text}</p></div>
                                </li>
                            ))}
                        </ul>
                        <h3 className="mt-12 text-lg font-semibold tracking-tight">Se quiser mais <span className="font-normal text-[var(--muted)]">· opcionais</span></h3>
                        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {EXTRAS.map(({ icon: Icon, title, text }) => (
                                <li key={title} className="flex gap-3 rounded-2xl border border-dashed border-[var(--ink)]/25 p-4">
                                    <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--muted)]" />
                                    <div><p className="font-medium">{title}</p><p className="text-pretty text-sm text-[var(--muted)]">{text}</p></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* 2. Gravar e conectar: a placa sozinha no USB, pelo assistente (Grafite) */}
                <section id="gravar" className="on-dark scroll-mt-28 bg-[var(--card)] text-white">
                    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-start lg:py-28">
                        <div>
                            <StepTitle n={2} label="Gravar e conectar" dark>Grave e conecte <span className="text-[var(--accent)]">pelo navegador.</span></StepTitle>
                            <p className="mt-6 max-w-[34rem] text-pretty text-lg leading-relaxed text-[#c9ccd3]">
                                {official
                                    ? 'Antes de ligar qualquer fio: a placa sozinha no USB do computador. O assistente grava o firmware; depois a placa reinicia e o Wi-Fi e o vínculo com o app são feitos na tela dela.'
                                    : 'Antes de ligar qualquer fio: a placa sozinha no USB do computador. O assistente descobre qual é, grava o firmware certo, configura o Wi-Fi pelo mesmo cabo e mostra o código para adicionar no app.'}
                            </p>
                            <ul className="mt-8 space-y-3 text-[#c9ccd3]">
                                {['Placa sem nenhum fio ligado', 'Chrome ou Edge, no computador', 'Cabo USB de dados (alguns só carregam)', 'Rede Wi-Fi de 2,4 GHz e a senha dela'].map(t => (
                                    <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />{t}</li>
                                ))}
                                <li className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" /><span>O app Breww no celular e uma conta. <Link to="/register" className="font-medium text-white underline underline-offset-4">Criar conta grátis</Link></span></li>
                            </ul>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-[#0e1117]/70 p-7 sm:p-8">
                            <p className="flex items-center gap-2 text-sm text-[#a3a7b0]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />Assistente de instalação</p>
                            <p className="mt-2 text-2xl font-medium">{board.name}</p>
                            <p className="mt-1 text-sm tabular-nums text-[#a3a7b0]">{version ? `Firmware ${version}` : manifestMissing ? 'Firmware indisponível no momento' : 'Carregando a versão…'}</p>
                            <div className="mt-7">
                                {supportsWebSerial ? (
                                    <Link to={wizardUrl} className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                                        <Usb size={18} /> Abrir o assistente <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                                    </Link>
                                ) : (
                                    <SendToComputer dark url={absWizardUrl} />
                                )}
                            </div>
                            <p className="mt-5 flex gap-2 text-sm leading-relaxed text-[#c9ccd3]"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#ff8f9c]" />A gravação apaga o que estiver na placa.</p>

                        </div>
                    </div>
                </section>

                {/* 3. Sensores (baixa tensao) */}
                <section id="sensores" className="scroll-mt-28 bg-[var(--bg)]">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
                        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-end">
                            <StepTitle n={3} label="Sensores">Ligue os sensores. <span className="text-[var(--muted)]">Confira no app.</span></StepTitle>
                            <p className="max-w-md text-pretty text-lg leading-relaxed text-[var(--muted)]">Com a placa desligada do USB. Depois, religue e veja a temperatura aparecer no app antes de partir para os relés. Não apareceu? {official ? 'Confira se o cabo está bem encaixado no JST 4P.' : 'Confira o resistor e o pino de dados.'}</p>
                        </div>
                        <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                            <div className="rounded-3xl bg-white p-6 sm:p-8">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="text-lg font-semibold tracking-tight">Sensores · {board.name}</h3>
                                    <WireLegend />
                                </div>
                                <div className="mt-6"><WireMap wires={sensorWires} /></div>
                                {official ? (
                                    <p className="mt-6 text-pretty text-sm leading-relaxed text-[var(--muted)]">Os sensores encaixam no conector JST 4P. Os fios de dados do DS18B20 e do DHT22 podem ir em qualquer ordem nos pinos 3 e 4: a placa percebe e se ajusta sozinha.</p>
                                ) : (
                                    <div className="mt-6 rounded-2xl bg-[var(--bg)] p-4 sm:p-5">
                                        <p className="text-sm font-medium">Os 3 fios do DS18B20</p>
                                        <ul className="mt-3 space-y-2 text-sm">
                                            {[['#d63a4d', 'Vermelho', '3,3 V'], ['#0B0D12', 'Preto', 'GND'], ['#e8c33c', 'Amarelo (ou branco)', 'pino de dados à sua escolha']].map(([c, cor, onde]) => (
                                                <li key={cor} className="flex items-center gap-3"><span className="h-3 w-8 shrink-0 rounded-full" style={{ background: c }} aria-hidden /><span><b className="font-medium">{cor}</b> → {onde}</span></li>
                                            ))}
                                        </ul>
                                        <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--muted)]">O resistor de 4,7 kΩ liga o fio amarelo ao vermelho. Dois DS18B20 podem dividir o mesmo pino. O número do pino vem impresso na placa, ao lado dele (o GPIO 26 aparece como “26” ou “D26”).</p>
                                    </div>
                                )}
                            </div>
                            {board.sensorPins ? (
                                <div className="rounded-3xl border border-black/10 p-6 sm:p-8">
                                    <h3 className="text-lg font-semibold tracking-tight">Pinos à sua escolha</h3>
                                    <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Pinos livres para os sensores">
                                        {board.sensorPins.map(n => (
                                            <li key={n} className="rounded-full border border-dashed border-[var(--ink)]/30 bg-white px-2.5 py-0.5 font-mono text-xs">{n}</li>
                                        ))}
                                    </ul>
                                    <p className="mt-4 text-pretty text-sm leading-relaxed text-[var(--muted)]">
                                        Ligue o DS18B20 e o DHT22 em qualquer um deles: a placa procura e acha sozinha. Os outros pinos são da própria placa (memória, boot, USB) ou dos relés e do I²C.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-3xl border border-black/10 p-6 sm:p-8 text-pretty text-sm leading-relaxed text-[var(--muted)]">
                                    A placa com tela tem os conectores prontos: é só encaixar os cabos nos JST.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 4. Reles e tomada: por ultimo, sempre desligado */}
                <section id="reles" className="scroll-mt-28 bg-[#E4E6E9]">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
                        <StepTitle n={4} label="Relés e tomada">Relés e tomada, <span className="text-[var(--muted)]">por último.</span></StepTitle>
                        <div className={`mt-10 ${warnBox}`} role="note">
                            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-[#d63a4d]" />
                            <div>
                                <p className="font-semibold">Aqui entra a tensão da tomada (110/220 V).</p>
                                <p className="mt-1 text-pretty">Faça tudo com a extensão fora da tomada e a placa desligada do computador. Use caixa fechada e, sem experiência com elétrica, chame um eletricista.</p>
                            </div>
                        </div>

                        <div className="mt-8 grid gap-6 lg:grid-cols-2">
                            <div className="min-w-0 rounded-3xl bg-white p-6 sm:p-8">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <h3 className="text-lg font-semibold tracking-tight">Placa → módulo de relé</h3>
                                    <WireLegend />
                                </div>
                                <div className="mt-6"><WireMap wires={relayWires} /></div>
                                <p className="mt-6 text-pretty text-sm leading-relaxed text-[var(--muted)]">
                                    {official ? 'Os relés ligam no conector JST 8P da placa. ' : ''}Tipo de relé padrão: <b className="text-[var(--ink)]">{board.relayDefault}</b>. Usa SSR ou outro tipo? Troque no app, em Hardware.
                                </p>
                            </div>
                            <div className="min-w-0 rounded-3xl bg-white p-6 sm:p-8">
                                <h3 className="text-lg font-semibold tracking-tight">Lado da tomada</h3>
                                {/* esquema: a fase passa pelo rele de cada tomada; neutro e terra vao direto as duas tomadas */}
                                <p className="mt-2 text-pretty text-sm text-[var(--muted)]">Você monta uma extensão com duas tomadas comandadas: uma para o aquecedor, outra para a geladeira.</p>
                                <div className="mt-5 space-y-3 text-sm" role="img" aria-label="Esquema: a fase da extensão entra no COM de cada relé e sai pelo NA até a tomada do aquecedor e até a tomada da geladeira. O neutro e o terra vão direto às duas tomadas.">
                                    {[['Fase (L)', 'Relé de aquecer', 'Tomada do aquecedor'], ['Fase (L)', 'Relé de resfriar', 'Tomada da geladeira'], ['Neutro (N)', '', 'Direto às duas tomadas'], ['Terra (PE)', '', 'Direto às duas tomadas']].map(([de, rele, ate], r) => (
                                        <div key={r} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[6.5rem_1fr] sm:gap-3">
                                            <span className={`justify-self-start rounded-full px-3 py-1.5 text-center sm:justify-self-stretch ${r < 2 ? 'bg-[var(--ink)] text-white' : 'border border-[var(--ink)]/30'}`}>{de}</span>
                                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                                                {rele ? (<>
                                                    <span className="h-[3px] w-3 shrink-0 bg-[var(--ink)]" />
                                                    <span className="shrink-0 rounded-lg border border-[var(--ink)]/20 px-2 py-1"><span className="text-[var(--muted)]">{rele}:</span> COM → NA</span>
                                                    <span className="h-[3px] min-w-3 flex-1 bg-[var(--ink)] max-sm:hidden" />
                                                </>) : <span className="h-[2px] min-w-3 flex-1 bg-[var(--ink)]/45 max-sm:w-6 max-sm:flex-none" />}
                                                <span className="shrink-0 rounded-lg bg-[var(--bg)] px-2 py-1 font-medium">{ate}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-5 text-pretty text-sm leading-relaxed text-[var(--muted)]">NA = normalmente aberto: a tomada só recebe energia quando o Breww manda. Use relé de pelo menos 10 A e fio adequado à corrente do aparelho; o terra nunca passa pelo relé.</p>
                                <ol className="mt-5 grid gap-2 border-t border-black/10 pt-5 text-sm sm:grid-cols-2">
                                    {[[Unplug, 'Tire tudo da tomada'], [ToggleRight, 'Ligue os fios no relé'], [Box, 'Feche a caixa'], [Ear, 'Teste: mude o alvo no app e ouça cada relé estalar'], [Power, 'Só então ligue a extensão e os aparelhos']].map(([Icon, t]: any, i) => (
                                        <li key={t} className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]"><Icon size={14} /></span><span><span className="tabular-nums text-[var(--muted)]">{i + 1}.</span> {t}</span></li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 5. No app: o primeiro lote */}
                <section id="app" className="scroll-mt-28 bg-[#F7F7F8]">
                    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:py-28">
                        <StepTitle n={5} label="Primeiro lote">No app, <span className="text-[var(--muted)]">comece o primeiro lote.</span></StepTitle>
                        <ol className="relative mt-14 grid gap-8 max-md:pl-12 md:grid-cols-3 md:gap-6">
                            <div className="absolute bottom-4 left-[18px] top-4 border-l-[3px] border-dashed border-[#1fa84a]/70 md:bottom-auto md:left-0 md:right-0 md:top-[17px] md:border-l-0 md:border-t-[3px]" aria-hidden />
                            {[
                                { icon: Smartphone, title: 'Confira o aparelho no app', text: official ? 'No app, toque em Adicionar aparelho e leia o QR code da tela da placa. Ele aparece na lista com a temperatura.' : 'Ele aparece na lista com a temperatura. Se ainda não adicionou, toque em Adicionar aparelho e use o código do assistente.' },
                                { icon: LineChart, title: 'Escolha o perfil', text: 'Primária, diacetil, cold crash: monte as etapas ou pegue um perfil pronto da biblioteca.' },
                                { icon: Check, title: 'Comece o lote', text: 'O controlador troca a temperatura sozinho e avisa no celular se algo sair do ponto.' },
                            ].map(({ icon: Icon, title, text }) => (
                                <li key={title} className="relative">
                                    <span className="absolute -left-12 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-[var(--ink)]/35 bg-[#F7F7F8] text-[var(--ink)] md:static" aria-hidden><Icon size={16} /></span>
                                    <h3 className="text-xl font-semibold tracking-tight md:mt-6">{title}</h3>
                                    <p className="mt-2 text-pretty leading-relaxed text-[var(--muted)]">{text}</p>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
                            <p className="text-pretty text-sm text-[var(--muted)]">O app para iPhone e Android está em teste e chega às lojas em breve. Algo deu errado? Veja a <Link to="/ajuda" className="inline-block py-3.5 font-medium text-[var(--ink)] underline underline-offset-4">ajuda</Link>.</p>
                        </div>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};

export default Installer;
