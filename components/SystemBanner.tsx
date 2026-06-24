import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SystemBanner = () => {
    const { token } = useAuth();
    const [broadcast, setBroadcast] = useState<any>(null);
    const [closed, setClosed] = useState(false);

    useEffect(() => {
        // Fetch active broadcast
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/broadcasts/active`)
            .then(res => res.json())
            .then(data => {
                if (data) {
                    // Check if user already closed this specific broadcast
                    const closedId = localStorage.getItem('closed_broadcast');
                    if (closedId !== String(data.id)) {
                        setBroadcast(data);
                    }
                }
            })
            .catch(() => {});
    }, []);

    if (!broadcast || closed) return null;

    const handleClose = () => {
        localStorage.setItem('closed_broadcast', String(broadcast.id));
        setClosed(true);
    };

    const isWarning = broadcast.type === 'warning';

    return (
        <div className={`w-full ${isWarning ? 'bg-amber-500' : 'bg-indigo-600'} text-white px-4 py-3 relative z-[100] shadow-md animate-in slide-in-from-top duration-300`}>
            <div className="max-w-7xl mx-auto flex items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                    {isWarning ? <AlertTriangle className="shrink-0" size={20} /> : <Info className="shrink-0" size={20} />}
                    <div>
                        {broadcast.title && <strong className="block sm:inline mr-2">{broadcast.title}</strong>}
                        <span className="text-sm opacity-90">{broadcast.message}</span>
                    </div>
                </div>
                <button 
                    onClick={handleClose} 
                    className={`shrink-0 p-1 rounded-md transition-colors ${isWarning ? 'hover:bg-amber-600' : 'hover:bg-indigo-700'}`}
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};
