import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GitCompare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PageHeader } from './app/AppUI';

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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-8 pb-16">
            <PageHeader title="Comparar lotes" subtitle="Sobreponha dois lotes pelo tempo desde o início de cada um." />

            <div className="bg-white border border-black/[0.07] rounded-[26px] p-6 md:p-8 mb-8">
                {loadError && (
                    <div role="alert" className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-4 text-xs text-[#d63a4d]">
                        <span>{loadError}</span>
                        <button
                            type="button"
                            onClick={fetchBatches}
                            className="px-3 py-1.5 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] rounded-lg font-medium shrink-0"
                        >
                            Tentar novamente
                        </button>
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label htmlFor="compare-batch-1" className="text-[12px] font-medium text-[var(--muted)] block mb-2">Lote 1</label>
                        <select 
                            id="compare-batch-1"
                            value={batch1} 
                            onChange={e => setBatch1(e.target.value)}
                            className="w-full h-12 bg-[var(--cell-2)] border border-[var(--line)] text-[var(--ink)] rounded-2xl px-4 focus:outline-none focus:border-[rgba(113,252,143,0.55)] text-[16px]"
                        >
                            <option value="">Selecione um lote</option>
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name} - {new Date(b.started_at).toLocaleDateString('pt-BR')}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 w-full">
                        <label htmlFor="compare-batch-2" className="text-[12px] font-medium text-[var(--muted)] block mb-2">Lote 2</label>
                        <select 
                            id="compare-batch-2"
                            value={batch2} 
                            onChange={e => setBatch2(e.target.value)}
                            className="w-full h-12 bg-[var(--cell-2)] border border-[var(--line)] text-[var(--ink)] rounded-2xl px-4 focus:outline-none focus:border-[rgba(113,252,143,0.55)] text-[16px]"
                        >
                            <option value="">Selecione um lote</option>
                            {batches.map(b => (
                                <option key={b.id} value={b.id}>{b.name} - {new Date(b.started_at).toLocaleDateString('pt-BR')}</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={handleCompare}
                        disabled={loading || !batch1 || !batch2}
                        className="w-full md:w-auto px-8 py-3 bg-[var(--ink)] hover:bg-black text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                        {loading ? '...' : 'Comparar'}
                    </button>
                </div>
            </div>

            {data.length > 0 && (
                <div className="bg-white border border-black/[0.07] rounded-[26px] p-6 h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis 
                                dataKey="hour" 
                                stroke="#6B6F78" 
                                tick={{ fill: '#6b6f78', fontSize: 12 }}
                                tickFormatter={(val) => `${val}h`}
                                minTickGap={30}
                            />
                            
                            <YAxis 
                                yAxisId="left" 
                                stroke="#6B6F78" 
                                tick={{ fill: '#6b6f78', fontSize: 12 }}
                                domain={['auto', 'auto']}
                                unit="ºC"
                            />
                            <YAxis 
                                yAxisId="right" 
                                orientation="right" 
                                stroke="#6B6F78" 
                                tick={{ fill: '#6b6f78', fontSize: 12 }}
                                domain={['auto', 'auto']}
                                tickFormatter={(v) => Number.isFinite(Number(v)) ? Number(v).toFixed(3) : ''}
                            />
                            
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#20252F', borderColor: 'rgba(255,255,255,0.10)', borderRadius: '16px', color: '#ECECF1' }}
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
                            
                            <Line yAxisId="left" type="monotone" dataKey="b1_temp" name={`Temp (${b1Name})`} stroke="#71FC8F" strokeWidth={2} dot={false} connectNulls />
                            <Line yAxisId="left" type="monotone" dataKey="b2_temp" name={`Temp (${b2Name})`} stroke="#898E99" strokeWidth={2} dot={false} connectNulls />
                            
                            <Line yAxisId="right" type="monotone" dataKey="b1_sg" name={`SG (${b1Name})`} stroke="#71FC8F" strokeWidth={1.5} dot={false} strokeDasharray="5 5" connectNulls />
                            <Line yAxisId="right" type="monotone" dataKey="b2_sg" name={`SG (${b2Name})`} stroke="#898E99" strokeWidth={1.5} dot={false} strokeDasharray="5 5" connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};
