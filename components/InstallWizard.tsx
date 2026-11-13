import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, ChevronDown, Cpu, Eye, EyeOff, Loader2, Lock, Monitor, RefreshCw, Smartphone, Usb, Wifi } from 'lucide-react';
import { SiteHeader } from './SiteChrome';
import { BOARDS } from './Installer';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { BoardId, ChipInfo, boardsForChip, detectChip, fetchFirmware, flashFirmware, requestPort, webSerialSupported } from '../services/espFlasher';
import { DeviceLink, WifiNetwork } from '../services/deviceLink';

// Assistente de instalacao (/instalar/assistente): conectar, identificar a placa, gravar, Wi-Fi pelo
// mesmo cabo (Improv), vincular a conta e pronto. A pagina /instalar continua como guia (pecas e ligacoes).
// Visual do mundo da home: titulo no papel milimetrado, trilha dos passos na linha verde (feito = cheio,
// atual = aceso, futuro = tracejado) e leituras da placa em paineis de instrumento Grafite.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Step = 'connect' | 'board' | 'flash' | 'wifi' | 'link' | 'done';
const STEPS: { id: Step; label: string }[] = [
    { id: 'connect', label: 'Conectar' },
    { id: 'board', label: 'Sua placa' },
    { id: 'flash', label: 'Gravar' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'link', label: 'No app' },
    { id: 'done', label: 'Pronto' },
];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const paperGrid = {
    backgroundImage: 'linear-gradient(rgba(11,13,18,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(11,13,18,0.05) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
} as const;

