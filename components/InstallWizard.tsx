import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Cpu, Eye, EyeOff, Loader2, Lock, Monitor, RefreshCw, Smartphone, Usb, Wifi } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { BOARDS } from './Installer';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { BoardId, ChipInfo, boardsForChip, detectChip, fetchFirmware, flashFirmware, requestPort, webSerialSupported } from '../services/espFlasher';
import { DeviceLink, WifiNetwork } from '../services/deviceLink';

// Assistente de instalacao (/instalar/assistente): conectar, identificar a placa, gravar, Wi-Fi pelo
// mesmo cabo (Improv), vincular a conta e pronto. A pagina /instalar continua como guia (pecas e ligacoes).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Step = 'connect' | 'board' | 'flash' | 'wifi' | 'link' | 'done';
const STEPS: { id: Step; label: string }[] = [
    { id: 'connect', label: 'Conectar' },
    { id: 'board', label: 'Sua placa' },
    { id: 'flash', label: 'Gravar' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'link', label: 'Sua conta' },
    { id: 'done', label: 'Pronto' },
];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const btn = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-[var(--accent)] text-[var(--ink)] hover:brightness-95`;
const btnDark = `${btn} bg-[var(--ink)] text-white hover:bg-black`;
const btnGhost = `${btn} border border-black/10 bg-white text-[var(--ink)] hover:bg-black/[0.03]`;

const Notice: React.FC<{ kind?: 'error' | 'warn' | 'info'; children: React.ReactNode }> = ({ kind = 'info', children }) => (
    <div role={kind === 'error' ? 'alert' : undefined} className={`flex gap-3 rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed ${
        kind === 'error' ? 'bg-[#fdecea] text-[#8a2418]' : kind === 'warn' ? 'bg-[#fff5e0] text-[#7a4a00]' : 'bg-[var(--bg)] text-[#2b2f37]'}`}>
        {kind !== 'info' && <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
        <div>{children}</div>
    </div>
);

const Heading: React.FC<{ title: React.ReactNode; text?: React.ReactNode }> = ({ title, text }) => (
    <div>
        <h2 className="[font-family:var(--font-display)] text-[30px] font-light leading-tight tracking-[-0.03em] sm:text-[36px]">{title}</h2>
        {text && <p className="mt-3 text-[16px] leading-relaxed text-[var(--muted)]">{text}</p>}
    </div>
);

const Bars: React.FC<{ rssi: number }> = ({ rssi }) => {
    const n = rssi > -55 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
    return (
        <span className="inline-flex items-end gap-[2px]" aria-label={`Sinal ${n} de 4`}>
            {[1, 2, 3, 4].map(k => <span key={k} className={`w-[3px] rounded-sm ${k <= n ? 'bg-[var(--ink)]' : 'bg-black/15'}`} style={{ height: 4 + k * 3 }} />)}
        </span>
    );
};

const BOARD_NAME: Record<BoardId, string> = { 'esp32-devkit': 'ESP32 DevKit', 's3-headless': 'ESP32-S3 sem tela', 'c3-headless': 'ESP32-C3', 's3-35': 'Breww com tela 3,5"' };

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
    const [step, setStep] = useState<Step>('connect');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<React.ReactNode | null>(null);

    const portRef = useRef<any>(null);
    const linkRef = useRef<DeviceLink | null>(null);
    const [chip, setChip] = useState<ChipInfo | null>(null);
    const [board, setBoard] = useState<BoardId | null>(null);
    const [mapOpen, setMapOpen] = useState(false);

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
    const [name, setName] = useState('Meu Breww');
    const [linked, setLinked] = useState(false);

    useEffect(() => { document.title = 'Instalar o Breww — Assistente'; }, []);
    useEffect(() => () => { linkRef.current?.close(); }, []);
    useEffect(() => { setError(null); window.scrollTo({ top: 0 }); }, [step]);

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
            setBoard(options.length === 1 ? options[0] : null);
            setStep('board');
        } catch (e) {
            const msg = String((e as Error)?.message || e);
            setError(msg.toLowerCase().includes('open') || msg.toLowerCase().includes('busy')
                ? <>A porta está em uso por outro programa. Feche a Arduino IDE, o monitor serial ou outra aba do instalador e tente de novo.</>
                : <>Não consegui falar com a placa. Segure o botão <b>BOOT</b> da placa, clique em <b>Conectar a placa</b> de novo e solte o BOOT quando a gravação começar. Se não funcionar, troque o cabo: muitos só carregam.</>);
        } finally { setBusy(false); }
    };

    // ---------- 3. Gravar ----------
    const flash = async () => {
        if (!board || !portRef.current) return;
        setError(null);
        setBusy(true);
        setProgress(0);
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
            setError(<>A gravação parou: {String((e as Error)?.message || e)}. Confira o cabo (de preferência direto no computador, sem hub) e tente de novo. A gravação recomeça do zero, sem problema.</>);
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
            setError('A placa não respondeu a tempo. Tente de novo; se continuar, reconecte o cabo.');
        } finally { setBusy(false); }
    };

    // ---------- 5. Conta ----------
    useEffect(() => {
        if (step !== 'link' || !headless || pair) return;
        const link = linkRef.current;
        if (!link) return;
        let alive = true;
        setPairFailed(false);
        link.pairCode(25000).then(p => { if (!alive) return; if (p) setPair(p); else setPairFailed(true); });
        return () => { alive = false; };
    }, [step, headless, pair]);

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

    const wires = BOARDS.find(b => b.id === board)?.wires ?? [];
    const stageLabel = { idle: '', download: 'Baixando o firmware…', connect: 'Conectando à placa…', erase: 'Apagando a memória…', write: 'Gravando o firmware…', reboot: 'Reiniciando a placa…' }[stage];

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:pt-14">
                <Link to="/instalar" className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"><ArrowLeft size={15} /> Guia de montagem</Link>
                <h1 className="mt-4 [font-family:var(--font-display)] text-[40px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[56px]">
                    Instalar o Breww <span className="text-[var(--muted)]">no seu ESP32.</span>
                </h1>

                {/* progresso no celular */}
                <div className="mt-8 lg:hidden">
                    <div className="flex justify-between text-sm"><span className="font-medium">{STEPS[current].label}</span><span className="text-[var(--muted)]">Passo {current + 1} de {STEPS.length}</span></div>
                    <div className="mt-2 h-1.5 rounded-full bg-black/[0.07]"><div className="h-full rounded-full bg-[var(--ink)] transition-all" style={{ width: `${((current + 1) / STEPS.length) * 100}%` }} /></div>
                </div>

                <div className="mt-8 grid gap-8 lg:mt-12 lg:grid-cols-[220px_1fr] lg:gap-12">
                    {/* passos no computador */}
                    <ol className="hidden space-y-1 lg:block" aria-label="Passos da instalação">
                        {STEPS.map((s, k) => (
                            <li key={s.id} aria-current={k === current ? 'step' : undefined}
                                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] ${k === current ? 'bg-white font-medium shadow-[0_1px_0_rgba(0,0,0,0.04)]' : k < current ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px] ${k < current ? 'bg-[var(--ink)] text-[var(--accent)]' : k === current ? 'bg-[var(--accent)] text-[var(--ink)]' : 'border border-black/10'}`}>
                                    {k < current ? <Check size={14} /> : String(k + 1).padStart(2, '0')}
                                </span>
                                {s.label}
                            </li>
                        ))}
                    </ol>

                    <section className="rounded-[28px] bg-white p-6 sm:p-10" aria-live="polite">
                        {/* 1. CONECTAR */}
                        {step === 'connect' && (
                            <div className="space-y-7">
                                <Heading title="Ligue a placa no computador" text="Use um cabo USB de dados. O assistente descobre qual placa é, grava o firmware certo, configura o Wi-Fi e coloca o aparelho na sua conta." />
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        [Usb, 'Cabo de dados', 'Muitos cabos só carregam. Se a placa não aparecer, troque o cabo.'],
                                        [Monitor, 'Chrome ou Edge', 'No computador. Safari, Firefox e celular não acessam o USB.'],
                                        [Cpu, 'ESP32, S3 ou C3', 'Não sabe qual tem? O assistente descobre.'],
                                    ].map(([Icon, t, d]: any) => (
                                        <div key={t} className="rounded-2xl bg-[var(--bg)] p-4">
                                            <Icon size={20} className="text-[var(--ink)]" />
                                            <p className="mt-3 font-medium">{t}</p>
                                            <p className="mt-1 text-sm leading-snug text-[var(--muted)]">{d}</p>
                                        </div>
                                    ))}
                                </div>
                                {!webSerialSupported() ? (
                                    <Notice kind="warn">Este navegador não acessa o USB. Abra esta página no <b>Chrome</b> ou no <b>Edge</b> de um computador.</Notice>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-4">
                                        <button type="button" className={btnPrimary} onClick={connect} disabled={busy}>
                                            {busy ? <><Loader2 size={18} className="animate-spin" /> Lendo a placa…</> : <><Usb size={18} /> Conectar a placa</>}
                                        </button>
                                        <span className="text-sm text-[var(--muted)]">O navegador vai pedir para você escolher a porta da placa.</span>
                                    </div>
                                )}
                                {error && <Notice kind="error">{error}</Notice>}
                                <details className="text-sm text-[var(--muted)]">
                                    <summary className="cursor-pointer font-medium text-[var(--ink)]">A placa não aparece na lista</summary>
                                    <ul className="mt-3 list-disc space-y-1.5 pl-5">
                                        <li>Troque o cabo USB: os que vêm com fones e luminárias costumam só carregar.</li>
                                        <li>Algumas placas precisam do driver do chip USB: <b>CH340</b> ou <b>CP210x</b>, no site do fabricante.</li>
                                        <li>Segure o botão <b>BOOT</b> enquanto liga o cabo.</li>
                                        <li>Feche a Arduino IDE e qualquer monitor serial aberto.</li>
                                    </ul>
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
                                        <button type="button" className={btnGhost} onClick={restart}><RefreshCw size={16} /> Tentar outra placa</button>
                                    </>
                                ) : (
                                    <>
                                        <Heading title={<>Encontramos um <span className="landing-mark">{chip.chip}</span></>} />
                                        <dl className="grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-2xl bg-[var(--bg)] p-4"><dt className="text-sm text-[var(--muted)]">Chip</dt><dd className="mt-1 font-medium">{chip.description}</dd></div>
                                            <div className="rounded-2xl bg-[var(--bg)] p-4"><dt className="text-sm text-[var(--muted)]">Memória</dt><dd className="mt-1 font-medium">{chip.flashSize || '—'}</dd></div>
                                            <div className="rounded-2xl bg-[var(--bg)] p-4"><dt className="text-sm text-[var(--muted)]">Recursos</dt><dd className="mt-1 text-sm leading-snug">{chip.features.slice(0, 3).join(' · ') || '—'}</dd></div>
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

                                        {board && (
                                            <div className="rounded-2xl border border-black/[0.07]">
                                                <button type="button" onClick={() => setMapOpen(o => !o)} className="flex w-full items-center justify-between px-5 py-4 text-left" aria-expanded={mapOpen}>
                                                    <span><span className="font-medium">Ligações do {BOARD_NAME[board]}</span><span className="block text-sm text-[var(--muted)]">Pode ligar agora ou depois. Os sensores são achados sozinhos.</span></span>
                                                    <ChevronDown size={18} className={`shrink-0 transition-transform ${mapOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                {mapOpen && (
                                                    <ul className="space-y-2 border-t border-black/[0.07] px-5 py-4">
                                                        {wires.map(w => (
                                                            <li key={w.to} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]">
                                                                <span className={`w-[8.5rem] shrink-0 rounded-full px-3 py-1 text-center text-sm ${w.free ? 'border border-dashed border-[var(--ink)]/40' : 'bg-[var(--ink)] font-mono text-white'}`}>{w.pin}</span>
                                                                <span>{w.to}</span>
                                                                {w.note && <span className="text-sm text-[var(--muted)]">· {w.note}</span>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-3">
                                            <button type="button" className={btnPrimary} disabled={!board} onClick={() => setStep('flash')}>Continuar <ArrowRight size={18} /></button>
                                            <button type="button" className={btnGhost} onClick={restart}>Usar outra placa</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 3. GRAVAR */}
                        {step === 'flash' && board && (
                            <div className="space-y-7">
                                <Heading title={<>Gravar o Breww no {BOARD_NAME[board]}</>} text="Leva cerca de um minuto. Não desligue o cabo até terminar." />
                                {stage === 'idle' ? (
                                    <>
                                        <Notice kind="warn">A gravação apaga tudo o que estiver na placa.</Notice>
                                        <button type="button" className={btnPrimary} onClick={flash} disabled={busy}><Usb size={18} /> Gravar o firmware</button>
                                    </>
                                ) : (
                                    <div>
                                        <div className="flex items-baseline justify-between text-[15px]">
                                            <span className="flex items-center gap-2 font-medium"><Loader2 size={16} className="animate-spin" />{stageLabel}</span>
                                            {stage === 'write' && <span className="tabular-nums text-[var(--muted)]">{Math.round(progress * 100)}%</span>}
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.07]">
                                            <div className={`h-full rounded-full bg-[var(--accent)] transition-all ${stage !== 'write' ? 'w-1/3 animate-pulse' : ''}`} style={stage === 'write' ? { width: `${Math.max(3, progress * 100)}%` } : undefined} />
                                        </div>
                                        {version && <p className="mt-3 text-sm text-[var(--muted)]">Firmware {version}</p>}
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
                                                    <button type="button" onClick={scan} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]" disabled={!networks}><RefreshCw size={14} /> Procurar de novo</button>
                                                </div>
                                                {!networks ? (
                                                    <p className="flex items-center gap-2 rounded-2xl bg-[var(--bg)] px-4 py-4 text-[15px] text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> Procurando redes…</p>
                                                ) : networks.length === 0 ? (
                                                    <Notice>Nenhuma rede encontrada. Procure de novo ou digite o nome da rede.</Notice>
                                                ) : (
                                                    <ul className="max-h-72 divide-y divide-black/[0.06] overflow-auto rounded-2xl border border-black/[0.07]" role="radiogroup" aria-label="Redes Wi-Fi">
                                                        {networks.map(n => (
                                                            <li key={n.ssid}>
                                                                <button type="button" role="radio" aria-checked={ssid === n.ssid} onClick={() => setSsid(n.ssid)}
                                                                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] ${ssid === n.ssid ? 'bg-[var(--bg)] font-medium' : 'hover:bg-black/[0.02]'}`}>
                                                                    <Wifi size={17} className="shrink-0 text-[var(--muted)]" />
                                                                    <span className="flex-1 truncate">{n.ssid}</span>
                                                                    {n.secured && <Lock size={14} className="text-[var(--muted)]" aria-label="Com senha" />}
                                                                    <Bars rssi={n.rssi} />
                                                                    {ssid === n.ssid && <Check size={17} />}
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                        {manualSsid && (
                                            <label className="block">
                                                <span className="font-medium">Nome da rede</span>
                                                <input value={ssid} onChange={e => setSsid(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--ink)]" />
                                            </label>
                                        )}
                                        <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => { setManualSsid(m => !m); setSsid(''); }}>
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
                                        <button type="button" className={btnPrimary} onClick={sendWifi} disabled={busy || !ssid.trim()}>
                                            {busy ? <><Loader2 size={18} className="animate-spin" /> Conectando…</> : <>Conectar ao Wi-Fi <ArrowRight size={18} /></>}
                                        </button>
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
                                        <Heading title="Coloque o aparelho na sua conta" text="O Wi-Fi conectou. Falta dizer de quem é este Breww." />
                                        {!pair && pairFailed ? (
                                            <Notice kind="warn">Não consegui ler o código pelo cabo. Sem problema: no app, toque em <b>Adicionar aparelho</b> e escolha o Breww em <b>Buscar na rede</b>.</Notice>
                                        ) : !pair ? (
                                            <p className="flex items-center gap-2 rounded-2xl bg-[var(--bg)] px-4 py-4 text-[15px] text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> Buscando o código do aparelho…</p>
                                        ) : (
                                            <div className="rounded-2xl bg-[var(--card)] p-6 text-white">
                                                <p className="text-sm text-[#898E99]">Código do aparelho</p>
                                                <p className="mt-1 font-mono text-[34px] tracking-[0.18em] text-[var(--accent)]">{pair.code}</p>
                                                <p className="mt-1 text-sm text-[#898E99]">ID {pair.id}</p>
                                            </div>
                                        )}
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
                                                <Notice>
                                                    <b>No app:</b> toque em <b>Adicionar aparelho</b> e escolha o Breww em <b>Buscar na rede</b> (o celular precisa estar no mesmo Wi-Fi), ou digite o código acima.
                                                </Notice>
                                                <div className="flex flex-wrap gap-3">
                                                    <a href="/register" target="_blank" rel="noopener noreferrer" className={btnDark}>Criar conta grátis</a>
                                                    <a href="/login" target="_blank" rel="noopener noreferrer" className={btnGhost}>Entrar</a>
                                                </div>
                                                <p className="text-sm text-[var(--muted)]">Entrou ou criou a conta na outra aba? Volte para esta: o botão de adicionar aparece aqui sozinho.</p>
                                                <button type="button" className="text-sm font-medium underline underline-offset-4" onClick={() => setStep('done')}>Vou adicionar pelo app</button>
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
                                <Heading title={linked ? 'Seu Breww está na sua conta' : 'Instalação concluída'}
                                    text={linked ? 'Ele já manda as leituras. Ligue o sensor e os relés (com a placa desligada) e comece o primeiro lote pelo app.' : 'Agora é só adicionar o aparelho no app e ligar o sensor e os relés, com a placa desligada da tomada.'} />
                                <div className="flex flex-wrap gap-3">
                                    {linked ? <Link to="/" className={btnPrimary}>Abrir o painel <ArrowRight size={18} /></Link>
                                        : <span className={`${btnDark} cursor-default`}><Smartphone size={18} /> Abra o app Breww</span>}
                                    <Link to="/instalar#pecas" className={btnGhost}>Ver o guia de ligações</Link>
                                    <button type="button" className={btnGhost} onClick={restart}>Instalar outra placa</button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
};

export default InstallWizard;
