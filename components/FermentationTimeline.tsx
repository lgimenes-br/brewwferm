import React, { useState, useEffect } from 'react';
import { FermentationEvent, EventType } from '../types';
import { Plus, Calendar, X, MessageSquareText } from 'lucide-react';

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

  useEffect(() => {
    if (!isAdding) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAdding(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdding]);

  const safeEvents = Array.isArray(events) ? events : [];
  
  // Synthesize Start Event if startDate exists
  const syntheticEvents: FermentationEvent[] = [];
  if (startDate && !isNaN(new Date(startDate).getTime())) {
    syntheticEvents.push({
      id: 'system-start',
      type: EventType.SYSTEM_ACTION,
      description: 'Lote iniciado.',
      timestamp: startDate
    });
  }
  
  // Sort events chronologically, oldest first
  const allEvents = [...safeEvents, ...syntheticEvents];
  const sortedEvents = allEvents.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
  });

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
      case EventType.DRY_HOP: return 'bg-[#2fbf55]';
      case EventType.FRUIT: return 'bg-pink-500';
      case EventType.CLARIFIER: return 'bg-blue-400';
      case EventType.SPICE: return 'bg-orange-400';
      case EventType.SYSTEM_ACTION: return 'bg-black/20';
      default: return 'bg-purple-500';
    }
  };

  return (
    <div className="relative bg-white border border-black/[0.07] rounded-3xl p-6 h-full flex flex-col min-h-[400px] max-h-[600px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[var(--muted)] font-bold text-xs flex items-center gap-2">
          <MessageSquareText size={14} />
          Diário de Bordo
        </h3>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] rounded-full border border-black/15 transition-all shadow-sm text-xs font-bold "
          title="Nova Nota"
        >
          <Plus size={14} />
          <span>Adicionar</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pr-2 custom-scrollbar space-y-6 relative">
        {/* Continuous vertical line connecting all events */}
        {sortedEvents.length > 0 && (
          <div className="absolute left-3 top-2 bottom-6 w-px bg-[var(--bg)] z-0"></div>
        )}

        {sortedEvents.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center text-black/40 h-32 opacity-50">
            <MessageSquareText size={24} className="mb-2" />
            <span className="text-xs">Nenhum evento registrado.</span>
          </div>
        )}

        {sortedEvents.map((event) => (
          <div key={event.id} className="relative z-10 flex gap-4 group">
            {/* Timeline Dot */}
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full border-4 border-black flex items-center justify-center ${getColorForType(event.type)}`}>
                <div className="w-1.5 h-1.5 bg-[var(--bg)] rounded-full opacity-50"></div>
              </div>
            </div>

            {/* Event Card */}
            <div className="flex-1 bg-white border border-black/[0.07] p-4 rounded-2xl hover:border-black/15 transition-colors relative">
              {event.id !== 'system-start' && (
                <button
                  type="button"
                  aria-label="Remover evento"
                  onClick={() => onRemoveEvent(event.id)}
                  className="absolute top-3 right-3 text-black/40 hover:text-[#d63a4d] opacity-60 md:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  title="Remover evento"
                >
                  <X size={14} />
                </button>
              )}
              
              <div className="flex justify-between items-start mb-2 pr-6">
                <span className="text-[10px] font-bold text-[var(--ink)] bg-[var(--bg)] px-2 py-1 rounded-md">
                  {event.type}
                </span>
                <span className="text-[10px] font-mono text-[var(--muted)] flex items-center gap-1">
                  <Calendar size={10} />
                  {(() => {
                    const d = new Date(event.timestamp);
                    if (isNaN(d.getTime())) return '--/--';
                    return `${d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                  })()}
                </span>
              </div>
              <p className="text-sm text-[#2b2f37] font-light leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Event Overlay */}
      {isAdding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-event-dialog-title"
          className="absolute inset-0 z-20 flex items-center justify-center bg-white p-6 rounded-3xl"
        >
          <div className="w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 id="new-event-dialog-title" className="text-lg font-bold text-[var(--ink)]">Nova Anotação</h3>
              <button
                type="button"
                aria-label="Fechar nova anotação"
                onClick={() => setIsAdding(false)}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X size={20}/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="timeline-event-category" className="text-[10px] font-bold text-[var(--muted)] mb-2 block">Categoria</label>
                <select
                  id="timeline-event-category"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as EventType)}
                  className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors text-sm"
                >
                  {Object.values(EventType).filter(t => t !== EventType.SYSTEM_ACTION).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="timeline-event-description" className="text-[10px] font-bold text-[var(--muted)] mb-2 block">Descrição</label>
                <textarea
                  id="timeline-event-description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descreva a ação ou observação..."
                  className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors text-sm h-32 resize-none"
                  autoFocus
                />
              </div>

              <button
                onClick={handleAdd}
                disabled={!newDesc.trim()}
                className="w-full bg-[var(--ink)] text-white py-4 rounded-xl font-bold text-sm hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
