import { useEffect, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

// Funil do assistente de instalacao (/instalar/assistente): contas distintas que chegaram a cada etapa,
// falhas mais comuns e placas detectadas. Dados de install_events (backend/routes/installEventsRoutes.js).
type Funnel = {
    days: number;
    funnel: { event: string; users: number }[];
    fails: { event: string; detail: string | null; total: number }[];
    boards: { board: string | null; users: number }[];
};
const LABEL: Record<string, string> = {
    login: 'Entraram na conta', connect_ok: 'Conectaram a placa', flash_ok: 'Gravaram o firmware', wifi_ok: 'Configuraram o Wi-Fi', bind_ok: 'Aparelho na conta',
    connect_fail: 'Conexão', existing_fail: 'Placa já gravada', flash_fail: 'Gravação', wifi_fail: 'Wi-Fi', bind_fail: 'Vínculo',
};
const BOARD: Record<string, string> = { 'esp32-devkit': 'ESP32 DevKit', 'c3-headless': 'ESP32-C3', 's3-headless': 'ESP32-S3', 's3-35': 'Breww com tela 3,5"' };
const RANGES = [7, 30, 90] as const;
type LogRow = { id: number; session: string; board: string | null; chip: string | null; email: string | null; last_event: string | null; updated_at: string; size: number };
const LAST: Record<string, string> = { ...LABEL, existing_ok: 'Placa já gravada', done: 'Concluiu', login: 'Entrou na conta', connect_ok: 'Conectou a placa', flash_ok: 'Gravou', wifi_ok: 'Wi-Fi ok', bind_ok: 'Na conta' };

export const InstallFunnelCard = () => {
    const { token } = useAuth();
    const [days, setDays] = useState<number>(30);
    const [data, setData] = useState<Funnel | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setData(null); setError('');
        fetch(`${API_URL}/admin/install-funnel?days=${days}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async res => {
                if (res.status === 401) { window.dispatchEvent(new CustomEvent('auth:unauthorized')); return; }
                if (!res.ok) throw new Error();
                const json = await res.json();
                if (!Array.isArray(json?.funnel)) throw new Error();
                setData({ ...json, fails: json.fails || [], boards: json.boards || [] });
            })
            .catch(e => { if (e?.name !== 'AbortError') setError('Não foi possível carregar o funil.'); });
        return () => controller.abort();
    }, [token, days]);

    const top = data?.funnel[0]?.users || 0;
    const [logs, setLogs] = useState<LogRow[] | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetch(`${API_URL}/admin/install-logs`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async res => { if (!res.ok) throw new Error(); const j = await res.json(); setLogs(Array.isArray(j) ? j : []); })
            .catch(e => { if (e?.name !== 'AbortError') setLogs([]); });
        return () => controller.abort();
    }, [token]);
    const downloadLog = async (row: LogRow) => {
        const res = await fetch(`${API_URL}/admin/install-logs/${row.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([await res.text()], { type: 'text/plain' }));
        a.download = `instalacao-${row.board || row.chip || 'placa'}-${row.id}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="bg-white border border-black/[0.07] rounded-xl p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--muted)] flex items-center gap-2"><Filter size={16} /> Funil da instalação pelo site</h3>
                <div className="flex rounded-lg bg-[var(--bg)] p-0.5 text-xs font-semibold" role="group" aria-label="Período">
                    {RANGES.map(d => (
                        <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}
                            className={`min-h-8 rounded-md px-3 ${days === d ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{d} dias</button>
                    ))}
                </div>
            </div>
            {error ? <p className="text-sm text-[#d63a4d]">{error}</p> : !data ? <p className="text-sm text-[var(--muted)]">Carregando…</p> : !top ? (
                <p className="text-sm text-[var(--muted)]">Ninguém usou o assistente nos últimos {data.days} dias. As instalações feitas com conta aparecem aqui.</p>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                    <ol className="space-y-3" aria-label="Contas por etapa">
                        {data.funnel.map((f, k) => {
                            const pct = top ? Math.round((f.users / top) * 100) : 0;
                            return (
                                <li key={f.event}>
                                    <div className="flex items-baseline justify-between gap-3 text-sm">
                                        <span className="text-[var(--ink)]">{LABEL[f.event] || f.event}</span>
                                        <span className="tabular-nums text-[var(--muted)]"><b className="font-semibold text-[var(--ink)]">{f.users}</b>{k > 0 && ` · ${pct}%`}</span>
                                    </div>
                                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                                        <div className="h-full rounded-full bg-[#1fa84a]" style={{ width: `${Math.max(pct, f.users ? 2 : 0)}%` }} />
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                    <div className="space-y-5 text-sm">
                        <div>
                            <p className="mb-2 font-semibold text-[var(--muted)]">Placas detectadas</p>
                            {data.boards.length ? (
                                <ul className="divide-y divide-black/[0.06]">
                                    {data.boards.map(b => <li key={b.board || '-'} className="flex justify-between py-1.5"><span>{(b.board && BOARD[b.board]) || b.board || 'Não identificada'}</span><span className="tabular-nums">{b.users}</span></li>)}
                                </ul>
                            ) : <p className="text-[var(--muted)]">Nenhuma ainda.</p>}
                        </div>
                        <div>
                            <p className="mb-2 font-semibold text-[var(--muted)]">Falhas mais comuns</p>
                            {data.fails.length ? (
                                <ul className="divide-y divide-black/[0.06]">
                                    {data.fails.map((f, i) => <li key={i} className="flex justify-between gap-3 py-1.5"><span className="min-w-0 truncate" title={f.detail || ''}>{LABEL[f.event] || f.event}{f.detail ? ` · ${f.detail}` : ''}</span><span className="tabular-nums">{f.total}</span></li>)}
                                </ul>
                            ) : <p className="text-[var(--muted)]">Nenhuma falha registrada.</p>}
                        </div>
                    </div>
                </div>
            )}
            <div className="mt-6 border-t border-black/[0.06] pt-5">
                <p className="mb-2 text-sm font-semibold text-[var(--muted)]">Instalações recentes (log técnico, 90 dias)</p>
                {logs === null ? <p className="text-sm text-[var(--muted)]">Carregando…</p> : !logs.length ? <p className="text-sm text-[var(--muted)]">Nenhum log ainda. O assistente envia o log nas falhas, no fim e ao fechar a página.</p> : (
                    <ul className="max-h-80 divide-y divide-black/[0.06] overflow-y-auto text-sm">
                        {logs.map(r => (
                            <li key={r.id} className="flex items-center gap-3 py-2">
                                <span className="w-28 shrink-0 tabular-nums text-[var(--muted)]">{new Date(r.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="min-w-0 flex-1 truncate">{(r.board && BOARD[r.board]) || r.chip || 'Placa ?'} · <span className="text-[var(--muted)]">{r.email || '—'}</span></span>
                                <span className="hidden text-xs text-[var(--muted)] sm:inline">{r.last_event ? LAST[r.last_event] || r.last_event : '—'}</span>
                                <button type="button" onClick={() => downloadLog(r)} aria-label={`Baixar log ${r.id}`} className="rounded-lg p-2 text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--ink)]"><Download size={15} /></button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
