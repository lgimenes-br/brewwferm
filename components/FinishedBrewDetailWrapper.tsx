import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FinishedBrewDetail } from './FinishedBrewDetail';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FinishedBrew, mapBatchToFinishedBrew } from '../types';

export const FinishedBrewDetailWrapper: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    
    // We fetch a single brew or find it from history cache
    // For simplicity here, we'll try to find it from the batches API or pass a mock if not found since history list usually passes the full object
    const { data: brew, isLoading } = useQuery({
        queryKey: ['brew', id],
        queryFn: async (): Promise<FinishedBrew | null> => {
            if(!token || !id) return null;
            const batchesRes = await api.fetchBatches(token);
            const b = Array.isArray(batchesRes) ? batchesRes.find((x: any) => String(x.id) === id) : null;
            
            if(!b) {
                try {
                    const hData = await api.fetchHistoryBatches(token);
                    const hb = Array.isArray(hData) ? hData.find((x: any) => String(x.id) === id) : null;
                    if(hb) {
                        return mapBatchToFinishedBrew(hb);
                    }
                } catch (e) {
                    // Fallback to null if history endpoint also fails
                }
                return null;
            }

            return mapBatchToFinishedBrew(b);
        },
        enabled: !!token && !!id
    });

    if (isLoading) {
        return <div className="p-12 text-center text-[var(--ink)]">Carregando detalhes...</div>;
    }

    if (!brew) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <p className="text-[var(--ink)] mb-4">Lote não encontrado.</p>
                <button onClick={() => navigate('/history')} className="text-blue-600 hover:underline">Voltar</button>
            </div>
        );
    }
    
    return (
        <div className="animate-in fade-in duration-300">
            <button
                onClick={() => navigate('/history')}
                className="mb-4 ml-6 flex items-center gap-2 px-4 py-2 bg-white border border-black/[0.07] hover:bg-[var(--bg)] text-[var(--ink)] rounded-xl transition-all text-xs font-bold relative z-10"
            >
                Voltar
            </button>
            <FinishedBrewDetail brew={brew} />
        </div>
    );
};
