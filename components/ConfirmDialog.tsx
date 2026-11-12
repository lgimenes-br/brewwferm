import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    description,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    onConfirm,
    onCancel
}) => {
    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onCancel]);

    if (!open) return null;

    const isWarning = variant === 'warning';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="breww-confirm-dialog-title"
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0B0D12]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onCancel}
        >
            <div
                className={`bg-white border border-black/[0.07] p-6 rounded-3xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 ${isWarning ? 'bg-amber-500/15 text-[#b45309]' : 'bg-red-500/10 text-[#d63a4d]'} rounded-full flex items-center justify-center mb-4`}>
                        <AlertTriangle size={24} />
                    </div>
                    <h3 id="breww-confirm-dialog-title" className="text-xl font-medium text-[var(--ink)] mb-2">
                        {title}
                    </h3>
                    <p className="text-[var(--muted)] text-sm mb-6">
                        {description}
                    </p>
                    <div className="flex w-full gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] py-3 rounded-full font-medium transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`flex-1 py-3 rounded-full font-medium transition-colors ${
                                isWarning
                                    ? 'bg-[var(--ink)] hover:bg-black text-white font-semibold'
                                    : 'bg-[#d63a4d] hover:bg-[#b92e40] text-white font-semibold'
                            }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
