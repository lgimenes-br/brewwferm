import { useState, useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { fetchActiveBroadcast } from '../services/api';

export const SystemBanner = () => {
    const [broadcast, setBroadcast] = useState<any>(null);
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        // Fetch active broadcast
        fetchActiveBroadcast()
            .then(data => {
                if (data && data.id && data.message) {
                    // Check if user already closed this specific broadcast
                    try {
                        const closedId = localStorage.getItem('closed_broadcast');
                        if (closedId !== String(data.id)) {
                            setBroadcast(data);
                        }
                    } catch {
                        setBroadcast(data);
                    }
                }
            })
            .catch(() => {});
    }, []);

    if (!broadcast || closed) return null;

    const handleClose = () => {
        try {
            localStorage.setItem('closed_broadcast', String(broadcast.id));
        } catch {}
        setClosed(true);
    };

    const isWarning = broadcast.type === 'warning';

    return (
        <div
            role={isWarning ? 'alert' : 'status'}
            className={`w-full ${isWarning ? 'bg-amber-500' : 'bg-[var(--ink)]'} text-[var(--ink)] px-4 py-3 relative z-[100] shadow-md animate-in slide-in-from-top duration-300`}
        >
            <div className="max-w-7xl mx-auto flex items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                    {isWarning ? <AlertTriangle className="shrink-0" size={20} /> : <Info className="shrink-0" size={20} />}
                    <div>
                        {broadcast.title && <strong className="block sm:inline mr-2">{broadcast.title}</strong>}
                        <span className="text-sm opacity-90">{broadcast.message}</span>
                    </div>
                </div>
                <button 
                    type="button"
                    onClick={handleClose} 
                    aria-label="Fechar aviso"
                    className={`shrink-0 p-1 rounded-md transition-colors ${isWarning ? 'hover:bg-amber-600' : 'hover:bg-black'}`}
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
