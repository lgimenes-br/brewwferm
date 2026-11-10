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
    let iconWrap = 'bg-white/5 text-white';
    if (session.stage === 'done') { icon = <CheckCircle2 size={28} />; iconWrap = 'bg-emerald-500/10 text-emerald-400'; }
    else if (session.stage === 'failed') { icon = <XCircle size={28} />; iconWrap = 'bg-red-500/10 text-red-400'; }
    else if (noResponse) { icon = <AlertTriangle size={28} />; iconWrap = 'bg-amber-500/10 text-amber-400'; }
    else if (session.stage === 'downloading') { icon = <Download size={28} className="animate-pulse" />; }

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ota-progress-title"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconWrap}`}>{icon}</div>
                        <div>
                            <h3 id="ota-progress-title" className="text-white font-medium">
                                {noResponse ? 'O aparelho ainda não respondeu' : TITLES[session.stage]}
                            </h3>
                            <p className="text-neutral-500 text-xs">
                                {deviceName || session.serial}{session.targetVersion ? ` · versão ${session.targetVersion}` : ''}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="text-neutral-500 hover:text-white p-1">
                        <X size={18} />
                    </button>
                </div>

                {showBar && (
                    <div className="mb-4">
                        <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-2 rounded-full transition-all duration-300 ${session.stage === 'done' ? 'bg-emerald-500' : 'bg-white'}`}
                                style={{ width: `${session.stage === 'connecting' ? 0 : session.progress}%` }}
                            />
                        </div>
                        <p className="text-right text-[11px] text-neutral-400 mt-1 font-mono">{session.stage === 'connecting' ? '—' : `${session.progress}%`}</p>
                    </div>
                )}

                <ol className="bg-black/40 border border-neutral-800 rounded-xl p-3 space-y-1.5 max-h-56 overflow-y-auto mb-4" aria-live="polite" data-testid="ota-log">
                    {session.events.map((e, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                            <span className="text-neutral-600 font-mono shrink-0 w-14 text-right">{fmtElapsed(e.ts - session.startedAt)}</span>
                            <span className={e.kind === 'ok' ? 'text-emerald-400' : e.kind === 'error' ? 'text-red-400' : 'text-neutral-300'}>{e.text}</span>
                        </li>
                    ))}
                    {active && (
                        <li className="flex gap-2 text-xs text-neutral-600">
                            <span className="font-mono shrink-0 w-14 text-right">{fmtElapsed(now - session.startedAt)}</span>
                            <span className="animate-pulse">aguardando…</span>
                        </li>
                    )}
                </ol>

                {noResponse && (
                    <p className="text-amber-300/80 text-xs mb-4">
                        Nenhuma confirmação do aparelho em {Math.round(OTA_NO_RESPONSE_MS / 1000)} s. Verifique se ele está ligado e conectado. Se ele responder, o progresso continua aqui.
                    </p>
                )}
                {active && !noResponse && (
                    <p className="text-neutral-500 text-[11px] mb-4">Não desligue o aparelho. Você pode fechar esta janela; a atualização continua.</p>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    className={`w-full py-3 rounded-xl font-medium transition-colors ${final ? 'bg-white text-black hover:bg-neutral-200 font-bold' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}
                >
                    {final ? 'Concluir' : 'Fechar (continua em segundo plano)'}
                </button>
            </div>
        </div>
    );
};
