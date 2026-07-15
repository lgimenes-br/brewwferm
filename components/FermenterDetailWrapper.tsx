import React, { useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFermenters } from '../hooks/useFermenters';
import { FermenterDetail } from './FermenterDetail';
import { Fermenter, DeviceMode } from '../types';
import { useBrew } from '../context/BrewContext';
import { toast } from 'react-hot-toast';

export const FermenterDetailWrapper: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { fermenters, updateBatch, isLoading, isFetching, updateFermenterLocal, saveEvent, deleteEvent, refetch } = useFermenters();
    const { sendCommand } = useBrew();
    
    const fermenter = fermenters.find(f => f.id === id);
    
    const handleUpdate = useCallback(async (updateId: string, updates: Partial<Fermenter>) => {
        // App.tsx legacy code mapped these updates. 
        // We now wire them directly to the BrewContext MQTT dispatches.
        
        let shouldUpdateOptimistically = false;

        if (updates.og !== undefined || updates.fg !== undefined || updates.beerName !== undefined) {
             await updateBatch({
                 serialCode: updateId, 
                 og: updates.og, 
                 fg: updates.fg, 
                 name: updates.beerName
             });
             shouldUpdateOptimistically = true;
        }

        if (updates.isPaused !== undefined) {
            sendCommand(updateId, 'togglePause', {});
            toast.success(updates.isPaused ? 'Perfil Pausado!' : 'Perfil Retomado!');
            shouldUpdateOptimistically = true;
        }

        if (updates.currentStepIndex !== undefined && updates.profile === undefined) {
            const currentIndex = fermenter?.currentStepIndex || 0;
            if (updates.currentStepIndex > currentIndex) {
                // Moving forward usually means skipping step in this interface
                if (confirm('Avançar para a próxima etapa?')) {
                    sendCommand(updateId, 'skipStep', {});
                    toast.success('Comando para pular etapa enviado!');
                }
            } else if (updates.currentStepIndex < currentIndex) {
                // Moving backward
                if (confirm('Voltar para a etapa anterior?')) {
                    // We re-send the profile with the new current step index
                    const payloadSteps = (fermenter?.profile || []).map((step) => ({
                        n: step.name,
                        t: step.temperature,
                        d: step.duration * 24 // ESP32 expects hours, DB stores days
                    }));
                    sendCommand(updateId, 'setProfile', { 
                        steps: payloadSteps, 
                        currentStep: updates.currentStepIndex 
                    });
                    toast.success('Comando para retornar etapa enviado!');
                }
            }
            shouldUpdateOptimistically = true;
        }

        if (updates.targetTemp !== undefined) {
            // Depending on mode, it might be fsm or csp. The device takes setpoint_manual mostly, 
            // but we use the old logic's "setpoint_manual" or "chopp_setpoint".
            const field = fermenter?.mode === DeviceMode.KEGERATOR ? 'chopp_setpoint' : 'setpoint_manual';
            sendCommand(updateId, 'setManual', { field, val: updates.targetTemp });
            toast.success(`Temperatura atualizada para ${updates.targetTemp}°C`);
        }

        if (updates.profile !== undefined) {
            // Remap keys for ESP payload requirements: { n, t, d }
            const payloadSteps = updates.profile.map((step) => ({
                n: step.name,
                t: step.temperature,
                d: step.duration * 24 // ESP32 expects hours, DB stores days
            }));
            sendCommand(updateId, 'setProfile', { steps: payloadSteps, currentStep: updates.currentStepIndex !== undefined ? updates.currentStepIndex : (fermenter?.currentStepIndex || 0) });
            await updateBatch({ serialCode: updateId, profile: updates.profile });
            toast.success('Perfil atualizado com sucesso!');
            shouldUpdateOptimistically = true;
        }

        if (updates.mode !== undefined) {
            const modeVal = updates.mode === DeviceMode.FERMENTER ? 0 : 
                            updates.mode === DeviceMode.FRIDGE ? 1 : 
                            updates.mode === DeviceMode.KEGERATOR ? 2 : 0;
            sendCommand(updateId, 'setMode', { value: modeVal });
            toast.success(`Modo alterado para ${updates.mode}`);
        }

        if (updates.kegeratorConfig !== undefined) {
            const queue = [
                { field: 'c_n1', val: updates.kegeratorConfig.line1 }, 
                { field: 'c_n2', val: updates.kegeratorConfig.line2 },
                { field: 'c_n3', val: updates.kegeratorConfig.style }, 
                { field: 'c_n4', val: updates.kegeratorConfig.brewery },
                { field: 'c_ibu', val: String(updates.kegeratorConfig.ibu) }, 
                { field: 'c_vol', val: String(updates.kegeratorConfig.abv) } // Legacy app maps 'vol' to ABV %
            ];
            
            queue.forEach((item, index) => { 
                setTimeout(() => sendCommand(updateId, 'setChopp', item), index * 150); 
            });
            toast.success('Informações do display atualizadas!');
        }

        if (updates.events !== undefined) {
            // Update local state immediately for UI
            updateFermenterLocal(updateId, { events: updates.events });
            
            // Persist new events to backend
            if (fermenter?.batchId && updates.events && updates.events.length > (fermenter.events?.length || 0)) {
                const newEvent = updates.events[updates.events.length - 1];
                if (newEvent) {
                    try {
                        await saveEvent({
                            batchId: fermenter.batchId,
                            type: newEvent.type,
                            description: newEvent.description,
                            date: newEvent.timestamp
                        });
                        toast.success('Evento salvo!');
                        refetch();
                    } catch (err) {
                        console.error('Failed to save event:', err);
                        toast.error('Erro ao salvar evento.');
                    }
                }
            } 
            // Handle event deletion
            else if (fermenter?.batchId && updates.events && updates.events.length < (fermenter.events?.length || 0)) {
                const updatedEventIds = new Set(updates.events.map(e => e.id));
                const deletedEvent = fermenter.events?.find(e => !updatedEventIds.has(e.id));
                
                if (deletedEvent && deletedEvent.id && !deletedEvent.id.startsWith('system-')) {
                    try {
                        await deleteEvent(deletedEvent.id);
                        toast.success('Evento removido!');
                        refetch();
                    } catch (err) {
                        console.error('Failed to delete event:', err);
                        toast.error('Erro ao remover evento.');
                        refetch(); // restore local state
                    }
                }
            }
            return;
        }

        if (shouldUpdateOptimistically) {
             updateFermenterLocal(updateId, updates);
        }

    }, [updateBatch, sendCommand, fermenter, updateFermenterLocal, saveEvent, refetch]);

    // Show loading if it's the first load OR if we're fetching and haven't found the device yet
    const isWorking = isLoading || (isFetching && !fermenter);

    if (isWorking) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
                <p className="text-neutral-400 text-sm animate-pulse">Carregando dados do fermentador...</p>
            </div>
        );
    }

    if (!fermenter) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <p className="text-white mb-4">Fermentador não encontrado.</p>
                <button onClick={() => navigate('/')} className="text-blue-500 hover:underline">Voltar</button>
            </div>
        );
    }
    
    // FermenterDetail uses onUpdate to update the state


    return <FermenterDetail fermenter={fermenter} onUpdate={handleUpdate} />;
};
