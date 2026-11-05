import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FinishedBrewDetail } from './FinishedBrewDetail';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FinishedBrew } from '../types';
import { API_URL } from '../config';

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
            const extractNotes = (ing: any, rawNotes?: string) => {
                if (rawNotes) return rawNotes;
                if (!ing) return '';
                try {
                    const parsed = typeof ing === 'string' ? JSON.parse(ing) : ing;
                    return parsed && typeof parsed.notes === 'string' ? parsed.notes : '';
                } catch {
                    return '';
                }
            };
            const batchesRes = await api.fetchBatches(token);
            const b = Array.isArray(batchesRes) ? batchesRes.find((x: any) => String(x.id) === id) : null;
            
            if(!b) {
                // Try history dedicated endpoint
                const historyRes = await fetch(`${API_URL}/history/batches`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if(historyRes.ok) {
                    const hData = await historyRes.json();
                    const hb = Array.isArray(hData) ? hData.find((x: any) => String(x.id) === id) : null;
                    if(hb) {
                        let hbOg = parseFloat(hb.og) || 0;
                        let hbFg = parseFloat(hb.fg) || parseFloat(hb.last_gravity) || 0;
                        if (hbOg > 500) hbOg = hbOg / 1000;
                        if (hbFg > 500) hbFg = hbFg / 1000;
                        return {
                            id: String(hb.id),
                            batchNumber: String(hb.id),
                            beerName: hb.name || hb.beer_name || 'Sem Nome',
                            style: hb.style || hb.beer_style || 'Other',
                            startDate: hb.started_at || hb.start_date,
                            endDate: hb.ended_at || hb.end_date || '',
                            og: hbOg,
                            fg: hbFg,
                            abv: (hbOg && hbFg && hbOg > hbFg) ? ((hbOg - hbFg) * 131.25) : 0,
                            efficiency: (hbOg && hbFg && hbOg > 1) ? ((hbOg - hbFg) / (hbOg - 1.0) * 100) : 0,
                            notes: extractNotes(hb.ingredients, hb.notes),
                            ingredients: hb.ingredients,
                            sensor1_name: hb.sensor1_name,
                            sensor2_name: hb.sensor2_name,
                            sensor_sg_name: hb.sensor_sg_name,
                            readings: []
                        };
                    }
                }
                return null;
            }

            let og = parseFloat(b.og) || 0;
            let fg = parseFloat(b.fg) || parseFloat(b.last_gravity) || 0;
            if (og > 500) og = og / 1000;
            if (fg > 500) fg = fg / 1000;

            return {
                id: String(b.id),
                batchNumber: String(b.id),
                beerName: b.name || b.beer_name || 'Sem Nome',
                style: b.style || b.beer_style || 'Other',
                startDate: b.started_at || b.start_date,
                endDate: b.ended_at || b.end_date || '',
                og,
                fg,
                abv: (og && fg && og > fg) ? ((og - fg) * 131.25) : 0,
                efficiency: (og && fg && og > 1) ? ((og - fg) / (og - 1.0) * 100) : 0,
                notes: extractNotes(b.ingredients, b.notes),
                ingredients: b.ingredients,
                sensor1_name: b.sensor1_name,
                sensor2_name: b.sensor2_name,
                sensor_sg_name: b.sensor_sg_name,
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
