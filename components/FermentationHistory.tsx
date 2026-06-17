
import React, { useEffect, useState } from 'react';
import { FinishedBrew } from '../types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { Calendar, ChevronRight, Loader2 } from 'lucide-react';

export const FermentationHistory: React.FC = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [history, setHistory] = useState<FinishedBrew[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!token) return;
            try {
                // Try the dedicated history endpoint first
                const [historyRes, batchesRes] = await Promise.all([
                    fetch(`${API_URL}/history/batches`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${API_URL}/batches`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                let allBatches: any[] = [];

                // Combine results from both endpoints
                if (historyRes.ok) {
                    const historyData = await historyRes.json();
                    if (Array.isArray(historyData)) {
                        allBatches.push(...historyData);
                    }
                }

                if (batchesRes.ok) {
                    const batchesData = await batchesRes.json();
                    if (Array.isArray(batchesData)) {
                        // Add all batches that aren't already in the list (including active ones)
                        for (const b of batchesData) {
                            if (!allBatches.find((x: any) => x.id === b.id)) {
                                allBatches.push(b);
                            }
                        }
                    }
                }

                // Map backend data to FinishedBrew
                const mapped: FinishedBrew[] = await Promise.all(
                    allBatches.map(async (b: any) => {
                        let og = parseFloat(b.og) || 0;
                        let fg = parseFloat(b.fg) || 0;

                        // If OG/FG are missing from backend, try to get from telemetry
                        if ((!og || !fg) && b.id) {
                            try {
                                const telRes = await fetch(`${API_URL}/batch/${b.id}/data`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (telRes.ok) {
                                    const telemetry = await telRes.json();
                                    if (telemetry.length > 0) {
                                        // Get first VALID gravity reading as OG (skip zeros/nulls/invalid values)
                                        if (!og) {
                                            for (const reading of telemetry) {
                                                const gravityValue = parseFloat(reading.gravity);
                                                // Valid OG should be between 1.000 and 1.200
                                                if (gravityValue && gravityValue >= 1.000 && gravityValue <= 1.200) {
                                                    og = gravityValue;
                                                    break;
                                                }
                                            }
                                        }

                                        // Get last VALID gravity reading as FG (skip zeros/nulls/invalid values)
                                        if (!fg) {
                                            for (let i = telemetry.length - 1; i >= 0; i--) {
                                                const gravityValue = parseFloat(telemetry[i].gravity);
                                                // Valid FG should be between 0.990 and 1.200
                                                if (gravityValue && gravityValue >= 0.990 && gravityValue <= 1.200) {
                                                    fg = gravityValue;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                // Silently fail - will use zeros
                            }
                        }

                        return {
                            id: String(b.id),
                            batchNumber: String(b.id),
                            beerName: b.name || b.beer_name || 'Sem Nome',
                            style: b.style || b.beer_style || 'Other',
                            startDate: b.started_at || b.start_date,
                            endDate: b.ended_at || b.end_date || new Date().toISOString(),
                            og,
                            fg,
                            abv: (og && fg && og > fg) ? ((og - fg) * 131.25) : 0,
                            efficiency: (og && fg && og > 1) ? ((og - fg) / (og - 1.0) * 100) : 0,
                            notes: '',
                            readings: [] // Details fetched specifically
                        };
                    })
                );
                setHistory(mapped);
            } catch (e) {
                console.error("Failed to fetch history", e);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [token]);

    if (loading) {
        return <div className="p-12 text-center text-neutral-500"><Loader2 className="animate-spin mx-auto mb-2" />Carregando histórico...</div>;
    }

    return (
        <div className="p-6 md:px-10 w-full mx-auto animate-in fade-in duration-500">
            <header className="mb-12 flex justify-between items-end border-b border-neutral-800/50 pb-6">
                <div>
                    <h1 className="text-4xl font-light tracking-tight text-white mb-2">Logs de Produção</h1>
                    <p className="text-neutral-500 font-light">Histórico completo de lotes finalizados.</p>
                </div>
                <div className="text-right hidden md:block">
                    <span className="text-3xl font-light text-neutral-200">{history.length}</span>
                    <p className="text-xs text-neutral-600 uppercase tracking-widest font-bold mt-1">Lotes Arquivados</p>
                </div>
            </header>

            <div className="space-y-4">
                {/* Table Header (Visual only) */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-xs font-bold text-neutral-600 uppercase tracking-widest pb-2">
                    <div className="col-span-4">Lote / Cerveja</div>
                    <div className="col-span-2">Estilo</div>
                    <div className="col-span-2">Data Fim</div>
                    <div className="col-span-3 text-center">Estatísticas</div>
                    <div className="col-span-1"></div>
                </div>

                {/* List Items */}
                {history.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500 bg-neutral-900/10 rounded-xl border border-neutral-800 border-dashed">
                        Nenhum lote finalizado encontrado.
                    </div>
                ) : history.map((brew) => (
                    <div
                        key={brew.id}
                        onClick={() => navigate(`/history/${brew.id}`)}
                        className="group grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-neutral-900/20 hover:bg-neutral-900/60 border border-neutral-800/50 hover:border-neutral-700 rounded-2xl p-6 cursor-pointer transition-all duration-300"
                    >
                        {/* Beer Info */}
                        <div className="col-span-4">
                            <span className="text-xs font-mono text-neutral-500 mb-1 block">#{brew.batchNumber}</span>
                            <h3 className="text-xl font-medium text-neutral-200 group-hover:text-white transition-colors">{brew.beerName}</h3>
                        </div>

                        {/* Style */}
                        <div className="col-span-2">
                            <span className="inline-block px-3 py-1 rounded-md text-xs font-medium bg-neutral-800 text-neutral-400 border border-neutral-800 group-hover:border-neutral-700 transition-colors">
                                {brew.style}
                            </span>
                        </div>

                        {/* Date */}
                        <div className="col-span-2 text-neutral-500 text-sm font-light">
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-neutral-700" />
                                {new Date(brew.endDate).toLocaleDateString()}
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="col-span-3 flex justify-center gap-6">
                            <div className="text-center">
                                <span className="block text-[10px] text-neutral-600 uppercase font-bold">ABV</span>
                                <span className="text-sm font-mono text-green-500/80 group-hover:text-green-400">{brew.abv.toFixed(1)}%</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-[10px] text-neutral-600 uppercase font-bold">OG</span>
                                <span className="text-sm font-mono text-neutral-500 group-hover:text-neutral-300">{brew.og.toFixed(3)}</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-[10px] text-neutral-600 uppercase font-bold">FG</span>
                                <span className="text-sm font-mono text-purple-500/80 group-hover:text-purple-400">{brew.fg.toFixed(3)}</span>
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="col-span-1 text-right">
                            <div className="w-8 h-8 rounded-full bg-transparent group-hover:bg-neutral-800 flex items-center justify-center text-neutral-600 group-hover:text-white transition-all ml-auto">
                                <ChevronRight size={16} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
