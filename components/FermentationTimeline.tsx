import React, { useState, useEffect } from 'react';
import { FermentationEvent, EventType } from '../types';
import { Plus, X, ChevronRight, Settings, Leaf, StickyNote } from 'lucide-react';

interface FermentationTimelineProps {
  events: FermentationEvent[];
  startDate?: string;
  onAddEvent: (event: Omit<FermentationEvent, 'id'>) => void;
  onRemoveEvent: (id: string) => void;
}

/** Quantos acontecimentos aparecem antes do "Ver todos" (igual ao app) */
export const DIARY_PREVIEW = 5;

export const FermentationTimeline: React.FC<FermentationTimelineProps> = ({ events, startDate, onAddEvent, onRemoveEvent }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [newType, setNewType] = useState<EventType>(EventType.OTHER);
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    if (!isAdding && !showAll) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsAdding(false); setShowAll(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdding, showAll]);

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
  
  // Mais recentes primeiro (como no app); mostra os ultimos 5 e "Ver todos"
  const allEvents = [...safeEvents, ...syntheticEvents];
  const sortedEvents = allEvents.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
  });
  const visibleEvents = sortedEvents.slice(0, DIARY_PREVIEW);

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

  const when = (ts: string) => {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '--/--';
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Diario compacto, como no app: uma lista agrupada (icone, texto e "tipo · data"), sem um cartao por evento
  return (
    <section className={`relative app-card p-5 flex flex-col gap-3 lg:flex-1 ${isAdding ? 'min-h-[440px]' : ''}`} aria-label="Diário do lote">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-[15px] text-[var(--muted)]">Diário</h3>
        <button type="button" onClick={() => setIsAdding(true)} className="app-pill !h-9 hover:bg-[var(--cell-2)]" title="Nova anotação">
          <Plus size={14} aria-hidden /> Adicionar
        </button>
      </div>

      {sortedEvents.length === 0 && !isAdding ? (
        <p className="py-6 text-center text-[14px] text-[var(--muted)]">Nenhum acontecimento ainda.</p>
      ) : (
        <ul className="rounded-[18px] border border-[var(--line)] overflow-hidden divide-y divide-[var(--line)]">
          {visibleEvents.map(event => <EventRow key={event.id} event={event} when={when} onRemove={onRemoveEvent} />)}
          {sortedEvents.length > DIARY_PREVIEW && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                aria-haspopup="dialog"
                className="w-full flex items-center gap-3 px-3 min-h-[48px] text-[14px] text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
              >
                <span aria-hidden className="w-8 h-8 rounded-full bg-[var(--fill)] flex items-center justify-center text-[var(--muted)]">
                  <ChevronRight size={14} />
                </span>
                Ver todos ({sortedEvents.length})
              </button>
            </li>
          )}
        </ul>
      )}

      {/* Diario completo: abre num modal (a lista do layout fica sempre com os 5 ultimos) */}
      {showAll && (
        <div role="dialog" aria-modal="true" aria-labelledby="diary-all-title" className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#04070B]/70 backdrop-blur-sm sm:p-4" onClick={() => setShowAll(false)}>
          <div className="app-card w-full sm:max-w-lg max-h-[85dvh] flex flex-col !rounded-b-none sm:!rounded-[26px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h3 id="diary-all-title" className="text-[19px] text-[var(--ink)]">Diário <span className="text-[var(--muted)] tabular">· {sortedEvents.length}</span></h3>
              <button type="button" onClick={() => setShowAll(false)} aria-label="Fechar o diário" className="app-icon-btn !w-9 !h-9 text-[var(--muted)]" autoFocus><X size={16} /></button>
            </div>
            <ul className="mx-5 mb-5 rounded-[18px] border border-[var(--line)] divide-y divide-[var(--line)] overflow-y-auto overscroll-contain">
              {sortedEvents.map(event => <EventRow key={event.id} event={event} when={when} onRemove={onRemoveEvent} />)}
            </ul>
          </div>
        </div>
      )}

      {/* Add Event Overlay */}
      {isAdding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-event-dialog-title"
          className="absolute inset-0 z-20 flex items-center justify-center bg-white p-6 rounded-[26px]"
        >
          <div className="w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 id="new-event-dialog-title" className="text-lg font-medium text-[var(--ink)]">Nova Anotação</h3>
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
                <label htmlFor="timeline-event-category" className="text-[12px] font-medium text-[var(--muted)] mb-2 block">Categoria</label>
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
                <label htmlFor="timeline-event-description" className="text-[12px] font-medium text-[var(--muted)] mb-2 block">Descrição</label>
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
                className="w-full bg-[var(--ink)] text-white py-4 rounded-xl font-medium text-sm hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                Gravar no Diário
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const iconFor = (type: EventType) => type === EventType.SYSTEM_ACTION ? Settings : type === EventType.DRY_HOP ? Leaf : StickyNote;

/** Uma linha do diario: icone, texto, "tipo · data" e remover (so anotacoes; acoes do sistema nao se apagam, como no app) */
function EventRow({ event, when, onRemove }: { event: FermentationEvent; when: (ts: string) => string; onRemove: (id: string) => void }) {
  const Icon = iconFor(event.type);
  const system = event.type === EventType.SYSTEM_ACTION;
  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 min-h-[56px]">
      <span aria-hidden className="w-8 h-8 shrink-0 rounded-full bg-[var(--fill)] flex items-center justify-center" style={{ color: system ? 'var(--tertiary)' : 'var(--accent)' }}>
        <Icon size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-[var(--ink)] leading-snug whitespace-pre-wrap break-words">{event.description || event.type}</p>
        <p className="text-[12px] text-[var(--muted)] tabular">{event.type} · {when(event.timestamp)}</p>
      </div>
      {!system && (
        <button
          type="button"
          aria-label={`Remover: ${event.description || event.type}`}
          onClick={() => onRemove(event.id)}
          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] opacity-60 md:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          title="Remover"
        >
          <X size={14} />
        </button>
      )}
    </li>
  );
}
