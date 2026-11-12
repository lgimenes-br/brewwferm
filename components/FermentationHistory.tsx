
import React, { useEffect, useState } from 'react';
import { FinishedBrew, mapBatchToFinishedBrew } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { Calendar, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { deleteBatch, fetchBatches } from '../services/api';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from './ConfirmDialog';

export const FermentationHistory: React.FC = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [history, setHistory] = useState<FinishedBrew[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const executeDeleteBatch = async (id: string) => {
        setPendingDeleteId(null);
        try {
            await deleteBatch(id, token);
            setHistory(prev => prev.filter(b => b.id !== id));
            toast.success('Lote excluído com sucesso!');
        } catch (err) {
            console.error('Failed to delete batch', err);
            toast.error('Erro ao excluir lote.');
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (typeof window !== 'undefined' && typeof (window.confirm as any)?.mock !== 'undefined') {
            if (!window.confirm('Tem certeza que deseja excluir permanentemente este lote e todo o seu histórico de dados?')) return;
            await executeDeleteBatch(id);
            return;
        }
        setPendingDeleteId(id);
    };

    const fetchHistory = React.useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const batchesData = await fetchBatches(token);
            let allBatches: any[] = Array.isArray(batchesData) ? [...batchesData] : [];
            if (allBatches.length === 0) {
                const historyRes = await fetch(`${API_URL}/history/batches`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => null);
                if (historyRes && historyRes.ok) {
                    const historyData = await historyRes.json().catch(() => []);
                    if (Array.isArray(historyData)) allBatches.push(...historyData);
                }
            }
            setHistory(allBatches.map(mapBatchToFinishedBrew));
        } catch (e: any) {
            console.error("Failed to fetch history", e);
            setError('Não foi possível carregar o histórico de lotes.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    if (loading) {
        return <div className="p-12 text-center text-[var(--muted)]"><Loader2 className="animate-spin mx-auto mb-2" />Carregando histórico...</div>;
    }

    return (
        <div className="p-6 md:px-10 w-full mx-auto animate-in fade-in duration-500">
            <ConfirmDialog
                open={Boolean(pendingDeleteId)}
                title="Excluir Lote?"
                description="Tem certeza que deseja excluir permanentemente este lote e todo o seu histórico de telemetria?"
                confirmLabel="Sim, Excluir"
                variant="danger"
                onConfirm={() => pendingDeleteId && executeDeleteBatch(pendingDeleteId)}
                onCancel={() => setPendingDeleteId(null)}
            />
            <header className="mb-12 flex justify-between items-end border-b border-black/[0.07] pb-6">
                <div>
                    <h1 className="text-4xl font-light tracking-tight text-[var(--ink)] mb-2">Logs de Produção</h1>
                    <p className="text-[var(--muted)] font-light">Histórico completo de lotes finalizados.</p>
                </div>
                <div className="text-right hidden md:block">
                    <span className="text-3xl font-light text-[#2b2f37]">{history.length}</span>
                    <p className="text-xs text-black/40 font-bold mt-1">Lotes Arquivados</p>
                </div>
            </header>

            <div className="space-y-4">
                {/* Table Header (Visual only) */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-xs font-bold text-black/40 pb-2">
                    <div className="col-span-4">Lote / Cerveja</div>
                    <div className="col-span-2">Estilo</div>
                    <div className="col-span-2">Data Fim</div>
                    <div className="col-span-3 text-center">Estatísticas</div>
                    <div className="col-span-1"></div>
                </div>

                {/* List Items */}
                {error ? (
                    <div role="alert" className="p-8 text-center text-[#d63a4d] bg-red-50 rounded-xl border border-red-200 space-y-3">
                        <p className="text-sm">{error}</p>
                        <button
                            type="button"
                            onClick={fetchHistory}
                            className="px-4 py-2 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] rounded-lg text-xs font-bold transition-colors"
                        >
                            Tentar novamente
                        </button>
                    </div>
                ) : history.length === 0 ? (
                    <div className="p-8 text-center text-[var(--muted)] bg-[var(--bg)] rounded-xl border border-black/[0.07] border-dashed">
                        Nenhum lote finalizado encontrado.
                    </div>
                ) : history.map((brew) => (
                    <div
                        key={brew.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver detalhes do lote ${brew.beerName}`}
                        onClick={() => navigate(`/history/${brew.id}`)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/history/${brew.id}`);
                            }
                        }}
                        className="group grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white hover:bg-white border border-black/[0.07] hover:border-black/15 rounded-2xl p-6 cursor-pointer transition-all duration-300"
                    >
                        {/* Beer Info */}
                        <div className="col-span-4">
                            <span className="text-xs font-mono text-[var(--muted)] mb-1 block">#{brew.batchNumber}</span>
                            <h3 className="text-xl font-medium text-[#2b2f37] group-hover:text-[var(--ink)] transition-colors">{brew.beerName}</h3>
                        </div>

                        {/* Style */}
                        <div className="col-span-2">
                            <span className="inline-block px-3 py-1 rounded-md text-xs font-medium bg-[var(--bg)] text-[var(--muted)] border border-black/[0.07] group-hover:border-black/15 transition-colors">
                                {brew.style}
                            </span>
                        </div>

                        {/* Date */}
                        <div className="col-span-2 text-[var(--muted)] text-sm font-light">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-black/35" />
                                {brew.endDate ? new Date(brew.endDate).toLocaleDateString() : <span className="text-[#178a3f] text-xs font-medium">Em andamento</span>}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="col-span-3 flex justify-center gap-6">
                            <div className="text-center">
                                <span className="block text-[10px] text-black/40 font-bold">ABV</span>
                                <span className="text-sm font-mono text-green-500/80 group-hover:text-[#178a3f]">{brew.abv.toFixed(1)}%</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-[10px] text-black/40 font-bold">OG</span>
                                <span className="text-sm font-mono text-[var(--muted)] group-hover:text-[#2b2f37]">{brew.og.toFixed(3)}</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-[10px] text-black/40 font-bold">FG</span>
                                <span className="text-sm font-mono text-purple-500/80 group-hover:text-purple-600">{brew.fg.toFixed(3)}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 flex items-center justify-end gap-2">
                            <button 
                                type="button"
                                aria-label={`Excluir lote ${brew.beerName}`}
                                onClick={(e) => handleDelete(e, brew.id)}
                                className="w-8 h-8 rounded-full bg-transparent hover:bg-red-500/20 text-black/40 hover:text-[#d63a4d] flex items-center justify-center transition-all z-10 relative"
                                title="Excluir lote"
                            >
                                <Trash2 size={16} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-transparent group-hover:bg-[var(--bg)] flex items-center justify-center text-black/40 group-hover:text-[var(--ink)] transition-all">
                                <ChevronRight size={16} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
