import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FinishedBrewDetail } from './FinishedBrewDetail';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FinishedBrew } from '../types';
import { ENV } from '../config/envs';

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
            const b = batchesRes.find((x: any) => String(x.id) === id);
            
            if(!b) {
                // Try history dedicated endpoint
                const historyRes = await fetch(`${ENV.API_URL}/history/batches`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if(historyRes.ok) {
                    const hData = await historyRes.json();
                    const hb = hData.find((x: any) => String(x.id) === id);
                    if(hb) {
                        return {
                            id: String(hb.id),
                            batchNumber: String(hb.id),
                            beerName: hb.name || hb.beer_name || 'Sem Nome',
                            style: hb.style || hb.beer_style || 'Other',
                            startDate: hb.started_at || hb.start_date,
                            endDate: hb.ended_at || hb.end_date || new Date().toISOString(),
                            og: parseFloat(hb.og) || 0,
                            fg: parseFloat(hb.fg) || 0,
                            abv: 0, // Simplified for wrapper
                            efficiency: 0,
                            notes: '',
                            readings: []
                        };
                    }
                }
                return null;
            }

            let og = parseFloat(b.og) || 0;
            let fg = parseFloat(b.fg) || 0;

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
                readings: []
            };
        },
        enabled: !!token && !!id
    });

    if (isLoading) {
        return <div className="p-12 text-center text-white">Carregando detalhes...</div>;
    }

    if (!brew) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <p className="text-white mb-4">Lote não encontrado.</p>
                <button onClick={() => navigate('/history')} className="text-blue-500 hover:underline">Voltar</button>
            </div>
        );
    }
    
    return (
        <div className="animate-in fade-in duration-300">
            <button
                onClick={() => navigate('/history')}
                className="mb-4 ml-6 flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white rounded-xl transition-all text-xs font-bold uppercase tracking-wider relative z-10"
            >
                Voltar
            </button>
            <FinishedBrewDetail brew={brew} />
        </div>
    );
};
