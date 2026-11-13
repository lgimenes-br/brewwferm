import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, ChevronDown, Cpu, Eye, EyeOff, Loader2, Lock, Monitor, RefreshCw, Smartphone, Usb, Wifi } from 'lucide-react';
import { SiteHeader } from './SiteChrome';
import { BOARDS } from './Installer';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { BoardId, ChipInfo, boardsForChip, detectChip, flashTooSmall, fetchFirmware, flashFirmware, requestPort, webSerialSupported } from '../services/espFlasher';
import { DeviceLink, WifiNetwork } from '../services/deviceLink';
import { AccountStep, InstallSession } from './install/AccountStep';
import { ilog, ilogReset, ilogSecret, installLogText } from '../services/installLog';

// Assistente de instalacao (/instalar/assistente): conectar, identificar a placa, gravar, Wi-Fi pelo
// mesmo cabo (Improv), vincular a conta e pronto. Comeca pela conta: no fim o aparelho entra nela sozinho. A pagina /instalar continua como guia (pecas e ligacoes).
// Visual do mundo da home: titulo no papel milimetrado, trilha dos passos na linha verde (feito = cheio,
// atual = aceso, futuro = tracejado) e leituras da placa em paineis de instrumento Grafite.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Step = 'conta' | 'connect' | 'board' | 'flash' | 'wifi' | 'link' | 'done';
const STEPS: { id: Step; label: string }[] = [
    { id: 'conta', label: 'Sua conta' },
    { id: 'connect', label: 'Conectar' },
    { id: 'board', label: 'Sua placa' },
    { id: 'flash', label: 'Gravar' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'link', label: 'Na conta' },
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
const boardFromChip = (chip?: string): BoardId => { const c = (chip || '').toUpperCase(); return c.includes('8266') ? 'esp8266-lite' : c.includes('C3') ? 'c3-headless' : c.includes('S3') ? 's3-headless' : 'esp32-devkit'; };

// Sessao do assistente: so nesta aba (sessionStorage). Nao usa a sessao do site, para a home continuar
// sendo a home depois de instalar. Quem ja esta logado no site (admin) entra direto.
const SESSION_KEY = 'breww_install_session';
const readSession = (): InstallSession | null => {
    try { const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); return s?.token ? s : null; } catch { return null; }
};
const writeSession = (s: InstallSession | null) => {
    try { if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); else sessionStorage.removeItem(SESSION_KEY); } catch { /* aba privada */ }
};
// Estado da nuvem que o firmware 2.9.7+ manda no "status" (texto sem acento) -> frase da tela
const cloudLabel = (st: { cloud: boolean; cloudDetail: string | null } | null) => {
    if (!st) return '—';
    if (st.cloud) return 'Conectada';
    const d = (st.cloudDetail || '').toLowerCase();
    if (!d) return 'Aguardando';
    if (d.startsWith('vinculada')) return 'Na sua conta, conectando';
    if (d.startsWith('anunciada')) return 'Online, esperando a conta';
    if (d.includes('relogio')) return 'Acertando o relógio';
    if (d.includes('anunci')) return 'Falando com o servidor…';
    if (d.startsWith('falha')) return `Falha ao falar com o servidor ${d.replace(/[^0-9-]/g, '') ? `(${d.replace(/[^0-9-]/g, '')})` : ''}`.trim();
    if (d.includes('memoria')) return 'Erro na placa: sem memória';
    if (d.includes('chave')) return 'Chave recusada: adicione pelo código';
    if (d.includes('sem wi-fi')) return 'Sem Wi-Fi';
    return st.cloudDetail || 'Aguardando';
};
const newId = () => (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).slice(0, 36);

