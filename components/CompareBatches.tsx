import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GitCompare } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const CompareBatches: React.FC = () => {
    const { token } = useAuth();
    const [batches, setBatches] = useState<any[]>([]);
    const [batch1, setBatch1] = useState<string>('');
    const [batch2, setBatch2] = useState<string>('');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchBatches = React.useCallback(async () => {
        setLoadError(null);
        try {
            const res = await fetch(`${API_URL}/batches`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return;
            }
            if (res.ok) {
                const data = await res.json();
                const completed = (Array.isArray(data) ? data : []).filter((b: any) => !b.is_active);
                setBatches(completed);
            } else {
                setLoadError('Falha ao carregar lista de lotes para comparação.');
            }
        } catch (err) {
            console.error(err);
            setLoadError('Erro de conexão ao carregar lotes.');
        }
    }, [token]);

    useEffect(() => {
        fetchBatches();
    }, [fetchBatches]);

    const handleCompare = async () => {
        if (!batch1 || !batch2) return toast.error('Selecione dois lotes para comparar');
        if (batch1 === batch2) return toast.error('Selecione lotes diferentes');
        
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/batches/compare?batch1=${encodeURIComponent(batch1)}&batch2=${encodeURIComponent(batch2)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return;
            }
            if (res.ok) {
                const result = await res.json();
                const safeResult = Array.isArray(result) ? result : [];
                setData(safeResult);
                if (safeResult.length === 0) {
                    toast('Nenhum dado de telemetria encontrado para estes lotes.', { icon: 'ℹ️' });
                }
            } else {
                toast.error('Erro ao buscar dados');
            }
        } catch (err) {
            toast.error('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    const b1Name = batches.find(b => String(b.id) === batch1)?.name || 'Lote 1';
    const b2Name = batches.find(b => String(b.id) === batch2)?.name || 'Lote 2';

    return (
        <div className="p-6 md:px-10 w-full mx-auto animate-in fade-in duration-500 pb-20">
            <header className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
                        <GitCompare size={24} />
                    </div>
                    <h1 className="text-4xl font-light tracking-tight text-white">Comparador</h1>
                </div>
                <p className="text-neutral-500 font-light">Sobreponha dois lotes pelo tempo desde o início (Horas 0, 1, 2...)</p>
            </header>

            <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6 md:p-8 mb-8">
                {loadError && (
                    <div role="alert" className="mb-4 p-4 rounded-xl bg-red-950/20 border border-red-900/40 flex items-center justify-between gap-4 text-xs text-red-300">
                        <span>{loadError}</span>
                        <button
                            type="button"
                            onClick={fetchBatches}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold uppercase tracking-wider shrink-0"
                        >
                            Tentar novamente
                        </button>
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label htmlFor="compare-batch-1" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Lote 1</label>
                        <select 
                            id="compare-batch-1"
                            value={batch1} 
                            onChange={e => setBatch1(e.target.value)}
                            className="w-full bg-black border border-amber-500/30 text-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 font-bold"
                        >
                            <option value="">Selecione um lote</option>
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name} - {new Date(b.started_at).toLocaleDateString()}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 w-full">
                        <label htmlFor="compare-batch-2" className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Lote 2</label>
                        <select 
                            id="compare-batch-2"
                            value={batch2} 
                            onChange={e => setBatch2(e.target.value)}
                            className="w-full bg-black border border-purple-500/30 text-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 font-bold"
                        >
                            <option value="">Selecione um lote</option>
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name} - {new Date(b.started_at).toLocaleDateString()}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={handleCompare}
                        disabled={loading || !batch1 || !batch2}
                        className="w-full md:w-auto px-8 py-3 bg-white hover:bg-neutral-200 text-black rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                        {loading ? '...' : 'Comparar'}
                    </button>
                </div>
            </div>

            {data.length > 0 && (
                <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6 h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis 
                                dataKey="hour" 
                                stroke="#525252" 
                                tick={{ fill: '#737373', fontSize: 12 }}
                                tickFormatter={(val) => `${val}h`}
                                minTickGap={30}
                            />
                            
                            <YAxis 
                                yAxisId="left" 
                                stroke="#525252" 
                                tick={{ fill: '#737373', fontSize: 12 }}
                                domain={['auto', 'auto']}
                                unit="ºC"
                            />
                            <YAxis 
                                yAxisId="right" 
                                orientation="right" 
                                stroke="#525252" 
                                tick={{ fill: '#737373', fontSize: 12 }}
                                domain={['auto', 'auto']}
                                tickFormatter={(v) => Number.isFinite(Number(v)) ? Number(v).toFixed(3) : ''}
                            />
                            
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '8px' }}
                                labelFormatter={(val) => `Hora ${val}`}
                                formatter={(value: any, name: any) => {
                                    const label = String(name || '');
                                    const numVal = Number(value);
                                    if (!Number.isFinite(numVal)) return ['--', label];
                                    if (label.startsWith('Temp')) return [`${numVal.toFixed(1)}ºC`, label];
                                    if (label.startsWith('SG')) return [`${numVal.toFixed(3)} SG`, label];
                                    return [value, label];
                                }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            
                            <Line yAxisId="left" type="monotone" dataKey="b1_temp" name={`Temp (${b1Name})`} stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                            <Line yAxisId="left" type="monotone" dataKey="b2_temp" name={`Temp (${b2Name})`} stroke="#a855f7" strokeWidth={2} dot={false} strokeDasharray="5 5" connectNulls />
                            
                            <Line yAxisId="right" type="monotone" dataKey="b1_sg" name={`SG (${b1Name})`} stroke="#fbbf24" strokeWidth={2} dot={false} connectNulls />
                            <Line yAxisId="right" type="monotone" dataKey="b2_sg" name={`SG (${b2Name})`} stroke="#c084fc" strokeWidth={2} dot={false} strokeDasharray="5 5" connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};
