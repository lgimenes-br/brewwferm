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
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onCancel}
        >
            <div
                className={`bg-neutral-900 border ${isWarning ? 'border-amber-900/50' : 'border-red-900/50'} p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 ${isWarning ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'} rounded-full flex items-center justify-center mb-4`}>
                        <AlertTriangle size={24} />
                    </div>
                    <h3 id="breww-confirm-dialog-title" className="text-xl font-medium text-white mb-2">
                        {title}
                    </h3>
                    <p className="text-neutral-400 text-sm mb-6">
                        {description}
                    </p>
                    <div className="flex w-full gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl font-medium transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                                isWarning
                                    ? 'bg-amber-500 hover:bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                    : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
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
