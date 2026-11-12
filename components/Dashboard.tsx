
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Fermenter, FermenterStatus, DeviceMode, ScannedDevice, normalizeGravity, isDeviceOnline as checkDeviceOnline } from '../types';
import { Wifi, WifiOff, ArrowRight, Thermometer, Settings, X, Save, Network, Plus, Search, Loader2, Smartphone, Trash2, AlertTriangle, CheckCircle2, QrCode } from 'lucide-react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFermenters } from '../hooks/useFermenters';
import { useBrew } from '../context/BrewContext';
import { fetchDiscoveryDevices, AddDeviceResult } from '../services/api';
import { PairingWaitModal } from './PairingWaitModal';
import { WifiSignal } from './WifiSignal';

/** Normaliza o codigo do aparelho: MAC com ":"/"-" (ex: 28:84:85:49:54:64) vira o ID dos topicos MQTT (288485495464). */
export const normalizePairCode = (raw: string): string => {
    const code = (raw || '').trim().toUpperCase();
    if (/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/.test(code)) return code.replace(/[:-]/g, '');
    return code;
};

export const Dashboard: React.FC = () => {
    const { fermenters, addDevice, updateDevice, deleteDevice, refetch } = useFermenters();
    const [pendingPairing, setPendingPairing] = useState<{ pairingId: string; serial: string; expiresIn: number } | null>(null);
    const { connectionStatus, isInitialSyncing, sendCommand } = useBrew();
    
    // Keep track of which devices we've already asked for status in this component lifecycle
    const askedDevices = React.useRef<Set<string>>(new Set());

    useEffect(() => {
        if (connectionStatus === 'connected' && fermenters.length > 0) {
            fermenters.forEach(f => {
                const isCorrupted = !f.currentDevice?.rssi && f.currentDevice?.temperature === 0 && (f.currentFridgeTemp === 20 || f.currentFridgeTemp === 0);
                
                // Ask for status if it's the first time we see this device, OR if it's corrupted and we haven't asked recently
                if (!askedDevices.current.has(f.id) || (isCorrupted && !askedDevices.current.has(`corrupted_${f.id}`))) {
                    askedDevices.current.add(f.id);
                    if (isCorrupted) askedDevices.current.add(`corrupted_${f.id}`);
                    
                    sendCommand(f.id, "request_status", {});
                }
            });
        }
    }, [connectionStatus, fermenters, sendCommand]);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    // Edit States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // Delete State
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Add Manual States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newDeviceName, setNewDeviceName] = useState('');
    const [newDeviceIp, setNewDeviceIp] = useState('');
    // Codigo de confirmacao (8 caracteres) da tela do aparelho / QR: prova que e o aparelho real
    const [newDeviceCode, setNewDeviceCode] = useState('');
    const cleanConfirmCode = (v: string) => v.replace(/[^0-9a-fA-F]/g, '').toUpperCase().slice(0, 8);

    // Auto-pair via QR Code da tela do aparelho (https://breww.live/?pair=<ID>) or pending sessionStorage pair code
    useEffect(() => {
        let pairCode = searchParams.get('pair')?.trim() || '';
        let confirmCode = searchParams.get('code')?.trim() || '';
        if (!pairCode && typeof window !== 'undefined') {
            try {
                pairCode = sessionStorage.getItem('breww_pending_pair')?.trim() || '';
                confirmCode = sessionStorage.getItem('breww_pending_pair_code')?.trim() || '';
                if (pairCode) sessionStorage.removeItem('breww_pending_pair');
                sessionStorage.removeItem('breww_pending_pair_code');
            } catch {}
        }
        if (pairCode) {
            setNewDeviceIp(normalizePairCode(pairCode));
            if (confirmCode) setNewDeviceCode(cleanConfirmCode(confirmCode));
            setNewDeviceName(prev => prev.trim() ? prev : 'Meu Breww');
            setIsAddModalOpen(true);
            toast.success('Código do aparelho preenchido automaticamente!');
            if (searchParams.has('pair')) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete('pair');
                nextParams.delete('code');
                setSearchParams(nextParams, { replace: true });
            }
        }
    }, [searchParams, setSearchParams]);

    // Scan States
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
    const [deviceToAddFromScan, setDeviceToAddFromScan] = useState<ScannedDevice | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => {
            if (typeof document === 'undefined' || !document.hidden) {
                setNow(Date.now());
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // WCAG 2.1.1 Close active modal on Escape key
    useEffect(() => {
        if (!editingId && !deletingId && !isAddModalOpen && !isScanModalOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEditingId(null);
                setDeletingId(null);
                setIsAddModalOpen(false);
                setIsScanModalOpen(false);
                setDeviceToAddFromScan(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [editingId, deletingId, isAddModalOpen, isScanModalOpen]);

    // Edit Handlers (Update needs to be handled via API now, but dashboard only updates Name/IP)
    // To keep it simple, we'll wait for the FermenterDetail refactor or create a specific update hook
    const handleEditClick = (e: React.MouseEvent, fermenter: Fermenter) => {
        e.stopPropagation(); // Prevent opening the detail view
        setEditingId(fermenter.id);
        setEditName(fermenter.name);
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
    };

    const confirmDelete = async () => {
        if (deletingId && !isSubmitting) {
            setIsSubmitting(true);
            try {
                await deleteDevice(deletingId);
                toast.success('Dispositivo removido com sucesso!');
            } catch (err) {
                toast.error('Erro ao remover dispositivo.');
            } finally {
                setIsSubmitting(false);
                setDeletingId(null);
            }
        }
    };

    const handleSaveEdit = async () => {
        if (editingId && editName.trim() && !isSubmitting) {
            setIsSubmitting(true);
            try {
                await updateDevice({ serialCode: editingId, name: editName.trim() });
                toast.success('Dispositivo atualizado com sucesso!');
                setEditingId(null);
            } catch (err) {
                toast.error('Erro ao atualizar dispositivo.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // Vinculo concluido (direto ou apos confirmacao na tela do aparelho)
    const finishDeviceAdded = (serial: string) => {
        sendCommand(serial, 'setMode', { value: 1 });
        refetch();
        toast.success('Dispositivo adicionado com sucesso!');
    };

    const handleAddResult = (result: AddDeviceResult, serial: string) => {
        if (result && result.status === 'pending') {
            setPendingPairing({ pairingId: result.pairingId, serial, expiresIn: result.expiresIn });
        } else {
            finishDeviceAdded(serial);
        }
    };

    // Add Manual Handlers
    const handleManualAdd = async () => {
        const cleanName = newDeviceName.trim();
        const cleanIp = normalizePairCode(newDeviceIp);
        if (cleanName && cleanIp && !isSubmitting) {
            setIsSubmitting(true);
            try {
                const result = await addDevice({
                    name: cleanName,
                    serialCode: cleanIp,
                    pairCode: newDeviceCode || undefined
                });
                setIsAddModalOpen(false);
                setNewDeviceName('');
                setNewDeviceIp('');
                setNewDeviceCode('');
                handleAddResult(result, cleanIp);
            } catch (err: any) {
                toast.error(err?.message || 'Erro ao adicionar dispositivo.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    // Scan Handlers
    const startScan = async () => {
        setIsScanning(true);
        setScannedDevices([]);

        try {
            const devs = await fetchDiscoveryDevices();
            setScannedDevices(Array.isArray(devs) ? devs : []);
        } catch (e) {
            console.error("Scan error", e);
        } finally {
            setIsScanning(false);
        }
    };

    const handleSelectScanned = (device: ScannedDevice) => {
        setDeviceToAddFromScan(device);
        setNewDeviceName(`Novo ${device.type}`); // Default Name
    };

    const handleSaveScanned = async () => {
        const cleanName = newDeviceName.trim();
        if (deviceToAddFromScan && cleanName && !isSubmitting) {
            setIsSubmitting(true);
            try {
                const scannedSerial = (deviceToAddFromScan.ip || '').trim();
                const result = await addDevice({
                    name: cleanName,
                    serialCode: scannedSerial,
                    pairCode: newDeviceCode || undefined
                });
                setNewDeviceCode('');
                setIsScanModalOpen(false);
                setDeviceToAddFromScan(null);
                setScannedDevices([]);
                handleAddResult(result, scannedSerial);
            } catch (err: any) {
                toast.error(err?.message || 'Erro ao adicionar dispositivo.');
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const isDeviceOnline = (f: Fermenter) => checkDeviceOnline(f, now);
    const onlineCount = fermenters.filter(isDeviceOnline).length;

    return (
        <div className="p-6 md:px-10 w-full mx-auto animate-in fade-in duration-500">
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-light tracking-tight text-[var(--ink)] mb-2">Dispositivos</h1>
                    <p className="text-[var(--muted)] font-light">Gerenciamento de equipamentos e conexões</p>
                </div>
                <div className="flex flex-col md:items-end gap-2">
                    <div className="text-xs text-black/40 font-mono mb-1">
                        {onlineCount} de {fermenters.length} {fermenters.length === 1 ? "aparelho online" : "aparelhos online"}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setIsScanModalOpen(true);
                                startScan();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] rounded-lg text-xs font-bold tracking-wide transition-all border border-black/15"
                        >
                            <Search size={14} /> Procurar
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--ink)] hover:bg-black text-white rounded-lg text-xs font-bold tracking-wide transition-all"
                        >
                            <Plus size={14} /> Adicionar
                        </button>
                    </div>
                </div>
            </header>

            {fermenters.length === 0 && !isInitialSyncing ? (
                <div className="bg-white border border-black/[0.07] rounded-2xl p-6 md:p-8 my-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-black/[0.07]">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--ink)] tracking-tight">Nenhum equipamento conectado</h2>
                            <p className="text-[var(--muted)] text-xs mt-1">
                                Conecte seu controlador Breww em 3 etapas simples para iniciar no Modo Geladeira (4.0°C):
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsScanModalOpen(true);
                                    startScan();
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-[var(--bg)] text-[#2b2f37] hover:text-[var(--ink)] rounded-xl text-xs font-bold transition-all border border-black/[0.07]"
                            >
                                <Search size={14} /> Procurar no Mesmo Wi-Fi
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--ink)] hover:bg-black text-white rounded-xl text-xs font-bold transition-all"
                            >
                                <Plus size={14} /> Digitar Código do Aparelho
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-mono text-[11px] font-bold text-[var(--muted)] bg-white border border-black/[0.07] px-2 py-0.5 rounded-md">
                                        01
                                    </span>
                                    <CheckCircle2 size={15} className="text-[var(--muted)]" />
                                                                </div>
                                <h3 className="text-[var(--ink)] font-bold text-sm mb-1">Conta Ativa</h3>
                                <p className="text-[var(--muted)] text-xs leading-relaxed">
                                    Sua conta já está pronta para vincular controladores e sincronizar telemetria.
                                </p>
                            </div>
                        </div>

                        <div className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-mono text-[11px] font-bold text-[var(--muted)] bg-white border border-black/[0.07] px-2 py-0.5 rounded-md">
                                        02
                                    </span>
                                    <Wifi size={15} className="text-[var(--muted)]" />
                                </div>
                                <h3 className="text-[var(--ink)] font-bold text-sm mb-1">Wi-Fi do Aparelho</h3>
                                <p className="text-[var(--muted)] text-xs leading-relaxed">
                                    Ligue o controlador na tomada e conecte ao Wi-Fi pela tela touch do equipamento.
                                </p>
                            </div>
                        </div>

                        <div className="bg-[var(--bg)] border border-black/[0.07] rounded-xl p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-mono text-[11px] font-bold text-[var(--muted)] bg-white border border-black/[0.07] px-2 py-0.5 rounded-md">
                                        03
                                    </span>
                                    <QrCode size={15} className="text-[var(--muted)]" />
                                </div>
                                <h3 className="text-[var(--ink)] font-bold text-sm mb-1">Vincular Serial / IP</h3>
                                <p className="text-[var(--muted)] text-xs leading-relaxed">
                                    Escaneie o QR Code na tela do aparelho ou digite o código de 12 caracteres exibido nela.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fermenters.map((f) => {
                    // Check connectivity (30s window backed by 10s MQTT request_status heartbeats)
                    const isOnline = isDeviceOnline(f);

                    // Lógica dinâmica de Status/Modo/Badge
                    let statusLabel = 'Inativo';
                    let dotColor = "bg-black/30";
                    let textColor = "text-[var(--muted)]";
                    let containerClass = "bg-[var(--bg)] border-black/[0.07]";

                    if (f.mode === DeviceMode.FERMENTER) {
                        if (f.status !== FermenterStatus.IDLE) {
                            const currentStep = f.profile && f.profile[f.currentStepIndex];
                            if (currentStep) {
                                statusLabel = currentStep.name;
                            } else {
                                statusLabel = f.status;
                            }

                            if (f.status === FermenterStatus.COLD_CRASH) {
                                dotColor = "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]";
                                textColor = "text-blue-600";
                                containerClass = "bg-blue-50 border-blue-200";
                            } else {
                                dotColor = "bg-[#2fbf55] shadow-[0_0_8px_rgba(34,197,94,0.6)]";
                                textColor = "text-[#178a3f]";
                                containerClass = "bg-green-50 border-green-200";
                            }
                        }
                    } else if (f.mode === DeviceMode.KEGERATOR) {
                        statusLabel = "Choppeira";
                        dotColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
                        textColor = "text-[#b45309]";
                        containerClass = "bg-amber-50 border-amber-200";
                    } else if (f.mode === DeviceMode.FRIDGE) {
                        statusLabel = "Geladeira";
                        dotColor = "bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]";
                        textColor = "text-blue-700";
                        containerClass = "bg-blue-50 border-blue-200";
                    }

                    // Safe Parsing of Numbers to avoid toFixed errors on Strings
                    const rawTemp = (f.mode === DeviceMode.KEGERATOR || f.mode === DeviceMode.FRIDGE)
                        ? parseFloat(String(f.currentFridgeTemp ?? 0))
                        : parseFloat(String(f.currentDevice?.temperature ?? 0));
                    const safeTemp = !isNaN(rawTemp) ? rawTemp : 0;
                    const rawTarget = parseFloat(String(f.targetTemp ?? 0));
                    const safeTarget = !isNaN(rawTarget) ? rawTarget : 0;
                    const rawFridge = parseFloat(String(f.currentFridgeTemp ?? 0));
                    const safeFridge = !isNaN(rawFridge) ? rawFridge : 0;
                    
                    const lastChartGravity = f.readings && f.readings.length > 0 
                        ? f.readings[f.readings.length - 1].gravity 
                        : 0;
                    const rawHumidity = f.currentDevice?.extSens?.hum;
                    const parsedHumidity = rawHumidity !== undefined && rawHumidity !== null ? parseFloat(String(rawHumidity)) : NaN;
                    const safeHumidity = !isNaN(parsedHumidity) ? parsedHumidity : undefined;
                    const rawGravity = f.currentDevice?.gravity > 0 
                        ? f.currentDevice.gravity
                        : lastChartGravity;
                    const safeGravity = normalizeGravity(rawGravity, 0);
                        
                    const safeOG = normalizeGravity(f.og, 0);
                    const safeFG = f.fg ? normalizeGravity(f.fg, 0) : null;
                    const rawRssi = f.currentDevice?.rssi || 0;


                    const isCorrupted = isOnline && isInitialSyncing && !f.currentDevice?.rssi && f.currentDevice?.temperature === 0 && (f.currentFridgeTemp === 20 || f.currentFridgeTemp === 0) && !f.currentDevice?.extSens?.hum;
                    const showConnectingOverlay = (!isOnline && isInitialSyncing) || isCorrupted;
                    const showOfflineOverlay = !isOnline && !isInitialSyncing;

                    return (
                        <div key={f.id} className="relative">
                            {(showConnectingOverlay || showOfflineOverlay) && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[3px] rounded-3xl border border-black/[0.07] pointer-events-none">
                                    {showConnectingOverlay ? (
                                        <>
                                            <Loader2 className="animate-spin text-[var(--muted)] mb-2" size={24} />
                                            <span className="text-xs font-mono text-[var(--muted)] ">Conectando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <WifiOff className="text-[var(--muted)] mb-2" size={24} />
                                            <span className="text-xs font-mono text-[var(--muted)] ">Offline</span>
                                        </>
                                    )}
                                </div>
                            )}
                        <div
                            role={isOnline ? "button" : undefined}
                            tabIndex={isOnline ? 0 : undefined}
                            aria-label={isOnline ? `Abrir controle de ${f.name}` : `${f.name} (Offline)`}
                            onClick={() => isOnline && navigate(`/fermenter/${encodeURIComponent(f.id)}`)}
                            onKeyDown={(e) => {
                                if (isOnline && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    navigate(`/fermenter/${encodeURIComponent(f.id)}`);
                                }
                            }}
                            className={`group relative rounded-3xl p-8 transition-all duration-300 overflow-hidden border ${
                                isOnline 
                                ? 'bg-white hover:bg-white border-black/[0.07] hover:border-black/15 cursor-pointer hover:shadow-2xl hover:shadow-black/50' 
                                : 'bg-white border-black/[0.07] cursor-default'
                            }`}
                        >
                            {/* Header Section: Name & ID & Actions */}
                            <div className="relative z-30 flex justify-between items-start mb-6">
                                <div>
                                    <span className="block text-xs font-bold text-[var(--muted)] ">
                                        {f.name}
                                    </span>
                                    <span className="block text-[10px] font-mono text-black/40 mt-1">
                                        {f.id}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Online/Offline Dot */}
                                    <div
                                        title={isOnline ? "Online" : "Offline"}
                                        className={`w-2 h-2 rounded-full transition-all duration-500 ${isOnline ? 'bg-[#2fbf55] shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500/50 border border-red-200'}`}
                                    />

                                    <div className="flex items-center bg-[var(--bg)] rounded-lg p-1 border border-black/10">
                                        <button
                                            onClick={(e) => handleDeleteClick(e, f.id)}
                                            className="text-[var(--muted)] hover:text-[#d63a4d] hover:bg-red-500/10 p-1.5 rounded-md transition-all"
                                            title="Excluir Dispositivo"
                                            aria-label={`Excluir ${f.name}`}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="w-px h-3 bg-neutral-700/50 mx-1"></div>
                                        <button
                                            onClick={(e) => handleEditClick(e, f)}
                                            className="text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/10 p-1.5 rounded-md transition-all"
                                            title="Configurações"
                                            aria-label={`Editar ${f.name}`}
                                        >
                                            <Settings size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8">
                                {/* Beer Name */}
                                <h2
                                    title={f.mode === DeviceMode.FRIDGE ? undefined : (f.mode === DeviceMode.KEGERATOR ? (f.kegeratorConfig?.line1 || f.chopp_name || f.beerName || 'Barril de Chopp') : (f.beerName || 'Vazio'))}
                                    className={`text-2xl font-bold transition-colors truncate mb-3 tracking-tight ${f.mode === DeviceMode.FRIDGE ? 'invisible' : 'text-[var(--ink)] group-hover:text-[var(--ink)]'}`}
                                >
                                    {f.mode === DeviceMode.FRIDGE ? 'GELADEIRA' : f.mode === DeviceMode.KEGERATOR ? (f.kegeratorConfig?.line1 || f.chopp_name || f.beerName || 'Barril de Chopp') : (f.beerName || 'Vazio')}
                                </h2>

                                {/* Smart Status Badge: Reflete o modo e a rampa atual */}
                                <div title={statusLabel} className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${containerClass} backdrop-blur-sm transition-all max-w-full`}>
                                    <span className={`w-2 h-2 shrink-0 rounded-full ${dotColor} animate-pulse`}></span>
                                    <span className={`text-[10px] font-bold ${textColor} truncate`}>
                                        {statusLabel}
                                    </span>
                                </div>
                            </div>

                            {/* Main Metrics - Clean & Large */}
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                {/* Temperature Column */}
                                <div className="flex flex-col">
                                    <div className="flex items-start gap-1">
                                        <span className="text-5xl font-bold tracking-tighter text-[var(--ink)]">
                                            {safeTemp.toFixed(1)}
                                        </span>
                                        <span className="text-lg text-[var(--muted)] font-light mt-1">°C</span>
                                    </div>
                                    <div className="mt-2 flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-0.5 w-8 bg-black/10 rounded-full overflow-hidden">
                                                <div className={`h-full w-1/2 ${f.mode === DeviceMode.KEGERATOR ? 'bg-amber-500' : 'bg-neutral-400'}`}></div>
                                            </div>
                                            <span className="text-xs text-[var(--muted)] font-mono">Alvo: {safeTarget.toFixed(1)}°C</span>
                                        </div>
                                        {/* Sub-metric: Secondary Sensor */}
                                        <div className="flex items-center gap-1.5">
                                            <Thermometer size={12} className="text-black/40" />
                                            <span className="text-xs text-[var(--muted)]">
                                                {(f.mode === DeviceMode.KEGERATOR || f.mode === DeviceMode.FRIDGE) 
                                                    ? `${f.sensor1_name || 'Mosto'}: ${parseFloat(String(f.currentDevice?.temperature || 0)).toFixed(1)}°C`
                                                    : `${f.sensor2_name || 'Geladeira'}: ${safeFridge.toFixed(1)}°C`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="text-right">
                                    {f.mode === DeviceMode.FERMENTER && (
                                        <>
                                            <div className="flex items-start justify-end gap-1">
                                                <span className="text-4xl font-bold tracking-tighter text-[#178a3f] font-mono">
                                                    {safeGravity.toFixed(3)}
                                                </span>
                                                <span className="text-lg text-[var(--muted)] font-light mt-1">SG</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5 mt-2">
                                                <span className="text-xs text-[var(--muted)] block">
                                                    OG: {safeOG.toFixed(3)}
                                                </span>
                                                {safeFG && (
                                                    <span className="text-xs text-[var(--muted)] block">
                                                        FG: {safeFG.toFixed(3)}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                    {(f.mode === DeviceMode.FRIDGE || f.mode === DeviceMode.KEGERATOR) && (
                                        <>
                                            <div className="flex items-start justify-end gap-1">
                                                <span className="text-5xl font-bold tracking-tighter text-[var(--ink)]">
                                                    {safeHumidity !== undefined ? safeHumidity.toFixed(1) : '--'}
                                                </span>
                                                <span className="text-lg text-[var(--muted)] font-light mt-1">%</span>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5 mt-2">
                                                <span className="text-xs text-[var(--muted)] block">
                                                    UMIDADE
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="flex items-center justify-between pt-6 border-t border-black/[0.07] mt-auto">
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5 text-black/40 group-hover:text-[var(--muted)] transition-colors">
                                        <WifiSignal rssi={isOnline ? rawRssi : null} />
                                        <span className="text-xs text-black/35">•</span>
                                        <span className="text-xs font-mono">{f.ipAddress || '--'}</span>
                                    </div>
                                </div>

                                <div className="w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--muted)] group-hover:bg-white group-hover:text-black transition-all duration-300">
                                    <ArrowRight size={14} />
                                </div>
                            </div>

                            {/* Background Decor */}
                        </div>
                        </div>
                    );
                })}
            </div>

            {/* MODAL 1: Edit Existing Device */}
            {
                editingId && (
                    <div role="dialog" aria-modal="true" aria-labelledby="edit-device-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0D12]/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white border border-black/[0.07] p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 id="edit-device-modal-title" className="text-lg font-medium text-[var(--ink)]">Editar Dispositivo</h3>
                                <button aria-label="Fechar modal" onClick={() => setEditingId(null)} className="text-[var(--muted)] hover:text-[var(--ink)]">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="edit-device-name-input" className="text-xs font-bold text-[var(--muted)] ">Nome do Equipamento</label>
                                    <input
                                        id="edit-device-name-input"
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors"
                                    />
                                </div>

                                <button
                                    onClick={handleSaveEdit}
                                    disabled={isSubmitting || !editName.trim()}
                                    className="w-full bg-[var(--ink)] text-white font-medium py-3 rounded-xl mt-4 hover:bg-black disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Save size={18} /> Salvar Alterações
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL 4: Delete Confirmation */}
            {
                deletingId && (
                    <div role="dialog" aria-modal="true" aria-labelledby="delete-device-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0D12]/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white border border-red-200 p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-[#d63a4d] mb-4">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 id="delete-device-modal-title" className="text-xl font-medium text-[var(--ink)] mb-2">Excluir Dispositivo?</h3>
                                <p className="text-[var(--muted)] text-sm mb-6">
                                    Essa ação não pode ser desfeita. Todos os dados e logs deste fermentador serão perdidos permanentemente.
                                </p>

                                <div className="flex w-full gap-3">
                                    <button
                                        onClick={() => setDeletingId(null)}
                                        disabled={isSubmitting}
                                        className="flex-1 bg-[var(--bg)] hover:bg-black/10 disabled:opacity-50 text-[var(--ink)] py-3 rounded-xl font-medium transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        disabled={isSubmitting}
                                        className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                                    >
                                        Sim, Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL 2: Add Manual Device */}
            {
                isAddModalOpen && (
                    <div role="dialog" aria-modal="true" aria-labelledby="add-device-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0D12]/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white border border-black/[0.07] p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 id="add-device-modal-title" className="text-lg font-medium text-[var(--ink)]">Adicionar Manualmente</h3>
                                <button aria-label="Fechar modal" onClick={() => setIsAddModalOpen(false)} className="text-[var(--muted)] hover:text-[var(--ink)]">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="add-device-name-input" className="text-xs font-bold text-[var(--muted)] ">Nome do Equipamento</label>
                                    <input
                                        id="add-device-name-input"
                                        type="text"
                                        value={newDeviceName}
                                        onChange={(e) => setNewDeviceName(e.target.value)}
                                        placeholder="Ex: Fermentador 03"
                                        className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="add-device-serial-input" className="text-xs font-bold text-[var(--muted)] ">Código do Aparelho (Serial / IP)</label>
                                    <input
                                        id="add-device-serial-input"
                                        type="text"
                                        value={newDeviceIp}
                                        onChange={(e) => setNewDeviceIp(e.target.value.toUpperCase())}
                                        placeholder="Código de 12 caracteres (letras e números)"
                                        className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] font-mono text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors"
                                    />
                                    <p className="text-[11px] text-[var(--muted)]">
                                        Digite o código de 12 caracteres da tela "Vincule seu Equipamento" do seu Breww, ou escaneie o QR code dessa mesma tela.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="add-device-confirm-input" className="text-xs font-bold text-[var(--muted)] ">Código de confirmação</label>
                                    <input
                                        id="add-device-confirm-input"
                                        type="text"
                                        value={newDeviceCode}
                                        onChange={(e) => setNewDeviceCode(cleanConfirmCode(e.target.value))}
                                        placeholder="8 caracteres (ex.: 3F9A12C0)"
                                        maxLength={8}
                                        className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] font-mono text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors"
                                    />
                                    <p className="text-[11px] text-[var(--muted)]">
                                        Aparece na mesma tela do aparelho e já vem preenchido pelo QR code. Ele garante que você está vinculando o seu aparelho.
                                    </p>
                                </div>

                                <button
                                    onClick={handleManualAdd}
                                    disabled={isSubmitting || !newDeviceName || !newDeviceIp}
                                    className="w-full bg-[var(--ink)] text-white font-medium py-3 rounded-xl mt-4 hover:bg-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus size={18} /> Adicionar Dispositivo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* MODAL 3: Scan Network */}
            {
                isScanModalOpen && (
                    <div role="dialog" aria-modal="true" aria-labelledby="scan-device-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0D12]/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white border border-black/[0.07] p-6 rounded-2xl w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative">
                            <div className="flex justify-between items-center mb-6">
                                <h3 id="scan-device-modal-title" className="text-lg font-medium text-[var(--ink)]">Procurar na Rede</h3>
                                <button aria-label="Fechar modal" onClick={() => {
                                    setIsScanModalOpen(false);
                                    setDeviceToAddFromScan(null);
                                    setScannedDevices([]);
                                }} className="text-[var(--muted)] hover:text-[var(--ink)]">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Sub-view: Enter Name for Scanned Device */}
                            {deviceToAddFromScan ? (
                                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                                    <div className="bg-[var(--bg)] p-4 rounded-xl border border-black/15 flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-sm text-[var(--ink)] font-medium">{deviceToAddFromScan.type}</p>
                                            <p className="text-xs text-[var(--muted)] font-mono">{deviceToAddFromScan.ip}</p>
                                        </div>
                                        <div className="text-xs text-[#178a3f] font-mono">{deviceToAddFromScan.rssi} dBm</div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-[var(--muted)] ">Nomear Dispositivo</label>
                                        <input
                                            type="text"
                                            value={newDeviceName}
                                            onChange={(e) => setNewDeviceName(e.target.value)}
                                            className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="scan-device-confirm-input" className="text-xs font-bold text-[var(--muted)] ">Código de confirmação</label>
                                        <input
                                            id="scan-device-confirm-input"
                                            type="text"
                                            value={newDeviceCode}
                                            onChange={(e) => setNewDeviceCode(cleanConfirmCode(e.target.value))}
                                            placeholder="8 caracteres, da tela do aparelho"
                                            maxLength={8}
                                            className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] font-mono text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors"
                                        />
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={() => setDeviceToAddFromScan(null)}
                                            className="flex-1 bg-[var(--bg)] text-[#2b2f37] font-medium py-3 rounded-xl hover:bg-black/10 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveScanned}
                                            disabled={!newDeviceName}
                                            className="flex-1 bg-[var(--ink)] text-white font-medium py-3 rounded-xl hover:bg-black transition-colors disabled:opacity-50"
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Sub-view: List Scan Results */
                                <div className="min-h-[250px]">
                                    {isScanning ? (
                                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
                                                <Loader2 size={48} className="text-blue-600 animate-spin relative z-10" />
                                            </div>
                                            <p className="text-[var(--muted)] text-sm animate-pulse">Procurando aparelhos na sua rede...</p>
                                        </div>
                                    ) : scannedDevices.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-xs text-[var(--muted)] mb-2 tracking-wide">Dispositivos Encontrados ({scannedDevices.length})</p>
                                            {scannedDevices.map((device) => (
                                                <div key={device.ip} className="flex items-center justify-between bg-[var(--bg)] hover:bg-[var(--bg)] border border-black/[0.07] hover:border-black/25 p-3 rounded-xl transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[var(--muted)]">
                                                            <Smartphone size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-[#2b2f37] font-medium group-hover:text-[var(--ink)]">{device.type}</p>
                                                            <p className="text-[10px] text-black/40 font-mono">{device.ip}{device.localIp ? ` · ${device.localIp}` : ''}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleSelectScanned(device)}
                                                        className="w-8 h-8 rounded-full bg-[var(--ink)] text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-center">
                                            <Network size={48} className="text-black/30 mb-4" />
                                            <p className="text-[var(--muted)] text-sm">Nenhum aparelho encontrado na sua rede.</p>
                                            <p className="text-black/40 text-xs mt-2 max-w-xs">Seu computador ou celular precisa estar no mesmo Wi-Fi do aparelho. Se não aparecer, adicione pelo código de 12 caracteres da tela do aparelho.</p>
                                            <button onClick={startScan} className="text-blue-600 text-xs mt-2 hover:underline">Tentar novamente</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
            <PairingWaitModal
                pairing={pendingPairing}
                onConfirmed={(serial) => {
                    sendCommand(serial, 'setMode', { value: 1 });
                    refetch();
                }}
                onClose={() => setPendingPairing(null)}
            />
        </div>
    );
};
