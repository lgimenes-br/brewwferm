import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Download, X } from 'lucide-react';
import { OtaSession, OTA_NO_RESPONSE_MS, isOtaFinal } from '../services/otaSession';

export interface OtaProgressModalProps {
    session: OtaSession | null;
    deviceName?: string;
    onClose: () => void;
}

const TITLES: Record<OtaSession['stage'], string> = {
    sent: 'Enviando comando ao aparelho…',
    received: 'Aparelho preparando a atualização…',
    connecting: 'Conectando ao servidor…',
    downloading: 'Baixando o firmware…',
    verifying: 'Conferindo integridade…',
    rebooting: 'Reiniciando o aparelho…',
    done: 'Atualização concluída',
    failed: 'A atualização falhou'
};

const fmtElapsed = (ms: number) => `+${(ms / 1000).toFixed(1)}s`;

export const OtaProgressModal: React.FC<OtaProgressModalProps> = ({ session, deviceName, onClose }) => {
    const [now, setNow] = useState(Date.now());
    const active = !!session && !isOtaFinal(session);

    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(t);
    }, [active]);

    if (!session) return null;

    const final = isOtaFinal(session);
    const noResponse = session.stage === 'sent' && now - session.startedAt > OTA_NO_RESPONSE_MS;
    const showBar = ['connecting', 'downloading', 'verifying', 'rebooting', 'done'].includes(session.stage);

    let icon = <Loader2 size={28} className="animate-spin" />;
    let iconWrap = 'bg-black/[0.04] text-[var(--ink)]';
    if (session.stage === 'done') { icon = <CheckCircle2 size={28} />; iconWrap = 'bg-[var(--accent)]/25 text-[#178a3f]'; }
    else if (session.stage === 'failed') { icon = <XCircle size={28} />; iconWrap = 'bg-red-500/10 text-[#d63a4d]'; }
    else if (noResponse) { icon = <AlertTriangle size={28} />; iconWrap = 'bg-amber-500/15 text-[#b45309]'; }
    else if (session.stage === 'downloading') { icon = <Download size={28} className="animate-pulse" />; }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ota-progress-title"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0B0D12]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div className="bg-white border border-black/[0.07] p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconWrap}`}>{icon}</div>
                        <div>
                            <h3 id="ota-progress-title" className="text-[var(--ink)] font-medium">
                                {noResponse ? 'O aparelho ainda não respondeu' : TITLES[session.stage]}
                            </h3>
                            <p className="text-[var(--muted)] text-xs">
                                {deviceName || session.serial}{session.targetVersion ? ` · versão ${session.targetVersion}` : ''}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="text-[var(--muted)] hover:text-[var(--ink)] p-1">
                        <X size={18} />
                    </button>
                </div>

                {showBar && (
                    <div className="mb-4">
                        <div className="w-full bg-[var(--bg)] rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-2 rounded-full transition-all duration-300 ${session.stage === 'done' ? 'bg-[#2fbf55]' : 'bg-white'}`}
                                style={{ width: `${session.stage === 'connecting' ? 0 : session.progress}%` }}
                            />
                        </div>
                        <p className="text-right text-[11px] text-[var(--muted)] mt-1 font-mono">{session.stage === 'connecting' ? '—' : `${session.progress}%`}</p>
                    </div>
                )}

                <ol className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-3 space-y-1.5 max-h-56 overflow-y-auto mb-4" aria-live="polite" data-testid="ota-log">
                    {session.events.map((e, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                            <span className="text-black/40 font-mono shrink-0 w-14 text-right">{fmtElapsed(e.ts - session.startedAt)}</span>
                            <span className={e.kind === 'ok' ? 'text-[#178a3f]' : e.kind === 'error' ? 'text-[#d63a4d]' : 'text-[#2b2f37]'}>{e.text}</span>
                        </li>
                    ))}
                    {active && (
                        <li className="flex gap-2 text-xs text-black/40">
                            <span className="font-mono shrink-0 w-14 text-right">{fmtElapsed(now - session.startedAt)}</span>
                            <span className="animate-pulse">aguardando…</span>
                        </li>
                    )}
                </ol>

                {noResponse && (
                    <p className="text-[#b45309] text-xs mb-4">
                        Nenhuma confirmação do aparelho em {Math.round(OTA_NO_RESPONSE_MS / 1000)} s. Verifique se ele está ligado e conectado. Se ele responder, o progresso continua aqui.
                    </p>
                )}
                {active && !noResponse && (
                    <p className="text-[var(--muted)] text-[11px] mb-4">Não desligue o aparelho. Você pode fechar esta janela; a atualização continua.</p>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    className={`w-full py-3 rounded-xl font-medium transition-colors ${final ? 'bg-[var(--ink)] text-white hover:bg-black font-bold' : 'bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)]'}`}
                >
                    {final ? 'Concluir' : 'Fechar (continua em segundo plano)'}
                </button>
            </div>
        </div>
    );
};
