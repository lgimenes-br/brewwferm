import { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

// Biblioteca de perfis compartilhados: tudo o que foi publicado, os mais denunciados primeiro.
// Publica na hora; o admin esconde (e mostra de novo) o que for improprio.

type Step = { name: string; temperature: number; duration: number; triggerGravity?: number };
type Item = { id: number; name: string; style: string | null; description: string | null; steps: Step[]; author: string; authorEmail: string;
    uses: number; hidden: boolean; reports: number; reasons: string; createdAt: string };

export const LibraryTab = () => {
    const { token } = useAuth();
    const [items, setItems] = useState<Item[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<number | null>(null);

    const load = () => {
        setError(null);
        fetch(`${API_URL}/admin/library`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error('Falha ao carregar a biblioteca.'))))
            .then(setItems)
            .catch(e => setError(e.message));
    };
    useEffect(load, [token]);

    const toggle = async (it: Item) => {
        setBusy(it.id);
        try {
            const r = await fetch(`${API_URL}/admin/library/${it.id}/hidden`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ hidden: !it.hidden }),
            });
            if (!r.ok) throw new Error('Não foi possível alterar o perfil.');
            setItems(prev => prev?.map(x => (x.id === it.id ? { ...x, hidden: !it.hidden } : x)) ?? null);
        } catch (e) { setError(e instanceof Error ? e.message : 'Erro'); } finally { setBusy(null); }
    };

    const reported = items?.filter(i => i.reports > 0 && !i.hidden).length ?? 0;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--muted)]">
                    {items ? `${items.length} perfis publicados · ${reported} com denúncia aguardando` : 'Carregando…'}
                </p>
                <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/[0.03]">
                    <RefreshCw size={15} /> Atualizar
                </button>
            </div>
            {error && <p role="alert" className="rounded-xl bg-[#fde8e5] px-4 py-3 text-sm text-[#a3271a]">{error}</p>}
            {items && items.length === 0 && <p className="rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[var(--muted)]">Ninguém publicou um perfil ainda.</p>}
            <ul className="space-y-3">
                {items?.map(it => (
                    <li key={it.id} className={`rounded-2xl border bg-white p-5 ${it.reports > 0 && !it.hidden ? 'border-[#e8b4aa]' : 'border-black/[0.07]'} ${it.hidden ? 'opacity-60' : ''}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-[var(--ink)]">{it.name}{it.hidden && <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-xs font-normal">escondido</span>}</p>
                                <p className="mt-0.5 text-sm text-[var(--muted)]">
                                    {it.author} ({it.authorEmail}) · {it.style || 'sem estilo'} · {it.uses} {it.uses === 1 ? 'uso' : 'usos'} · {new Date(it.createdAt).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                            <button type="button" disabled={busy === it.id} onClick={() => toggle(it)}
                                className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/[0.03] disabled:opacity-50">
                                {it.hidden ? <><Eye size={15} /> Mostrar</> : <><EyeOff size={15} /> Esconder</>}
                            </button>
                        </div>
                        {it.description && <p className="mt-3 text-sm text-[#2b2f37]">{it.description}</p>}
                        <p className="mt-3 text-sm text-[#2b2f37]">
                            {it.steps.map((s, k) => `${k + 1}. ${s.name} ${s.temperature} °C por ${s.duration} ${s.duration === 1 ? 'dia' : 'dias'}`).join(' · ')}
                        </p>
                        {it.reports > 0 && (
                            <p className="mt-3 rounded-xl bg-[#fdf1ee] px-3 py-2 text-sm text-[#7a2a1f]">
                                {it.reports} {it.reports === 1 ? 'denúncia' : 'denúncias'}{it.reasons ? `: ${it.reasons}` : ''}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};
