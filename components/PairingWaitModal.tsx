import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import { fetchPairingStatus, PairingStatus } from '../services/api';

export interface PairingWaitModalProps {
    pairing: { pairingId: string; serial: string; expiresIn: number } | null;
    onConfirmed: (serial: string) => void;
    onClose: () => void;
    pollMs?: number;
}

const FAILURE_TEXT: Record<Exclude<PairingStatus, 'pending' | 'confirmed'>, { title: string; detail: string }> = {
    rejected: { title: 'Vínculo recusado no aparelho', detail: 'Alguém tocou em "Recusar" na tela do aparelho.' },
    expired: { title: 'Tempo esgotado', detail: 'Ninguém confirmou na tela do aparelho a tempo. Tente de novo com o aparelho por perto.' },
    superseded: { title: 'Pedido substituído', detail: 'Um novo pedido de vínculo foi feito para este aparelho.' },
    conflict: { title: 'Aparelho já vinculado', detail: 'Este aparelho já está vinculado a uma conta.' },
    limit: { title: 'Limite de aparelhos atingido', detail: 'Sua conta já está no limite do plano (até 3 aparelhos no grátis). Remova um para adicionar outro.' }
};

export const PairingWaitModal: React.FC<PairingWaitModalProps> = ({ pairing, onConfirmed, onClose, pollMs = 2000 }) => {
    const [status, setStatus] = useState<PairingStatus>('pending');
    const [secondsLeft, setSecondsLeft] = useState(0);
    const confirmedRef = useRef(false);
    const onConfirmedRef = useRef(onConfirmed);
    onConfirmedRef.current = onConfirmed;

    useEffect(() => {
        if (!pairing) return;
        setStatus('pending');
        setSecondsLeft(pairing.expiresIn);
        confirmedRef.current = false;
        let stopped = false;

        const poll = async () => {
            try {
                const res = await fetchPairingStatus(pairing.pairingId);
                if (stopped) return;
                setStatus(res.status);
                if (typeof res.expiresIn === 'number') setSecondsLeft(res.expiresIn);
                if (res.status === 'confirmed' && !confirmedRef.current) {
                    confirmedRef.current = true;
                    onConfirmedRef.current(pairing.serial);
                }
                if (res.status !== 'pending') stopped = true;
            } catch {
                // falha de rede momentanea: tenta de novo no proximo ciclo
            }
        };
        poll();
        const pollTimer = setInterval(() => { if (!stopped) poll(); }, pollMs);
        const tick = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
        return () => {
            stopped = true;
            clearInterval(pollTimer);
            clearInterval(tick);
        };
    }, [pairing, pollMs]);

    useEffect(() => {
        if (!pairing) return;
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [pairing, onClose]);

    if (!pairing) return null;

    const failure = status !== 'pending' && status !== 'confirmed' ? FAILURE_TEXT[status] : null;
    const mm = Math.floor(secondsLeft / 60);
    const ss = String(secondsLeft % 60).padStart(2, '0');

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pairing-wait-title"
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-end -mt-2 -mr-2">
                    <button type="button" onClick={onClose} aria-label="Fechar" className="text-neutral-500 hover:text-white p-1">
                        <X size={18} />
                    </button>
                </div>
                <div className="flex flex-col items-center text-center">
                    {status === 'pending' && (
                        <>
                            <div className="relative w-14 h-14 bg-white/5 text-white rounded-full flex items-center justify-center mb-4">
                                <Smartphone size={26} />
                                <Loader2 size={58} className="absolute inset-0 m-auto animate-spin text-neutral-600" strokeWidth={1} />
                            </div>
                            <h3 id="pairing-wait-title" className="text-lg font-medium text-white mb-2">Confirme na tela do aparelho</h3>
                            <p className="text-neutral-400 text-sm mb-1">
                                Toque em <span className="text-white font-medium">Confirmar</span> na tela do seu Breww para concluir o vínculo.
                            </p>
                            <p className="text-neutral-600 text-xs font-mono mb-5">{pairing.serial}</p>
                            <p className="text-neutral-500 text-xs mb-5" aria-live="polite">Expira em {mm}:{ss}</p>
                            <button type="button" onClick={onClose} className="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl font-medium transition-colors">
                                Cancelar
                            </button>
                        </>
                    )}
                    {status === 'confirmed' && (
                        <>
                            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 size={28} />
                            </div>
                            <h3 id="pairing-wait-title" className="text-lg font-medium text-white mb-2">Aparelho vinculado!</h3>
                            <p className="text-neutral-400 text-sm mb-5">Ele já aparece no seu painel.</p>
                            <button type="button" onClick={onClose} className="w-full bg-white text-black hover:bg-neutral-200 py-3 rounded-xl font-bold transition-colors">
                                Concluir
                            </button>
                        </>
                    )}
                    {failure && (
                        <>
                            <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mb-4">
                                <XCircle size={28} />
                            </div>
                            <h3 id="pairing-wait-title" className="text-lg font-medium text-white mb-2">{failure.title}</h3>
                            <p className="text-neutral-400 text-sm mb-5">{failure.detail}</p>
                            <button type="button" onClick={onClose} className="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl font-medium transition-colors">
                                Fechar
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