const btn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--ink)] hover:brightness-95`;
const btnDark = `${btn} bg-[var(--ink)] text-white hover:bg-black`;
const btnGhost = `${btn} border border-black/10 bg-white text-[var(--ink)] hover:bg-black/[0.03]`;

const Notice: React.FC<{ kind?: 'error' | 'warn' | 'info'; children: React.ReactNode }> = ({ kind = 'info', children }) => (
    <div role={kind === 'error' ? 'alert' : undefined} className={`flex gap-3 rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed ${
        kind === 'error' ? 'bg-[#fdecea] text-[#8a2418]' : kind === 'warn' ? 'border border-[#d63a4d]/30 bg-[#d63a4d]/[0.07] text-[#7a1f2b]' : 'bg-[var(--bg)] text-[#2b2f37]'}`}>
        {kind !== 'info' && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#d63a4d]" />}
        <div>{children}</div>
    </div>
);

const Heading: React.FC<{ title: React.ReactNode; text?: React.ReactNode }> = ({ title, text }) => (
    <div>
        <h2 id="etapa-titulo" tabIndex={-1} className="text-balance [font-family:var(--font-display)] text-4xl font-light leading-tight tracking-[-0.03em] outline-none">{title}</h2>
        {text && <p className="mt-3 max-w-[38rem] text-pretty text-[15px] leading-relaxed text-[var(--muted)]">{text}</p>}
    </div>
);

const Bars: React.FC<{ rssi: number }> = ({ rssi }) => {
    const n = rssi > -55 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
    return (
        <span className="inline-flex items-end gap-[2px]" role="img" aria-label={`Sinal ${n} de 4`}>
            {[1, 2, 3, 4].map(k => <span key={k} className={`w-[3px] rounded-sm ${k <= n ? 'bg-[#1fa84a]' : 'bg-black/15'}`} style={{ height: 4 + k * 3 }} />)}
        </span>
    );
};

// Mesmos nomes do guia (components/Installer.tsx)
const BOARD_NAME = Object.fromEntries(BOARDS.map(b => [b.id, b.name])) as Record<BoardId, string>;
// Chip lido do firmware (Improv) -> placa sem tela
const boardFromChip = (chip?: string): BoardId => { const c = (chip || '').toUpperCase(); return c.includes('C3') ? 'c3-headless' : c.includes('S3') ? 's3-headless' : 'esp32-devkit'; };

export const InstallWizard: React.FC = () => {
    const { token: authToken } = useAuth();
    // Login feito em outra aba (botoes Criar conta / Entrar abrem nova aba): o evento storage traz o token
    const [token, setToken] = useState<string | null>(authToken);
    useEffect(() => { setToken(authToken); }, [authToken]);
    useEffect(() => {
        const onStorage = (e: StorageEvent) => { if (e.key === 'token') setToken(e.newValue); };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    const [params] = useSearchParams();
    const guideBoard = params.get('placa') as BoardId | null;
    const [step, setStep] = useState<Step>('connect');
    const [announce, setAnnounce] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);

    const portRef = useRef<any>(null);
    const linkRef = useRef<DeviceLink | null>(null);
    const [chip, setChip] = useState<ChipInfo | null>(null);
    const [board, setBoard] = useState<BoardId | null>(null);

    const [version, setVersion] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [stage, setStage] = useState<'idle' | 'download' | 'connect' | 'erase' | 'write' | 'reboot'>('idle');

    const [improvOk, setImprovOk] = useState<boolean | null>(null);
    const [deviceName, setDeviceName] = useState<string | null>(null);
    const [networks, setNetworks] = useState<WifiNetwork[] | null>(null);
    const [ssid, setSsid] = useState('');
    const [manualSsid, setManualSsid] = useState(false);
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);

    const [pair, setPair] = useState<{ code: string; id: string } | null>(null);
    const [pairFailed, setPairFailed] = useState(false);
    const [pairTry, setPairTry] = useState(0);
    const [name, setName] = useState('Meu Breww');
    const [linked, setLinked] = useState(false);
    const [addedInApp, setAddedInApp] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => { document.title = 'Instalar o Breww — Assistente'; }, []);
    useEffect(() => () => { linkRef.current?.close(); }, []);
    useEffect(() => {
        setError(null);
        window.scrollTo({ top: 0 });
        const k = STEPS.findIndex(s => s.id === step);
        setAnnounce(`Passo ${k + 1} de ${STEPS.length}: ${STEPS[k].label}`);
        if (step !== 'connect') requestAnimationFrame(() => document.getElementById('etapa-titulo')?.focus());
    }, [step]);
    // Gravando: avisa antes de fechar ou recarregar (a gravacao recomeca do zero)
    const flashing = stage !== 'idle' && stage !== 'reboot';
    useEffect(() => {
        if (!flashing) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [flashing]);
    // Leitor de tela: a gravacao e anunciada so nos marcos
    const lastMark = useRef(0);
    useEffect(() => {
        if (stage !== 'write') { lastMark.current = 0; return; }
        const mark = [25, 50, 75, 100].filter(m => progress * 100 >= m).pop() || 0;
        if (mark > lastMark.current) { lastMark.current = mark; setAnnounce(`Gravação em ${mark}%`); }
    }, [progress, stage]);

    const headless = board !== 's3-35';
    const current = STEPS.findIndex(s => s.id === step);

    // ---------- 1. Conectar e identificar ----------
    const connect = async () => {
        setError(null);
        let port;
        try { port = await requestPort(); } catch { return; } // fechou a lista do sistema
        portRef.current = port;
        setBusy(true);
        try {
            const info = await detectChip(port);
            setChip(info);
            const options = boardsForChip(info.chip);
            setBoard(options.length === 1 ? options[0] : guideBoard && options.includes(guideBoard) ? guideBoard : null);
            setStep('board');
        } catch (e) {
            const msg = String((e as Error)?.message || e);
            setError(msg.toLowerCase().includes('open') || msg.toLowerCase().includes('busy')
                ? <>A porta está em uso por outro programa. Feche a Arduino IDE, o monitor serial ou outra aba do instalador e tente de novo.</>
                : <>Não consegui falar com a placa. Segure o botão <b>BOOT</b> da placa, clique em <b>Conectar a placa</b> de novo e solte o BOOT quando a gravação começar. Se não funcionar, troque o cabo: muitos só carregam.</>);
        } finally { setBusy(false); }
    };

    // ---------- 1b. A placa ja tem o Breww: so Wi-Fi e conta ----------
    const connectExisting = async () => {
        setError(null);
        let port;
        try { port = await requestPort(); } catch { return; }
        portRef.current = port;
        setBusy(true);
        try {
            linkRef.current?.close();
            const link = await DeviceLink.open(port, 8000);
            linkRef.current = link;
            await link.waitImprov(12000);
            const info = await link.info();
            setBoard(boardFromChip(info?.chip));
            if (info?.name) setDeviceName(info.name);
            setImprovOk(true);
            setStep('wifi');
        } catch {
            linkRef.current?.close(); linkRef.current = null;
            setError(guideBoard === 's3-35'
                ? <>A placa com tela configura o Wi-Fi e o app na própria tela: não precisa do assistente depois de gravada.</>
                : <>Não encontrei o Breww nessa placa. Se ela ainda não foi gravada, use <b>Conectar a placa</b> para gravar.</>);
        } finally { setBusy(false); }
    };

    // ---------- 3. Gravar ----------
    const flash = async () => {
        if (!board || !portRef.current) return;
        setError(null);
        setBusy(true);
        setProgress(0);
        setStep('flash');
        try {
            setStage('download');
            const fw = await fetchFirmware(board);
            setVersion(fw.version);
            await flashFirmware(portRef.current, fw.data, (p, s) => { setStage(s); setProgress(p); });
            setStage('reboot');
            if (!headless) { setStep('link'); return; }
            // A placa reinicia: reabre a mesma porta e espera o firmware responder ao Improv
            const link = await DeviceLink.open(portRef.current, 12000);
            linkRef.current = link;
            try {
                await link.waitImprov(25000);
                setImprovOk(true);
                const info = await link.info();
                if (info?.name) setDeviceName(info.name);
            } catch { setImprovOk(false); }
            setStep('wifi');
        } catch (e) {
            setStage('idle');
            console.error('Gravação:', e);
            setError(<>A gravação parou no meio. Confira o cabo (de preferência direto no computador, sem hub) e tente de novo: ela recomeça do zero, sem problema.</>);
        } finally { setBusy(false); }
    };

    // ---------- 4. Wi-Fi ----------
    const scan = useCallback(async () => {
        const link = linkRef.current;
        if (!link) return;
        setNetworks(null);
        try { setNetworks(await link.scan()); } catch { setNetworks([]); }
    }, []);
    useEffect(() => { if (step === 'wifi' && improvOk) scan(); }, [step, improvOk, scan]);

    const reconnectPort = async () => {
        setError(null);
        let port;
        try { port = await requestPort(); } catch { return; }
        portRef.current = port;
        setBusy(true);
        try {
            linkRef.current?.close();
            const link = await DeviceLink.open(port, 8000);
            linkRef.current = link;
            await link.waitImprov(15000);
            setImprovOk(true);
            const info = await link.info();
            if (info?.name) setDeviceName(info.name);
        } catch { setImprovOk(false); setError('A placa ainda não respondeu. Espere alguns segundos e tente reconectar.'); } finally { setBusy(false); }
    };

    const sendWifi = async () => {
        const link = linkRef.current;
        if (!link || !ssid.trim()) return;
        setError(null);
        setBusy(true);
        try {
            const ok = await link.provision(ssid.trim(), password);
            if (!ok) { setError(<>A placa não conseguiu entrar em <b>{ssid}</b>. Confira a senha. Lembre que o ESP32 só funciona em redes de 2,4 GHz.</>); return; }
            setStep('link');
        } catch {
            setError(<>A placa não respondeu a tempo. Tente de novo; se continuar, use <b>Reconectar a placa</b> logo abaixo.</>);
        } finally { setBusy(false); }
    };

    // ---------- 5. Conta ----------
    useEffect(() => {
        if (step !== 'link' || !headless || pair) return;
        const link = linkRef.current;
        if (!link) { setPairFailed(true); return; }
        let alive = true;
        setPairFailed(false);
        link.pairCode(25000).then(p => { if (!alive) return; if (p) setPair(p); else setPairFailed(true); });
        return () => { alive = false; };
    }, [step, headless, pair, pairTry]);

    const bind = async () => {
        if (!token || !pair) return;
        setError(null);
        setBusy(true);
        try {
            // A placa avisa a nuvem logo depois de conectar: se o servidor ainda nao a viu, tenta por ate 40 s
            for (let i = 0; i < 10; i++) {
                const r = await fetch(`${API_URL}/devices`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ pairCode: pair.code, name: name.trim() || 'Meu Breww' }),
                });
                if (r.ok) { setLinked(true); setStep('done'); return; }
                const data = await r.json().catch(() => ({}));
                if (r.status !== 422 || i === 9) { setError(data?.error || 'Não foi possível adicionar o aparelho.'); return; }
                await sleep(4000);
            }
        } catch { setError('Sem conexão com o servidor. Tente de novo.'); } finally { setBusy(false); }
    };

    const restart = () => {
        linkRef.current?.close();
        linkRef.current = null; portRef.current = null;
        setChip(null); setBoard(null); setVersion(null); setProgress(0); setStage('idle');
        setImprovOk(null); setNetworks(null); setSsid(''); setPassword(''); setPair(null); setPairFailed(false); setLinked(false); setDeviceName(null);
        setStep('connect');
    };

    const PairPanel = pair ? (
        <div className="on-dark rounded-3xl bg-[var(--card)] p-6 text-white sm:p-7">
            <p className="flex items-center gap-2 text-sm text-[#a3a7b0]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />Código do aparelho</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="font-mono text-4xl tracking-[0.12em] text-[var(--accent)] tabular-nums">{pair.code}</p>
                <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm font-medium hover:bg-white/10"
                    onClick={() => { navigator.clipboard?.writeText(pair.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {}); }}>
                    {copied ? 'Copiado' : 'Copiar'}
                </button>
            </div>
            <p className="mt-2 text-sm text-[#a3a7b0]">É este código que o app pede. O número de série é <span className="tabular-nums">{pair.id}</span>.</p>
        </div>
    ) : null;
    const ReconnectButton = (
        <button type="button" className={btnGhost} onClick={async () => { await reconnectPort(); setPairTry(t => t + 1); }} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reconectar a placa
        </button>
    );
    const ReconnectLink = (
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--ink)]" onClick={async () => { await reconnectPort(); setPairTry(t => t + 1); }} disabled={busy}>
            <RefreshCw size={14} /> A placa desconectou? Reconectar
        </button>
    );
    const mismatch = guideBoard && board && guideBoard !== board;

    const stageLabel = { idle: '', download: 'Baixando o firmware…', connect: 'Conectando à placa…', erase: 'Apagando a memória…', write: 'Gravando o firmware…', reboot: 'Gravado! Reiniciando a placa…' }[stage];

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader minimal={{ label: 'Voltar ao guia', to: board ? `/instalar?placa=${board}` : '/instalar', locked: flashing }} />
            <p className="sr-only" aria-live="polite">{announce}</p>
            <main>
                <div style={paperGrid}>
                    {step === 'connect' ? (
                        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:pb-14 lg:pt-12">
                            <h1 className="text-balance [font-family:var(--font-display)] text-[44px] font-light leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-[72px]">
                                Instalar o Breww <span className="text-[var(--muted)]">no seu ESP32.</span>
                            </h1>
                        </div>
                    ) : (
                        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
                            <h1 className="[font-family:var(--font-display)] text-2xl font-light tracking-[-0.02em]">Instalar o Breww <span className="text-[var(--muted)]">{board ? `· ${BOARD_NAME[board]}` : 'no seu ESP32'}</span></h1>
                        </div>
                    )}
                </div>
                <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">

                {/* progresso no celular */}
                <div className="mt-8 lg:hidden">
                    <div className="flex justify-between text-sm"><span className="font-medium">{STEPS[current].label}</span><span className="tabular-nums text-[var(--muted)]">Passo {current + 1} de {STEPS.length}</span></div>
                    <div className="relative mt-3 flex items-center justify-between" aria-hidden>
                        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-[var(--ink)]/25" />
                        <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#1fa84a] transition-all duration-500" style={{ width: `${(current / (STEPS.length - 1)) * 100}%` }} />
                        {STEPS.map((s, k) => (
                            <span key={s.id} className={`relative h-3 w-3 rounded-full ${k < current ? 'bg-[#1fa84a]' : k === current ? 'bg-[var(--accent)] ring-4 ring-[#1fa84a]/25' : 'border border-dashed border-[var(--ink)]/40 bg-[var(--bg)]'}`} />
                        ))}
                    </div>
                </div>

                <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[200px_1fr] lg:gap-14">
                    {/* passos no computador */}
                    <ol className="relative hidden self-start lg:block" aria-label="Passos da instalação">
                        <div className="absolute bottom-7 left-[13px] top-7 border-l border-dashed border-[var(--ink)]/25" aria-hidden />
                        <div className="absolute left-[12px] top-7 w-[3px] rounded-full bg-[#1fa84a] transition-all duration-500" style={{ height: `calc((100% - 3.5rem) * ${current / (STEPS.length - 1)})` }} aria-hidden />
                        {STEPS.map((s, k) => (
                            <li key={s.id} aria-current={k === current ? 'step' : undefined}
                                className={`relative flex min-h-14 items-center gap-4 text-[15px] ${k === current ? 'font-medium text-[var(--ink)]' : k < current ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${k < current ? 'bg-[#1fa84a] text-white' : k === current ? 'bg-[var(--accent)] text-[var(--ink)] ring-4 ring-[#1fa84a]/20' : 'border border-dashed border-[var(--ink)]/40 bg-[var(--bg)]'}`}>
                                    {k < current ? <Check size={14} strokeWidth={2.5} /> : k + 1}
                                </span>
                                {s.label}
                            </li>
                        ))}
                    </ol>

                    <section className="rounded-[28px] bg-white p-6 sm:p-10">
                        {/* 1. CONECTAR */}
                        {step === 'connect' && (
                            <div className="space-y-7">
                                <Heading title="Ligue a placa no computador" text={<>Use um cabo USB de dados. O assistente descobre qual placa é, grava o firmware certo, configura o Wi-Fi e mostra o código para adicionar no app.{guideBoard && BOARD_NAME[guideBoard] ? <> Placa escolhida no guia: <b className="text-[var(--ink)]">{BOARD_NAME[guideBoard]}</b>.</> : null}</>} />
                                <ul className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
                                    {[
                                        [Cpu, 'Só a placa, sem fios', 'Sensores e relés entram depois de gravar, com a placa desligada.'],
                                        [Usb, 'Cabo de dados', 'Muitos cabos só carregam. Se a placa não aparecer, troque o cabo.'],
                                        [Monitor, 'Chrome ou Edge', 'No computador. Safari, Firefox e celular não acessam o USB.'],
                                        [Smartphone, 'App Breww e uma conta', <>No fim, você adiciona o aparelho no app. <a href="/register" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--ink)] underline underline-offset-4">Criar conta grátis</a></>],
                                    ].map(([Icon, t, d]: any) => (
                                        <li key={t} className="flex gap-4 py-4">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--card)] text-[var(--accent)]"><Icon size={18} /></span>
                                            <div><p className="font-medium">{t}</p><p className="mt-0.5 text-pretty text-sm leading-snug text-[var(--muted)]">{d}</p></div>
                                        </li>
                                    ))}
                                </ul>
                                {!webSerialSupported() ? (
                                    <Notice kind="warn">Este navegador não acessa o USB. Abra esta página no <b>Chrome</b> ou no <b>Edge</b> de um computador.</Notice>
                                ) : (
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <button type="button" className={btnPrimary} onClick={connect} disabled={busy}>
                                                {busy ? <><Loader2 size={18} className="animate-spin" /> Lendo a placa…</> : <><Usb size={18} /> Conectar a placa</>}
                                            </button>
                                            <p className="max-w-[38rem] text-pretty text-sm text-[var(--muted)]">O navegador vai pedir para você escolher a porta da placa. O assistente descobre qual é e grava o Breww.</p>
                                        </div>
                                        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[var(--ink)]/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="font-medium">Esta placa já tem o Breww?</p>
                                                <p className="mt-0.5 max-w-[30rem] text-pretty text-sm text-[var(--muted)]">Para quando a gravação já foi feita: recarregou a página no meio, trocou o Wi-Fi de casa ou vai reaproveitar a placa. Pula a gravação e vai direto para o Wi-Fi.</p>
                                            </div>
                                            <button type="button" className={`${btnGhost} shrink-0`} onClick={connectExisting} disabled={busy}>Só configurar o Wi-Fi</button>
                                        </div>
                                    </div>
                                )}
                                {error && <Notice kind="error">{error}</Notice>}
                                <details className="group rounded-2xl border border-dashed border-[var(--ink)]/20 px-4 text-sm text-[var(--muted)]">
                                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-medium text-[var(--ink)] [&::-webkit-details-marker]:hidden">
                                        A placa não aparece na lista
                                        <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <ul className="mt-3 list-disc space-y-1.5 pl-5">
                                        <li>Troque o cabo USB: os que vêm com fones e luminárias costumam só carregar.</li>
                                        <li>Algumas placas precisam do driver do chip USB: <b>CH340</b> ou <b>CP210x</b>, no site do fabricante.</li>
                                        <li>Segure o botão <b>BOOT</b> enquanto liga o cabo.</li>
                                        <li>Feche a Arduino IDE e qualquer monitor serial aberto.</li>
                                    </ul>
                                    <div className="h-4" />
                                </details>
                            </div>
                        )}

                        {/* 2. PLACA */}
                        {step === 'board' && chip && (
                            <div className="space-y-7">
                                {boardsForChip(chip.chip).length === 0 ? (
                                    <>
                                        <Heading title={<>Essa placa é um {chip.chip}</>} text="O Breww funciona com ESP32, ESP32-S3 e ESP32-C3. Essa placa não tem o que o firmware precisa." />
                                        <Notice kind="warn">A mais fácil de achar é a <b>ESP32 DevKit (WROOM-32)</b>. Veja as opções no <Link to="/instalar#pecas" className="underline">guia de montagem</Link>.</Notice>
                                        <button type="button" className={btnGhost} onClick={restart}><RefreshCw size={16} /> Conectar outra placa</button>
                                    </>
                                ) : (
                                    <>
                                        <Heading title={<>Encontramos um <span className="landing-mark">{chip.chip}</span></>} />
                                        <dl className="on-dark grid gap-5 rounded-3xl bg-[var(--card)] p-6 text-white sm:grid-cols-[1fr_1fr_1.4fr] sm:p-7">
                                            <div><dt className="flex items-center gap-2 text-sm text-[#a3a7b0]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />Placa</dt><dd className="mt-1.5 text-lg font-medium">{board ? BOARD_NAME[board] : chip.chip}</dd></div>
                                            <div><dt className="text-sm text-[#a3a7b0]">Memória</dt><dd className="mt-1.5 text-lg font-medium tabular-nums">{chip.flashSize || '—'}</dd></div>
                                            <div><dt className="text-sm text-[#a3a7b0]">Chip</dt><dd className="mt-1.5 text-sm leading-snug text-[#c9ccd3]">{chip.description}</dd></div>
                                        </dl>

                                        {chip.chip.toUpperCase() === 'ESP32-S3' && (
                                            <fieldset>
                                                <legend className="font-medium">Sua placa tem a tela touch de 3,5"?</legend>
                                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                    {(['s3-headless', 's3-35'] as BoardId[]).map(b => (
                                                        <label key={b} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${board === b ? 'border-[var(--ink)] bg-[var(--bg)]' : 'border-black/10 hover:bg-black/[0.02]'}`}>
                                                            <input type="radio" name="s3" className="mt-1 accent-[#0B0D12]" checked={board === b} onChange={() => setBoard(b)} />
                                                            <span><span className="font-medium">{b === 's3-35' ? 'Sim, é a placa Breww com tela' : 'Não, é um ESP32-S3 comum'}</span>
                                                                <span className="mt-0.5 block text-sm text-[var(--muted)]">{b === 's3-35' ? 'O Wi-Fi e o vínculo são feitos na própria tela.' : 'DevKitC ou parecida, sem tela.'}</span></span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </fieldset>
                                        )}

                                        {mismatch && <Notice>No guia você escolheu <b>{BOARD_NAME[guideBoard!]}</b>, mas esta placa é <b>{BOARD_NAME[board!]}</b>. Os pinos mudam: na hora de ligar os fios, o guia já abre com a placa certa.</Notice>}
                                        <Notice kind="warn">A gravação apaga tudo o que estiver na placa e leva cerca de um minuto.</Notice>
                                        <div className="flex flex-wrap gap-3">
                                            <button type="button" className={btnPrimary} disabled={!board || busy} onClick={flash}><Usb size={18} /> Gravar o firmware</button>
                                            <button type="button" className={btnGhost} onClick={restart}>Conectar outra placa</button>
                                        </div>
                                        {!board && <p className="text-sm text-[var(--muted)]">Responda acima se a placa tem tela para continuar.</p>}
                                    </>
                                )}
                            </div>
                        )}

                        {/* 3. GRAVAR */}
                        {step === 'flash' && board && (
                            <div className="space-y-7">
                                <Heading title={<>Gravar o Breww no {BOARD_NAME[board]}</>} text="Leva cerca de um minuto. Não desligue o cabo até terminar." />
                                {stage === 'idle' ? null : (
                                    <div className="on-dark rounded-3xl bg-[var(--card)] p-6 text-white sm:p-7">
                                        <div className="flex items-end justify-between gap-4">
                                            <span className="flex items-center gap-2 text-[15px] text-[#c9ccd3]"><Loader2 size={16} className="animate-spin text-[var(--accent)]" />{stageLabel}</span>
                                            {stage === 'write' && (
                                                <span className="[font-family:var(--font-display)] text-[56px] font-light leading-none tracking-[-0.04em] tabular-nums">
                                                    {Math.round(progress * 100)}<span className="text-2xl text-[#a3a7b0]">%</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Gravação do firmware" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage === 'write' ? Math.round(progress * 100) : undefined}>
                                            <div className={`h-full rounded-full bg-[var(--accent)] transition-all ${stage !== 'write' ? 'w-1/3 animate-pulse' : ''}`} style={stage === 'write' ? { width: `${Math.max(3, progress * 100)}%` } : undefined} />
                                        </div>
                                        {version && <p className="mt-4 text-sm text-[#a3a7b0]">Firmware {version}</p>}
                                    </div>
                                )}
                                {error && <><Notice kind="error">{error}</Notice><button type="button" className={btnGhost} onClick={flash} disabled={busy}><RefreshCw size={16} /> Tentar de novo</button></>}
                            </div>
                        )}

                        {/* 4. WI-FI */}
                        {step === 'wifi' && (
                            <div className="space-y-7">
                                <Heading title="Conecte a placa ao seu Wi-Fi" text={<>Pelo mesmo cabo USB. Use a rede de <b>2,4 GHz</b> da sua casa: o ESP32 não enxerga redes de 5 GHz.</>} />
                                {improvOk === false ? (
                                    <>
                                        <Notice kind="warn">A placa foi gravada, mas não respondeu pelo cabo. Às vezes o USB demora a voltar depois de reiniciar.</Notice>
                                        <div className="flex flex-wrap gap-3">
                                            <button type="button" className={btnDark} onClick={reconnectPort} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reconectar a placa</button>
                                        </div>
                                        <Notice>Também dá pelo celular: entre na rede <b>Breww-XXXX</b> que a placa cria, escolha o Wi-Fi da sua casa e digite a senha. Depois volte aqui e toque em <b>Pular</b>.</Notice>
                                        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setStep('link')}>Pular: configurei pelo celular</button>
                                    </>
                                ) : (
                                    <>
                                        {deviceName && <p className="text-sm text-[var(--muted)]">Aparelho <b className="text-[var(--ink)]">{deviceName}</b></p>}
                                        {!manualSsid && (
                                            <div>
                                                <div className="mb-2 flex items-center justify-between">
                                                    <p className="font-medium">Redes encontradas</p>
                                                    <button type="button" onClick={scan} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]" disabled={!networks}><RefreshCw size={14} /> Procurar de novo</button>
                                                </div>
                                                <p className="mb-3 text-sm text-[var(--muted)]">Só aparecem as redes de 2,4 GHz, que são as que a placa consegue usar.</p>
                                                {!networks ? (
                                                    <p className="flex items-center gap-2 rounded-2xl bg-[var(--bg)] px-4 py-4 text-[15px] text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> Procurando redes…</p>
                                                ) : networks.length === 0 ? (
                                                    <Notice>Nenhuma rede encontrada. Procure de novo ou digite o nome da rede.</Notice>
                                                ) : (
                                                    <fieldset className="max-h-72 divide-y divide-black/[0.06] overflow-auto rounded-2xl border border-black/[0.07]">
                                                        <legend className="sr-only">Redes Wi-Fi</legend>
                                                        {networks.map(n => (
                                                            <label key={n.ssid} className={`flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3 text-[15px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-[var(--ink)] ${ssid === n.ssid ? 'bg-[var(--bg)] font-medium' : 'hover:bg-black/[0.02]'}`}>
                                                                <input type="radio" name="rede" className="sr-only" checked={ssid === n.ssid} onChange={() => setSsid(n.ssid)} />
                                                                <Wifi size={17} className="shrink-0 text-[var(--muted)]" />
                                                                <span className="flex-1 truncate">{n.ssid}</span>
                                                                {n.secured && <Lock size={14} className="text-[var(--muted)]" aria-label="Com senha" />}
                                                                <Bars rssi={n.rssi} />
                                                                {ssid === n.ssid && <Check size={17} className="text-[#1fa84a]" />}
                                                            </label>
                                                        ))}
                                                    </fieldset>
                                                )}
                                            </div>
                                        )}
                                        {manualSsid && (
                                            <label className="block">
                                                <span className="font-medium">Nome da rede</span>
                                                <input value={ssid} onChange={e => setSsid(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--ink)]" />
                                            </label>
                                        )}
                                        <button type="button" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4" onClick={() => { if (manualSsid) setSsid(''); setManualSsid(m => !m); }}>
                                            {manualSsid ? 'Escolher da lista' : 'Minha rede não aparece (rede oculta)'}
                                        </button>
                                        <label className="block">
                                            <span className="font-medium">Senha do Wi-Fi</span>
                                            <span className="mt-2 flex items-center rounded-2xl border border-black/10 bg-white focus-within:border-[var(--ink)]">
                                                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"
                                                    className="w-full rounded-2xl bg-transparent px-4 py-3.5 text-[16px] outline-none" onKeyDown={e => { if (e.key === 'Enter') sendWifi(); }} />
                                                <button type="button" className="px-4 text-[var(--muted)]" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Esconder senha' : 'Mostrar senha'}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                            </span>
                                        </label>
                                        {error && <Notice kind="error">{error}</Notice>}
                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                                            <button type="button" className={btnPrimary} onClick={sendWifi} disabled={busy || !ssid.trim()}>
                                                {busy ? <><Loader2 size={18} className="animate-spin" /> Conectando…</> : <>Conectar ao Wi-Fi <ArrowRight size={18} /></>}
                                            </button>
                                            {ReconnectLink}
                                        </div>
                                        {!ssid.trim() && <p className="text-sm text-[var(--muted)]">Escolha uma rede para continuar.</p>}
                                    </>
                                )}
                            </div>
                        )}

                        {/* 5. CONTA */}
                        {step === 'link' && (
                            <div className="space-y-7">
                                {!headless ? (
                                    <>
                                        <Heading title="Termine na tela da placa" text="A placa com tela reinicia mostrando o assistente: escolha o Wi-Fi ali mesmo. Depois, no app, toque em Adicionar aparelho e leia o QR code que aparece na tela." />
                                        <button type="button" className={btnPrimary} onClick={() => setStep('done')}>Pronto, terminei <ArrowRight size={18} /></button>
                                    </>
                                ) : (
                                    <>
                                        <Heading title="Adicione o Breww no app" text="O Wi-Fi conectou. Agora o aparelho entra na sua conta pelo app." />
                                        {!pair && pairFailed ? (
                                            <>
                                                <Notice kind="warn">{linkRef.current ? <>Não consegui ler o código pelo cabo. Tente reconectar, ou siga sem ele: no app, <b>Adicionar aparelho</b> encontra o Breww em <b>Buscar na rede</b>.</> : <>Sem o cabo não dá para ler o código. Sem problema: no app, <b>Adicionar aparelho</b> encontra o Breww em <b>Buscar na rede</b> (o celular precisa estar no mesmo Wi-Fi).</>}</Notice>
                                                <div>{ReconnectButton}</div>
                                            </>
                                        ) : !pair ? (
                                            <p className="flex items-center gap-2 rounded-2xl bg-[var(--bg)] px-4 py-4 text-[15px] text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> Buscando o código do aparelho…</p>
                                        ) : PairPanel}
                                        {token ? (
                                            <>
                                                <label className="block">
                                                    <span className="font-medium">Nome do aparelho</span>
                                                    <input value={name} onChange={e => setName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--ink)]" />
                                                </label>
                                                {error && <Notice kind="error">{error}</Notice>}
                                                <button type="button" className={btnPrimary} onClick={bind} disabled={busy || !pair}>
                                                    {busy ? <><Loader2 size={18} className="animate-spin" /> Adicionando…</> : <>Adicionar à minha conta <ArrowRight size={18} /></>}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <ol className="space-y-2 text-[15px] leading-relaxed">
                                                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold tabular-nums">1</span>Abra o app Breww no celular e entre na sua conta.</li>
                                                    <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold tabular-nums">2</span><span>Toque em <b>Adicionar aparelho</b> e escolha o Breww em <b>Buscar na rede</b> (no mesmo Wi-Fi){pair ? ' ou digite o código acima' : ''}.</span></li>
                                                </ol>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <button type="button" className={btnPrimary} onClick={() => { setAddedInApp(true); setStep('done'); }}>Pronto, adicionei no app <ArrowRight size={18} /></button>
                                                    <a href="/register" target="_blank" rel="noopener noreferrer" className={btnGhost}>Ainda não tenho conta</a>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* 6. PRONTO */}
                        {step === 'done' && (
                            <div className="space-y-7">
                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]"><Check size={28} className="text-[var(--ink)]" /></span>
                                <Heading title={linked || addedInApp ? 'Seu Breww está no app' : 'A placa está pronta'}
                                    text={linked || addedInApp ? 'Agora desligue a placa do USB e ligue os sensores; os relés e a tomada ficam por último.' : 'Adicione no app com o código abaixo. Depois desligue a placa do USB e ligue os sensores; os relés e a tomada ficam por último.'} />
                                {!linked && !addedInApp && PairPanel}
                                <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Smartphone size={16} className="shrink-0" />O app Breww está em teste para iPhone e Android e chega às lojas em breve.</p>
                                <div className="flex flex-wrap gap-3">
                                    <Link to={board ? `/instalar?placa=${board}#sensores` : '/instalar#sensores'} className={btnPrimary}>Ligar os sensores <ArrowRight size={18} /></Link>
                                    <button type="button" className={btnGhost} onClick={restart}>Instalar outra placa</button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
                </div>
            </main>
            {!flashing && (
                <footer className="on-dark border-t border-white/[0.08] bg-[var(--ink)] text-[#a3a7b0]">
                    <p className="mx-auto flex max-w-6xl flex-wrap gap-x-5 px-4 py-6 text-sm sm:px-6">
                        <span className="inline-flex min-h-11 items-center">© {new Date().getFullYear()} Breww</span>
                        <a href="/ajuda" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 min-w-11 items-center hover:text-white">Ajuda</a>
                        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:text-white">Privacidade</a>
                        <a href="/termos" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:text-white">Termos</a>
                    </p>
                </footer>
            )}
        </div>
    );
};

export default InstallWizard;