export const InstallWizard: React.FC = () => {
    const { token: authToken, user: authUser } = useAuth();
    const [session, setSessionState] = useState<InstallSession | null>(() => readSession() || (authToken ? { token: authToken, name: authUser || 'você' } : null));
    const token = session?.token || null;
    const [params] = useSearchParams();
    const guideBoard = params.get('placa') as BoardId | null;
    const [step, setStep] = useState<Step>(() => (session ? 'connect' : 'conta'));

    // Funil da instalacao (BI): etapas ligadas a conta, sem dados do Wi-Fi. Falha no envio nunca atrapalha.
    const [pair, setPair] = useState<{ code: string; id: string } | null>(null);
    const pairRef = useRef(pair);
    pairRef.current = pair;
    const [bindTried, setBindTried] = useState(false);
    const runId = useRef(newId());
    // Log da instalacao (passos + linhas da placa): enviado ao servidor nas falhas, no fim e ao sair
    const logMeta = useRef<{ board?: string | null; chip?: string | null }>({});
    const uploadLog = useCallback((tk = token, unloading = false) => {
        if (!tk) return;
        const text = installLogText({ Placa: logMeta.current.board, Chip: logMeta.current.chip, Sessao: runId.current });
        fetch(`${API_URL}/install/log`, {
            method: 'POST', keepalive: unloading,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
            body: JSON.stringify({ session: runId.current, board: logMeta.current.board, chip: logMeta.current.chip, text: unloading ? text.slice(-60000) : text }),
        }).catch(() => {});
    }, [token]);
    const track = useCallback((event: string, extra: Record<string, string | null | undefined> = {}, tk = token) => {
        ilog('site', `Evento ${event}${Object.entries(extra).filter(([, v]) => v).map(([k, v]) => ` ${k}=${v}`).join('')}`);
        if (extra.board) logMeta.current.board = extra.board;
        if (extra.chip) logMeta.current.chip = extra.chip;
        if (!tk) return;
        fetch(`${API_URL}/install/events`, {
            method: 'POST', keepalive: true,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
            body: JSON.stringify({ event, session: runId.current, ...extra }),
        }).catch(() => {});
        if (event.endsWith('_fail') || event === 'done' || event === 'bind_ok') uploadLog(tk);
    }, [token, uploadLog]);
    useEffect(() => {
        const onLeave = () => uploadLog(token, true);
        window.addEventListener('pagehide', onLeave);
        return () => window.removeEventListener('pagehide', onLeave);
    }, [token, uploadLog]);
    const downloadLog = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([installLogText({ Placa: logMeta.current.board, Chip: logMeta.current.chip, Sessao: runId.current })], { type: 'text/plain' }));
        a.download = `breww-instalacao-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
    };
    const setSession = (s: InstallSession | null) => {
        writeSession(s);
        setSessionState(s);
        if (!s) return;
        track('login', {}, s.token);
        // Sessao expirou no meio (vinculo): volta para o vinculo, nao para o comeco
        if (pairRef.current) { setBindTried(false); setStep('link'); } else setStep('connect');
    };
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

    const [pairFailed, setPairFailed] = useState(false);
    const [pairTry, setPairTry] = useState(0);
    const [name, setName] = useState('Meu Breww');
    const [linked, setLinked] = useState(false);
    const [addedInApp, setAddedInApp] = useState(false);
    const [copied, setCopied] = useState<'id' | 'code' | null>(null);
    const [devStatus, setDevStatus] = useState<{ temp: number | null; wifi: boolean; ssid: string; cloud: boolean; cloudDetail: string | null; sensorOk: boolean | null } | null>(null);
    const [statusBusy, setStatusBusy] = useState(false);
    const readStatus = useCallback(async () => {
        const link = linkRef.current;
        if (!link) return;
        setStatusBusy(true);
        try { const st = await link.status(3000); if (st) setDevStatus(st); } catch { /* sem resposta */ } finally { setStatusBusy(false); }
    }, []);

    useEffect(() => { document.title = 'Instalar o Breww — Assistente'; }, []);
    useEffect(() => () => { linkRef.current?.close(); }, []);
    const firstStep = useRef(true);
    useEffect(() => {
        setError(null);
        const k = STEPS.findIndex(s => s.id === step);
        setAnnounce(`Passo ${k + 1} de ${STEPS.length}: ${STEPS[k].label}`);
        ilog('site', `Passo ${k + 1}: ${STEPS[k].label}`);
        if (firstStep.current) { firstStep.current = false; return; }
        window.scrollTo({ top: 0 });
        requestAnimationFrame(() => document.getElementById('etapa-titulo')?.focus());
    }, [step]);
    // Erros mostrados na tela tambem vao para o log (texto como a pessoa leu)
    useEffect(() => {
        if (!error) return;
        requestAnimationFrame(() => {
            const t = document.querySelector('[role="alert"]')?.textContent;
            ilog('site', `Erro na tela: ${t || String(error)}`);
        });
    }, [error]);
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
            track('connect_ok', { chip: info.chip, board: options.length === 1 ? options[0] : null });
            setStep('board');
        } catch (e) {
            const msg = String((e as Error)?.message || e);
            track('connect_fail', { detail: msg.toLowerCase().includes('open') || msg.toLowerCase().includes('busy') ? 'porta em uso' : 'sem resposta' });
            setError(msg.toLowerCase().includes('open') || msg.toLowerCase().includes('busy')
                ? <>A porta está em uso por outro programa. Feche a Arduino IDE, o monitor serial ou outra aba do instalador e tente de novo.</>
                : <>Não consegui falar com a placa. Segure o botão <b>BOOT</b> da placa, clique em <b>Conectar a placa</b> de novo e solte o BOOT quando a placa for lida. Se não funcionar, troque o cabo: muitos só carregam.</>);
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
            const state = await link.waitImprov(12000);
            const info = await link.info();
            setBoard(boardFromChip(info?.chip));
            if (info?.name) setDeviceName(info.name);
            setImprovOk(true);
            track('existing_ok', { chip: info?.chip, board: boardFromChip(info?.chip) });
            setStep(state === 0x04 ? 'link' : 'wifi'); // 0x04 = Wi-Fi ja configurado
        } catch {
            linkRef.current?.close(); linkRef.current = null;
            track('existing_fail', { detail: 'sem Breww' });
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
            track('flash_ok', { board, chip: chip?.chip, detail: fw.version });
            if (!headless) { setStep('link'); return; }
            // A placa reinicia: reabre a mesma porta e espera o firmware responder ao Improv.
            // Placa com chip USB-serial (DevKit) as vezes fica parada depois de gravar: se nao
            // responder em alguns segundos, reinicia pelo cabo (como apertar o EN) e espera de novo.
            ilog('site', 'Gravado; reabrindo a porta e esperando o firmware');
            const link = await DeviceLink.open(portRef.current, 12000);
            linkRef.current = link;
            const usbBridge = board === 'esp32-devkit' || board === 'esp8266-lite'; // chip USB-serial: reinicio pelo EN
            try {
                try { await link.waitImprov(usbBridge ? 7000 : 25000); } catch (e) {
                    if (!usbBridge) throw e;
                    ilog('site', 'Sem resposta em 7 s; reiniciando a placa pelo cabo');
                    await link.resetToApp();
                    await link.waitImprov(20000);
                }
                ilog('site', 'Firmware respondeu (Improv)');
                setImprovOk(true);
                const info = await link.info();
                if (info?.name) setDeviceName(info.name);
            } catch { ilog('site', 'Firmware nao respondeu pelo cabo'); setImprovOk(false); }
            setStep('wifi');
        } catch (e) {
            setStage('idle');
            console.error('Gravação:', e);
            track('flash_fail', { board, chip: chip?.chip, detail: String((e as Error)?.message || e).slice(0, 150) });
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
            ilogSecret(ssid.trim(), 'rede Wi-Fi'); ilogSecret(password, 'senha do Wi-Fi');
        ilog('site', 'Enviando o Wi-Fi para a placa');
        const ok = await link.provision(ssid.trim(), password);
            if (!ok) { track('wifi_fail', { board, detail: 'senha ou rede' }); setError(<>A placa não conseguiu entrar em <b>{ssid}</b>. Confira a senha. Lembre que o ESP32 só funciona em redes de 2,4 GHz.</>); return; }
            track('wifi_ok', { board });
            setStep('link');
        } catch {
            track('wifi_fail', { board, detail: 'sem resposta' });
            setError(<>A placa não respondeu a tempo. Tente de novo; se continuar, use <b>Reconectar a placa</b> logo abaixo.</>);
        } finally { setBusy(false); }
    };

    // ---------- 5. Conta ----------
    useEffect(() => {
        if (step !== 'link' || !headless || pair) return;
        const link = linkRef.current;
        if (!link || improvOk === false) { setPairFailed(true); return; }
        let alive = true;
        setPairFailed(false);
        link.pairCode(25000).then(p => { if (!alive) return; if (p) { ilogSecret(p.code, 'codigo de confirmacao'); ilog('site', `Codigo lido pelo cabo (ID ${p.id})`); setPair(p); } else { ilog('site', 'Codigo nao lido pelo cabo em 25 s'); setPairFailed(true); } });
        return () => { alive = false; };
    }, [step, headless, pair, pairTry, improvOk]);
    // Tela "Pronto" sem os codigos (nao lidos antes): tenta ler de novo, para adicionar pelo app
    useEffect(() => {
        if (step !== 'done' || !headless || pair || !linkRef.current || improvOk === false) return;
        let alive = true;
        linkRef.current.pairCode(15000).then(p => { if (alive && p) { ilogSecret(p.code, 'codigo de confirmacao'); setPair(p); } });
        return () => { alive = false; };
    }, [step, headless, pair, improvOk]);
    // Enquanto espera a nuvem (vinculo / Pronto), le o estado da placa a cada 8 s: mostra em que pe esta
    useEffect(() => {
        if (!(step === 'link' || step === 'done') || !headless || improvOk === false || devStatus?.cloud) return;
        const t = setInterval(() => { if (!statusBusy) readStatus(); }, 8000);
        return () => clearInterval(t);
    }, [step, headless, improvOk, devStatus?.cloud, statusBusy, readStatus]);
    useEffect(() => { if (devStatus) ilog('site', `Leitura: temp ${devStatus.temp ?? '-'} | Wi-Fi ${devStatus.wifi ? 'ok' : 'nao'} | nuvem ${devStatus.cloud ? 'conectada' : devStatus.cloudDetail || 'desconectada'} | sensor ${devStatus.sensorOk ?? '?'}`); }, [devStatus]);

    useEffect(() => { if (step === 'done') track('done', { board }); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if ((step === 'link' || step === 'done') && headless && improvOk !== false) readStatus(); }, [step, headless, improvOk, readStatus]);

    const bind = async () => {
        if (!token || !pair) return;
        setBindTried(true);
        setError(null);
        setBusy(true);
        try {
            // A placa avisa a nuvem logo depois de conectar (acerta o relogio e anuncia): se o servidor
            // ainda nao a viu, tenta por ate 1 min
            ilog('site', 'Vinculando a conta (POST /devices)');
            for (let i = 0; i < 15; i++) {
                const r = await fetch(`${API_URL}/devices`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ pairCode: pair.code, name: name.trim() || 'Meu Breww' }),
                });
                if (r.ok) { track('bind_ok', { board, serial: pair.id }); setLinked(true); setStep('done'); return; }
                if (r.status === 401) { setError('Sua sessão expirou. Entre de novo para adicionar o aparelho.'); setSession(null); setStep('conta'); return; }
                const data = await r.json().catch(() => ({}));
                ilog('site', `Vinculo: HTTP ${r.status}${i < 14 && r.status === 422 ? ' (servidor ainda nao viu a placa; tentando de novo)' : ''}`);
                if (r.status !== 422 || i === 14) { track('bind_fail', { board, serial: pair.id, detail: `${r.status} ${data?.error || ''}`.trim() }); setError(data?.error || 'Não foi possível adicionar o aparelho.'); return; }
                await sleep(4000);
            }
        } catch { setError('Sem conexão com o servidor. Tente de novo.'); } finally { setBusy(false); }
    };
    // Com a conta e o codigo lidos pelo cabo, o aparelho entra na conta sozinho
    useEffect(() => {
        if (step === 'link' && headless && token && pair && !bindTried && !busy) bind();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, headless, token, pair, bindTried, busy]);

    const reflash = async () => {
        let port;
        try { port = await requestPort(); } catch { return; }
        linkRef.current?.close(); linkRef.current = null;
        portRef.current = port;
        flash();
    };

    const restart = () => {
        linkRef.current?.close();
        linkRef.current = null; portRef.current = null;
        setChip(null); setBoard(null); setVersion(null); setProgress(0); setStage('idle');
        setImprovOk(null); setNetworks(null); setSsid(''); setPassword(''); setPair(null); setPairFailed(false); setLinked(false); setDeviceName(null); setBindTried(false); setDevStatus(null);
        if (token) uploadLog(token); // log da tentativa anterior
        ilogReset(); runId.current = newId(); logMeta.current = {};
        setStep('connect');
    };

    const copy = (text: string, which: 'id' | 'code') => {
        navigator.clipboard?.writeText(text).then(() => { setCopied(which); setTimeout(() => setCopied(null), 2000); }).catch(() => {});
    };
    // Mesmos nomes e ordem do app (Adicionar aparelho): codigo do aparelho = numero de serie; codigo de confirmacao
    const PairPanel = pair ? (
        <div className="on-dark rounded-3xl bg-[var(--card)] p-6 text-white sm:p-7">
            <p className="text-sm text-[#a3a7b0]">Para adicionar no app, em <b className="font-medium text-white">Adicionar aparelho</b>:</p>
            <dl className="mt-4 grid gap-5 sm:grid-cols-2">
                {([['id', 'Código do aparelho', pair.id], ['code', 'Código de confirmação', pair.code]] as const).map(([k, label, value]) => (
                    <div key={k}>
                        <dt className="flex items-center gap-2 text-sm text-[#a3a7b0]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />{label}</dt>
                        <dd className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span className={`font-mono tracking-[0.08em] text-[var(--accent)] tabular-nums ${k === 'code' ? 'text-3xl' : 'text-2xl'}`}>{value}</span>
                            <button type="button" aria-label={`Copiar ${label.toLowerCase()}`} className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm font-medium hover:bg-white/10" onClick={() => copy(value, k)}>
                                {copied === k ? 'Copiado' : 'Copiar'}
                            </button>
                        </dd>
                    </div>
                ))}
            </dl>
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
    const StatusPanel = headless && linkRef.current && improvOk !== false ? (
        <div className="rounded-3xl border border-black/[0.08] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">Leitura do aparelho, pelo cabo</p>
                <button type="button" onClick={readStatus} disabled={statusBusy} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                    {statusBusy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Ler de novo
                </button>
            </div>
            {devStatus ? (
                <dl className="mt-3 grid gap-4 sm:grid-cols-3">
                    <div><dt className="text-sm text-[var(--muted)]">Temperatura</dt><dd className="mt-1 [font-family:var(--font-display)] text-3xl font-light tabular-nums">{devStatus.temp !== null ? <>{devStatus.temp.toFixed(1).replace('.', ',')}<span className="text-base text-[var(--muted)]"> °C</span></> : <span className="block text-base leading-snug text-[var(--muted)]">sensor ainda não ligado{devStatus.sensorOk === false ? <><br />relés desligados por segurança</> : null}</span>}</dd></div>
                    <div><dt className="text-sm text-[var(--muted)]">Wi-Fi</dt><dd className="mt-1 font-medium">{devStatus.wifi ? `Conectado${devStatus.ssid ? ` · ${devStatus.ssid}` : ''}` : 'Desconectado'}</dd></div>
                    <div><dt className="text-sm text-[var(--muted)]">Nuvem Breww</dt><dd className="mt-1 font-medium">{cloudLabel(devStatus)}</dd></div>
                </dl>
            ) : <p className="mt-2 text-sm text-[var(--muted)]">{statusBusy ? 'Lendo…' : 'Ainda sem leitura. Toque em Ler de novo.'}</p>}
            <p className="mt-3 text-pretty text-sm text-[var(--muted)]">É a prova de que o aparelho funciona, mesmo antes de ter o app. Com o sensor ligado, a temperatura aparece aqui.</p>
        </div>
    ) : null;

    const stageLabel = { idle: '', download: 'Baixando o firmware…', connect: 'Conectando à placa…', erase: 'Apagando a memória…', write: 'Gravando o firmware…', reboot: 'Gravado! Reiniciando a placa…' }[stage];

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader minimal={{ label: 'Voltar ao guia', to: (board || guideBoard) ? `/instalar?placa=${board || guideBoard}` : '/instalar', locked: flashing }} />
            <p className="sr-only" aria-live="polite">{announce}</p>
            <main>
                <div style={paperGrid}>
                    {step === 'conta' || step === 'connect' ? (
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
                        {/* 0. CONTA */}
                        {step === 'conta' && (
                            <AccountStep session={session} onSession={setSession} onContinue={() => setStep('connect')}
                                heading={<Heading title="Primeiro, sua conta" text="Entre ou crie a conta grátis. No fim da instalação o aparelho já entra nela sozinho, sem código, e aparece no app Breww quando você entrar com a mesma conta." />} />
                        )}

                        {/* 1. CONECTAR */}
                        {step === 'connect' && (
                            <div className="space-y-7">
                                <Heading title="Ligue a placa no computador" text={<>Use um cabo USB de dados. {guideBoard === 's3-35' ? 'O assistente grava o firmware; depois a placa reinicia e o Wi-Fi e o app são configurados na tela dela.' : 'O assistente descobre qual placa é, grava o firmware certo, configura o Wi-Fi e coloca o aparelho na sua conta.'}{guideBoard && BOARD_NAME[guideBoard] ? <> Placa escolhida no guia: <b className="text-[var(--ink)]">{BOARD_NAME[guideBoard]}</b>.</> : null}</>} />
                                <ul className="divide-y divide-black/[0.07] border-y border-black/[0.07]">
                                    {[
                                        [Cpu, 'Só a placa, sem fios', 'Sensores e relés entram depois de gravar, com a placa desligada.'],
                                        [Usb, 'Cabo de dados', 'Muitos cabos só carregam. Se a placa não aparecer, troque o cabo.'],
                                        [Monitor, 'Chrome ou Edge', 'No computador. Safari, Firefox e celular não acessam o USB.'],
                                        [Smartphone, 'O app vem depois', <>O aparelho entra na conta {session ? <b className="font-medium text-[var(--ink)]">de {session.name}</b> : 'que você entrou'} no fim. O app Breww, para acompanhar a fermentação, está em teste e chega às lojas em breve.</>],
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
                                                <p className="mt-0.5 max-w-[30rem] text-pretty text-sm text-[var(--muted)]">Para quando a gravação já foi feita: recarregou a página no meio, trocou o Wi-Fi de casa, vai reaproveitar a placa ou quer conferir a leitura dos sensores. Pula a gravação e vai para o Wi-Fi ou, se ele já estiver configurado, direto para colocar o aparelho na conta.</p>
                                            </div>
                                            <button type="button" className={`${btnGhost} shrink-0`} onClick={connectExisting} disabled={busy}>Continuar sem gravar</button>
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
                                {flashTooSmall(chip) ? (
                                    <>
                                        <Heading title={<>Esse ESP8266 tem só {chip.flashSize} de memória</>} text="A versão Lite precisa de 4 MB: o firmware e o espaço para as atualizações pelo app não cabem em menos. É o caso do ESP-01 e de algumas placas antigas." />
                                        <Notice kind="warn">Use uma <b>NodeMCU</b> ou uma <b>Wemos D1 mini</b> (4 MB), ou um <b>ESP32-C3 SuperMini</b>, que custa parecido e roda a versão completa.</Notice>
                                        <button type="button" className={btnGhost} onClick={restart}><RefreshCw size={16} /> Conectar outra placa</button>
                                    </>
                                ) : boardsForChip(chip.chip).length === 0 ? (
                                    <>
                                        <Heading title={<>Essa placa é um {chip.chip}</>} text="O Breww funciona com ESP32, ESP32-S3, ESP32-C3 e ESP8266 (versão Lite). Essa placa não tem o que o firmware precisa." />
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

                                        {board === 'esp8266-lite' && <Notice>Versão <b>Lite</b>: controle, perfis, app e iSpindel funcionam igual; ficam de fora a telinha, os botões, os sensores I²C e a volta automática de versão. Os relés vão no <b>D1</b> e no <b>D2</b>.</Notice>}
                                        {mismatch && <Notice>No guia você escolheu <b>{BOARD_NAME[guideBoard!]}</b>, mas esta placa é <b>{BOARD_NAME[board!]}</b>. <b>Os pinos mudam:</b> na hora de ligar os fios, o guia já abre com a placa certa.</Notice>}
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
                                <Heading title={<>Gravar o Breww no {BOARD_NAME[board]}</>} text={error ? 'A gravação não terminou. Confira o cabo e grave de novo: ela recomeça do zero.' : 'Leva cerca de um minuto. Não desligue o cabo até terminar.'} />
                                {stage === 'idle' ? null : (
                                    <div className="on-dark rounded-3xl bg-[var(--card)] p-6 text-white sm:p-7">
                                        {/* marcos: feito = cheio, atual = aceso, futuro = tracejado */}
                                        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Etapas da gravação">
                                            {([['download', 'Baixar'], ['erase', 'Apagar'], ['write', 'Gravar'], ['reboot', 'Reiniciar']] as const).map(([id, label]) => {
                                                const order = ['download', 'connect', 'erase', 'write', 'reboot'];
                                                const pos = order.indexOf(id);
                                                const now = order.indexOf(stage === 'connect' ? 'erase' : stage); // conectar conta como inicio do apagar
                                                const state = pos < now ? 'feito' : pos === now ? 'atual' : 'futuro';
                                                return (
                                                    <li key={id} aria-current={state === 'atual' ? 'step' : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${state === 'feito' ? 'bg-[var(--accent)] text-[var(--ink)]' : state === 'atual' ? 'border border-[var(--accent)] text-white' : 'border border-dashed border-white/25 text-[#a3a7b0]'}`}>
                                                        {state === 'feito' ? <Check size={13} strokeWidth={2.5} /> : state === 'atual' ? <Loader2 size={13} className="animate-spin text-[var(--accent)]" /> : null}{label}
                                                    </li>
                                                );
                                            })}
                                        </ol>
                                        <div className="mt-6 flex items-end justify-between gap-4">
                                            <span className="text-[15px] text-[#c9ccd3]">{stageLabel}</span>
                                            {stage === 'write' && (
                                                <span className="[font-family:var(--font-display)] text-[56px] font-light leading-none tracking-[-0.04em] tabular-nums">
                                                    {Math.round(progress * 100)}<span className="text-2xl text-[#a3a7b0]">%</span>
                                                </span>
                                            )}
                                        </div>
                                        {stage === 'write' && (
                                            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Gravação do firmware" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                                                <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.max(3, progress * 100)}%` }} />
                                            </div>
                                        )}
                                        {version && <p className="mt-4 text-sm text-[#a3a7b0]">Firmware {version}</p>}
                                    </div>
                                )}
                                {error && (
                                    <>
                                        <Notice kind="error">{error}</Notice>
                                        <div className="flex flex-wrap gap-3">
                                            <button type="button" className={btnPrimary} onClick={reflash} disabled={busy}><RefreshCw size={16} /> Reconectar e gravar de novo</button>
                                            <button type="button" className={btnGhost} onClick={flash} disabled={busy}>Tentar na mesma porta</button>
                                        </div>
                                        <p className="max-w-[38rem] text-pretty text-sm text-[var(--muted)]">Se falhar de novo: segure o botão <b>BOOT</b> da placa ao clicar em <b>Reconectar e gravar de novo</b> e solte quando a gravação começar. Prefira o cabo direto no computador, sem hub.</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 4. WI-FI */}
                        {step === 'wifi' && (
                            <div className="space-y-7">
                                <Heading title="Conecte a placa ao seu Wi-Fi" text={<>Pelo mesmo cabo USB. Use a rede de <b>2,4 GHz</b> da sua casa: o ESP32 não enxerga redes de 5 GHz.</>} />
                                {improvOk === false ? (
                                    <>
                                        <Notice kind="warn">A placa foi gravada, mas não respondeu pelo cabo. Aperte uma vez o botão <b>EN</b> (ou <b>RST</b>) da placa para ela reiniciar e toque em <b>Reconectar a placa</b>.</Notice>
                                        <div className="flex flex-wrap gap-3">
                                            <button type="button" className={btnDark} onClick={reconnectPort} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reconectar a placa</button>
                                        </div>
                                        <Notice>Também dá pelo celular: entre na rede <b>Breww-XXXX</b> que a placa cria, escolha o Wi-Fi da sua casa e digite a senha. Depois volte aqui e toque em <b>Pular</b>.</Notice>
                                        <button type="button" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4" onClick={() => setStep('link')}>Pular: configurei pelo celular</button>
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
                                        <Heading title={pairFailed && !pair ? 'Falta só colocar na conta' : error && bindTried ? 'Não deu para colocar na conta' : 'Colocando o Breww na sua conta'}
                                            text={pairFailed && !pair ? 'O Wi-Fi conectou, mas não consegui ler o código do aparelho pelo cabo.' : 'O Wi-Fi conectou. O aparelho avisa a nuvem e entra na sua conta; isso leva alguns segundos.'} />
                                        {!pair && pairFailed ? (
                                            <>
                                                <Notice kind="warn">{linkRef.current ? <>Tente reconectar a placa para ler o código. Ou termine pelo app: em <b>Adicionar aparelho</b>, o Breww aparece em <b>Buscar na rede</b> (o celular no mesmo Wi-Fi).</> : <>Sem o cabo não dá para ler o código. Reconecte a placa, ou termine pelo app: em <b>Adicionar aparelho</b>, o Breww aparece em <b>Buscar na rede</b> (o celular no mesmo Wi-Fi).</>}</Notice>
                                                <div className="flex flex-wrap gap-3">
                                                    {ReconnectButton}
                                                    <button type="button" className={btnGhost} onClick={() => { setAddedInApp(false); setStep('done'); }}>Termino pelo app</button>
                                                </div>
                                            </>
                                        ) : !pair || (busy && !error) ? (
                                            <p className="flex items-center gap-2 rounded-2xl bg-[var(--bg)] px-4 py-4 text-[15px] text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> {!pair ? 'Lendo o código do aparelho…' : <>Adicionando à sua conta…{devStatus && !devStatus.cloud ? <span className="text-[var(--muted)]"> Placa: {cloudLabel(devStatus).toLowerCase()}.</span> : null}</>}</p>
                                        ) : error ? (
                                            <>
                                                <Notice kind="error">{error}</Notice>
                                                <label className="block">
                                                    <span className="font-medium">Nome do aparelho</span>
                                                    <input value={name} onChange={e => setName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--ink)]" />
                                                </label>
                                                <div className="flex flex-wrap gap-3">
                                                    <button type="button" className={btnPrimary} onClick={bind} disabled={busy}>Tentar de novo <ArrowRight size={18} /></button>
                                                    <button type="button" className={btnGhost} onClick={() => { setAddedInApp(false); setStep('done'); }}>Termino pelo app</button>
                                                </div>
                                                <p className="text-sm text-[var(--muted)]">Pelo app: <b>Adicionar aparelho</b> e o código abaixo.</p>
                                                {PairPanel}
                                            </>
                                        ) : null}
                                        {StatusPanel}
                                    </>
                                )}
                            </div>
                        )}

                        {/* 6. PRONTO */}
                        {step === 'done' && (
                            <div className="space-y-7">
                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)]"><Check size={28} className="text-[var(--ink)]" /></span>
                                <Heading title={linked ? 'Seu Breww está na sua conta' : 'A placa está pronta'}
                                    text={!headless
                                        ? 'Termine na tela da placa: escolha o Wi-Fi e, no app, leia o QR code que aparece nela. Depois desligue a placa e ligue os sensores; os relés e a tomada ficam por último.'
                                        : linked
                                            ? <>Ele aparece no app Breww quando você entrar com a conta {session ? <b className="text-[var(--ink)]">de {session.name}</b> : 'que usou aqui'}. Agora desligue a placa do USB e ligue os sensores; os relés e a tomada ficam por último.</>
                                            : addedInApp
                                                ? 'Agora desligue a placa do USB e ligue os sensores; os relés e a tomada ficam por último.'
                                                : 'Falta colocar o aparelho na conta: no app, Adicionar aparelho, com os dois códigos abaixo ou em Buscar na rede. Depois desligue a placa do USB e ligue os sensores; os relés e a tomada ficam por último.'} />
                                {headless && !linked && !addedInApp && PairPanel}
                                {StatusPanel}
                                <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Smartphone size={16} className="shrink-0" />O app Breww está em teste para iPhone e Android e chega às lojas em breve.</p>
                                <div className="flex flex-wrap gap-3">
                                    <Link to={board ? `/instalar?placa=${board}#sensores` : '/instalar#sensores'} className={btnPrimary}>Ligar os sensores <ArrowRight size={18} /></Link>
                                    <button type="button" className={btnGhost} onClick={restart}>Instalar outra placa</button>
                                </div>
                            </div>
                        )}
                        {step !== 'conta' && step !== 'connect' && (
                            <p className="mt-10 border-t border-black/[0.07] pt-5 text-sm leading-relaxed text-[var(--muted)]">
                                Algo deu errado? <button type="button" onClick={downloadLog} className="-my-2 py-2 font-medium text-[var(--ink)] underline underline-offset-4">Baixar o log da instalação</button>. Ele também é enviado ao suporte Breww, sem o nome e a senha do seu Wi-Fi.
                            </p>
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
