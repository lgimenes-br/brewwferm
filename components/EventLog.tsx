
import React, { useState } from 'react';
import { FermentationEvent, EventType } from '../types';
import { Plus, Tag, Calendar, X, Hash } from 'lucide-react';

interface EventLogProps {
  events: FermentationEvent[];
  onAddEvent: (event: Omit<FermentationEvent, 'id'>) => void;
  onRemoveEvent: (id: string) => void;
}

export const EventLog: React.FC<EventLogProps> = ({ events, onAddEvent, onRemoveEvent }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<EventType>(EventType.OTHER);
  const [newDesc, setNewDesc] = useState('');

  // Ensure events is always an array
  const safeEvents = events || [];

  const handleAdd = () => {
    if (!newDesc.trim()) return;
    onAddEvent({
      type: newType,
      description: newDesc,
      timestamp: new Date().toISOString()
    });
    setNewDesc('');
    setIsAdding(false);
  };

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest">Eventos do Lote</h3>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold uppercase rounded-full border border-neutral-700 transition-all"
        >
          <Plus size={12} /> Novo Evento
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 px-2 custom-scrollbar">
        {safeEvents.length === 0 && !isAdding && (
          <div className="w-full py-8 border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-600">
            <Hash size={24} className="mb-2 opacity-20" />
            <span className="text-xs">Nenhum evento registrado.</span>
          </div>
        )}

        {safeEvents.map((event) => (
          <div
            key={event.id}
            className="min-w-[200px] max-w-[250px] shrink-0 bg-neutral-900/40 border border-neutral-800 p-4 rounded-2xl group relative hover:border-neutral-700 transition-colors"
          >
            <button
              onClick={() => onRemoveEvent(event.id)}
              className="absolute top-2 right-2 p-1 text-neutral-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-1.5 h-1.5 rounded-full ${event.type === EventType.DRY_HOP ? 'bg-green-500' : 'bg-purple-500'}`}></span>
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">{event.type}</span>
            </div>
            <p className="text-sm text-neutral-400 font-light mb-3 line-clamp-2">{event.description}</p>
            <div className="flex items-center gap-1.5 text-neutral-600 text-[10px] font-mono">
              <Calendar size={10} />
              {new Date(event.timestamp).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      {/* Add Event Modal-ish Overlay */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-6">Novo Evento</h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Tipo de Evento</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as EventType)}
                  className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors text-sm"
                >
                  {Object.values(EventType).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Descrição / Notas</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: 100g de Lúpulo Citra em Flor"
                  className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors text-sm h-24 resize-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 bg-white text-black py-3 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
