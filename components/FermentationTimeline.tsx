import React, { useState } from 'react';
import { FermentationEvent, EventType } from '../types';
import { Plus, Calendar, X, MessageSquareText, Activity } from 'lucide-react';

interface FermentationTimelineProps {
  events: FermentationEvent[];
  startDate?: string;
  onAddEvent: (event: Omit<FermentationEvent, 'id'>) => void;
  onRemoveEvent: (id: string) => void;
}

export const FermentationTimeline: React.FC<FermentationTimelineProps> = ({ events, startDate, onAddEvent, onRemoveEvent }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<EventType>(EventType.OTHER);
  const [newDesc, setNewDesc] = useState('');

  const safeEvents = events || [];
  
  // Synthesize Start Event if startDate exists
  const syntheticEvents: FermentationEvent[] = [];
  if (startDate) {
    syntheticEvents.push({
      id: 'system-start',
      type: EventType.SYSTEM_ACTION,
      description: 'Lote iniciado.',
      timestamp: startDate
    });
  }
  
  // Sort events chronologically, oldest first
  const allEvents = [...safeEvents, ...syntheticEvents];
  const sortedEvents = allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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

  const getColorForType = (type: EventType) => {
    switch (type) {
      case EventType.DRY_HOP: return 'bg-green-500';
      case EventType.FRUIT: return 'bg-pink-500';
      case EventType.CLARIFIER: return 'bg-blue-400';
      case EventType.SPICE: return 'bg-orange-400';
      case EventType.SYSTEM_ACTION: return 'bg-neutral-600';
      default: return 'bg-purple-500';
    }
  };

  return (
    <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-6 h-full flex flex-col min-h-[400px] max-h-[600px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
          <MessageSquareText size={14} />
          Diário de Bordo
        </h3>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full border border-neutral-700 transition-all shadow-sm text-xs font-bold uppercase tracking-widest"
          title="Nova Nota"
        >
          <Plus size={14} />
          <span>Adicionar</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 relative">
        {/* Continuous vertical line connecting all events */}
        {sortedEvents.length > 0 && (
          <div className="absolute left-3 top-2 bottom-6 w-px bg-neutral-800 z-0"></div>
        )}

        {sortedEvents.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center text-neutral-600 h-32 opacity-50">
            <MessageSquareText size={24} className="mb-2" />
            <span className="text-xs">Nenhum evento registrado.</span>
          </div>
        )}

        {sortedEvents.map((event) => (
          <div key={event.id} className="relative z-10 flex gap-4 group">
            {/* Timeline Dot */}
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full border-4 border-black flex items-center justify-center ${getColorForType(event.type)}`}>
                <div className="w-1.5 h-1.5 bg-black rounded-full opacity-50"></div>
              </div>
            </div>

            {/* Event Card */}
            <div className="flex-1 bg-neutral-900/60 border border-neutral-800 p-4 rounded-2xl hover:border-neutral-700 transition-colors relative">
              {event.id !== 'system-start' && (
                <button
                  onClick={() => onRemoveEvent(event.id)}
                  className="absolute top-3 right-3 text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover evento"
                >
                  <X size={14} />
                </button>
              )}
              
              <div className="flex justify-between items-start mb-2 pr-6">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-black/50 px-2 py-1 rounded-md">
                  {event.type}
                </span>
                <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
                  <Calendar size={10} />
                  {new Date(event.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })} às {new Date(event.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-neutral-300 font-light leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Event Overlay */}
      {isAdding && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 rounded-3xl">
          <div className="w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Nova Anotação</h3>
              <button onClick={() => setIsAdding(false)} className="text-neutral-500 hover:text-white"><X size={20}/></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Categoria</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as EventType)}
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors text-sm"
                >
                  {Object.values(EventType).filter(t => t !== EventType.SYSTEM_ACTION).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">Descrição</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descreva a ação ou observação..."
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors text-sm h-32 resize-none"
                  autoFocus
                />
              </div>

              <button
                onClick={handleAdd}
                disabled={!newDesc.trim()}
                className="w-full bg-white text-black py-4 rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                Gravar no Diário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
