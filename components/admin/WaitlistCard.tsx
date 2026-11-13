import { useEffect, useState } from 'react';
import { ListChecks, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

// Lista de espera da home: quem pediu aviso do controlador pronto ou do plano Pro.
type Entry = { id: number; email: string; interest: 'pronto' | 'pro'; created_at: string };
const LABEL: Record<Entry['interest'], string> = { pronto: 'Controlador pronto', pro: 'Plano Pro' };

export const WaitlistCard = () => {
    const { token } = useAuth();
    const [rows, setRows] = useState<Entry[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        fetch(`${API_URL}/admin/waitlist`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
            .then(async res => {
                if (res.status === 401) { window.dispatchEvent(new CustomEvent('auth:unauthorized')); return; }
                if (!res.ok) throw new Error();
                setRows(await res.json());
            })
            .catch(e => { if (e?.name !== 'AbortError') setError('Não foi possível carregar a lista de espera.'); });
        return () => controller.abort();
    }, [token]);

    const remove = async (entry: Entry) => {
        if (!window.confirm(`Tirar ${entry.email} da lista de espera?`)) return;
        const res = await fetch(`${API_URL}/admin/waitlist/${entry.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return void toast.error('Não foi possível remover.');
        setRows(r => (r || []).filter(x => x.id !== entry.id));
        toast.success('Removido da lista.');
    };

    const exportCsv = () => {
        const csv = ['email,interesse,data', ...(rows || []).map(r => `${r.email},${LABEL[r.interest]},${new Date(r.created_at).toISOString()}`)].join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = 'lista-de-espera.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const count = (i: Entry['interest']) => (rows || []).filter(r => r.interest === i).length;

    return (
        <div className="bg-white border border-black/[0.07] rounded-xl p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--muted)] flex items-center gap-2"><ListChecks size={16} /> Lista de espera</h3>
                {!!rows?.length && (
                    <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-black/[0.04]">
                        <Download size={15} /> Exportar CSV
                    </button>
                )}
            </div>
            {error ? <p className="text-sm text-[#d63a4d]">{error}</p> : rows === null ? <p className="text-sm text-[var(--muted)]">Carregando…</p> : (
                <>
                    <div className="mb-5 grid grid-cols-2 gap-3">
                        {(['pronto', 'pro'] as const).map(i => (
                            <div key={i} className="rounded-lg border border-black/[0.07] bg-[var(--bg)] p-4">
                                <div className="text-2xl font-semibold tabular-nums text-[var(--ink)]">{count(i)}</div>
                                <div className="text-xs font-semibold text-[var(--muted)]">{LABEL[i]}</div>
                            </div>
                        ))}
                    </div>
                    {!rows.length ? <p className="text-sm text-[var(--muted)]">Ninguém na lista ainda. Os e-mails deixados na home aparecem aqui.</p> : (
                        <ul className="max-h-80 divide-y divide-black/[0.06] overflow-y-auto">
                            {rows.map(r => (
                                <li key={r.id} className="flex items-center gap-3 py-2.5 text-sm">
                                    <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{r.email}</span>
                                    <span className="hidden text-xs text-[var(--muted)] sm:inline">{LABEL[r.interest]}</span>
                                    <span className="text-xs tabular-nums text-[var(--muted)]">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                                    <button type="button" onClick={() => remove(r)} aria-label={`Remover ${r.email}`} className="rounded-lg p-2 text-[var(--muted)] hover:bg-black/[0.04] hover:text-[#d63a4d]"><Trash2 size={15} /></button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};
