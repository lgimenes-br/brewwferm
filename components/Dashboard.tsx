
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Fermenter, FermenterStatus, DeviceMode, ScannedDevice } from '../types';
import { Wifi, ArrowRight, Thermometer, Settings, X, Save, Network, Plus, Search, Loader2, Smartphone, Trash2, AlertTriangle } from 'lucide-react';
import { MOCK_SCANNED_DEVICES } from '../services/mockData';

import { useNavigate } from 'react-router-dom';
import { useFermenters } from '../hooks/useFermenters';
import { ENV } from '../config/envs';

export const Dashboard: React.FC = () => {
    const { fermenters, addDevice, deleteDevice } = useFermenters();
    const navigate = useNavigate();
    // Edit States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editIp, setEditIp] = useState('');

    // Delete State
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Add Manual States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newDeviceName, setNewDeviceName] = useState('');
    const [newDeviceIp, setNewDeviceIp] = useState('');

    // Scan States
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
    const [deviceToAddFromScan, setDeviceToAddFromScan] = useState<ScannedDevice | null>(null);

    // Edit Handlers (Update needs to be handled via API now, but dashboard only updates Name/IP)
    // To keep it simple, we'll wait for the FermenterDetail refactor or create a specific update hook
    const handleEditClick = (e: React.MouseEvent, fermenter: Fermenter) => {
        e.stopPropagation(); // Prevent opening the detail view
        setEditingId(fermenter.id);
        setEditName(fermenter.name);
        setEditIp(fermenter.ipAddress || '');
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
    };

    const confirmDelete = async () => {
        if (deletingId) {
            try {
                await deleteDevice(deletingId);
                toast.success('Dispositivo removido com sucesso!');
            } catch (err) {
                toast.error('Erro ao remover dispositivo.');
            }
            setDeletingId(null);
        }
    };

    const handleSaveEdit = async () => {
        if (editingId) {
            // Note: In real app we need updateDevice method in API. 
            // For now just close the modal. We'll add updateDevice later if needed.
            setEditingId(null);
        }
    };

    // Add Manual Handlers
    const handleManualAdd = async () => {
        if (newDeviceName && newDeviceIp) {
            try {
                await addDevice({
                    name: newDeviceName,
                    serialCode: newDeviceIp
                });
                toast.success('Dispositivo adicionado com sucesso!');
                setIsAddModalOpen(false);
                setNewDeviceName('');
                setNewDeviceIp('');
            } catch (err) {
                toast.error('Erro ao adicionar dispositivo.');
            }
        }
    };

    // Scan Handlers
    const startScan = async () => {
        setIsScanning(true);
        setScannedDevices([]);

        try {
            const token = localStorage.getItem('token');
            const API_BASE = ENV.API_URL;

            // Try to fetch real devices first
            const res = await fetch(`${API_BASE}/api/discovery`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const devs = await res.json();
                setScannedDevices(devs);
            } else {
                console.error("Discovery failed:", res.status, res.statusText);
                // If 401, maybe redirect to login? For now just alert or empty.
                if (res.status === 401) {
                    alert("Você precisa estar logado para buscar dispositivos.");
                }
            }
        } catch (e) {
            console.error("Scan error", e);
            // No fallback to mocks anymore
        } finally {
            setIsScanning(false);
        }
    };

    const handleSelectScanned = (device: ScannedDevice) => {
        setDeviceToAddFromScan(device);
        setNewDeviceName(`Novo ${device.type}`); // Default Name
    };

    const handleSaveScanned = async () => {
        if (deviceToAddFromScan && newDeviceName) {
            try {
                await addDevice({
                    name: newDeviceName,
                    serialCode: deviceToAddFromScan.ip
                });
                toast.success('Dispositivo adicionado com sucesso!');
                setIsScanModalOpen(false);
                setDeviceToAddFromScan(null);
                setScannedDevices([]);
            } catch (err) {
                toast.error('Erro ao adicionar dispositivo.');
            }
        }
    };

    return (
        <div className="p-6 md:px-10 w-full mx-auto animate-in fade-in duration-500">
            <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-light tracking-tight text-white mb-2">Dispositivos</h1>
                    <p className="text-neutral-500 font-light">Gerenciamento de equipamentos e conexões</p>
                </div>
                <div className="flex flex-col md:items-end gap-2">
                    <div className="text-xs text-neutral-600 font-mono mb-1">
                        {fermenters.length} UNIDADES CONECTADAS
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setIsScanModalOpen(true);
                                startScan();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-all border border-neutral-700"
                        >
                            <Search size={14} /> Procurar
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-white text-black rounded-lg text-xs font-bold uppercase tracking-wide transition-all"
                        >
                            <Plus size={14} /> Adicionar
                        </button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fermenters.map((f) => {
                    // Check connectivity
                    const lastUpdate = f.currentDevice?.lastUpdate ? new Date(f.currentDevice.lastUpdate).getTime() : 0;
                    const now = new Date().getTime();
                    const isOnline = !isNaN(lastUpdate) && (now - lastUpdate) < 30 * 60 * 1000;

                    // Lógica dinâmica de Status/Modo/Badge
                    let statusLabel = 'Inativo';
                    let dotColor = "bg-neutral-500";
                    let textColor = "text-neutral-400";
                    let containerClass = "bg-neutral-800/50 border-neutral-800";

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
                                textColor = "text-blue-400";
                                containerClass = "bg-blue-950/10 border-blue-900/30";
                            } else {
                                dotColor = "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
                                textColor = "text-green-400";
                                containerClass = "bg-green-950/10 border-green-900/30";
                            }
                        }
                    } else if (f.mode === DeviceMode.KEGERATOR) {
                        statusLabel = "Choppeira";
                        dotColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
                        textColor = "text-amber-400";
                        containerClass = "bg-amber-950/10 border-amber-900/30";
                    } else if (f.mode === DeviceMode.FRIDGE) {
                        statusLabel = "Geladeira";
                        dotColor = "bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]";
                        textColor = "text-blue-300";
                        containerClass = "bg-blue-950/10 border-blue-800/30";
                    }

                    // Safe Parsing of Numbers to avoid toFixed errors on Strings
                    const safeTemp = parseFloat(String(f.currentDevice?.temperature || 0));
                    const safeTarget = parseFloat(String(f.targetTemp || 0));
                    const safeFridge = parseFloat(String(f.currentFridgeTemp || 0));
                    const safeGravity = parseFloat(String(f.currentDevice?.gravity || 0));
                    const safeOG = parseFloat(String(f.og || 0));
                    const safeRSSI = f.currentDevice?.rssi || 0;


                    return (
                        <div
                            key={f.id}
                            onClick={() => navigate(`/fermenter/${f.id}`)}
                            className="group relative bg-neutral-900/40 hover:bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 rounded-3xl p-8 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 overflow-hidden"
                        >
                            {/* Header Section: Name & ID & Actions */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="block text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                        {f.name}
                                    </span>
                                    <span className="block text-[10px] font-mono text-neutral-600 mt-1">
                                        {f.id}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Online/Offline Dot */}
                                    <div
                                        title={isOnline ? "Online" : "Offline"}
                                        className={`w-2 h-2 rounded-full transition-all duration-500 ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500/50 border border-red-900'}`}
                                    />

                                    <div className="flex items-center bg-neutral-800/50 rounded-lg p-1 border border-neutral-700/50">
                                        <button
                                            onClick={(e) => handleDeleteClick(e, f.id)}
                                            className="text-neutral-500 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-md transition-all"
                                            title="Excluir Dispositivo"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="w-px h-3 bg-neutral-700/50 mx-1"></div>
                                        <button
                                            onClick={(e) => handleEditClick(e, f)}
                                            className="text-neutral-500 hover:text-white hover:bg-neutral-700 p-1.5 rounded-md transition-all"
                                            title="Configurações"
                                        >
                                            <Settings size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-8">
                                {/* Beer Name */}
                                <h2 className="text-2xl font-bold text-white group-hover:text-white transition-colors truncate mb-3 tracking-tight">
                                    {f.beerName || (f.mode === DeviceMode.KEGERATOR ? 'Barril de Chopp' : 'Vazio')}
                                </h2>

                                {/* Smart Status Badge: Reflete o modo e a rampa atual */}
                                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${containerClass} backdrop-blur-sm transition-all max-w-full`}>
                                    <span className={`w-2 h-2 shrink-0 rounded-full ${dotColor} animate-pulse`}></span>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${textColor} truncate`}>
                                        {statusLabel}
                                    </span>
                                </div>
                            </div>

                            {/* Main Metrics - Clean & Large */}
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                {/* Temperature Column */}
                                <div className="flex flex-col">
                                    <div className="flex items-start gap-1">
                                        <span className="text-5xl font-light tracking-tighter text-white">
                                            {safeTemp.toFixed(1)}
                                        </span>
                                        <span className="text-lg text-neutral-500 font-light mt-1">°C</span>
                                    </div>
                                    <div className="mt-2 flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-0.5 w-8 bg-neutral-700 rounded-full overflow-hidden">
                                                <div className={`h-full w-1/2 ${f.mode === DeviceMode.KEGERATOR ? 'bg-amber-500' : 'bg-neutral-400'}`}></div>
                                            </div>
                                            <span className="text-xs text-neutral-500 font-mono">Alvo: {safeTarget.toFixed(1)}°</span>
                                        </div>
                                        {/* Sub-metric: Fridge */}
                                        <div className="flex items-center gap-1.5">
                                            <Thermometer size={12} className="text-neutral-600" />
                                            <span className="text-xs text-neutral-500">Geladeira: {safeFridge.toFixed(1)}°</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Gravity Column: Mostrar apenas se for fermentador */}
                                <div className="text-right">
                                    {f.mode === DeviceMode.FERMENTER ? (
                                        <>
                                            <div className="flex items-start justify-end gap-1">
                                                <span className="text-4xl font-light tracking-tighter text-purple-200">
                                                    {safeGravity.toFixed(3)}
                                                </span>
                                                <span className="text-lg text-neutral-500 font-light mt-1">SG</span>
                                            </div>
                                            <span className="text-xs text-neutral-500 uppercase tracking-wider block mt-2">
                                                OG: {safeOG.toFixed(3)}
                                            </span>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-end justify-center h-full opacity-30">
                                            <div className="text-2xl font-light text-neutral-600 uppercase tracking-tighter">N/A</div>
                                            <span className="text-[10px] text-neutral-700 font-bold uppercase tracking-widest">GRAVIDADE</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="flex items-center justify-between pt-6 border-t border-neutral-800/50 mt-auto">
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5 text-neutral-600 group-hover:text-neutral-400 transition-colors" title="Sinal Wifi">
                                        <Wifi size={14} />
                                        <span className="text-xs font-mono">{safeRSSI}</span>
                                        <span className="text-xs text-neutral-700">•</span>
                                        <span className="text-xs font-mono">{f.ipAddress || '--'}</span>
                                    </div>
                                </div>

                                <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 group-hover:bg-white group-hover:text-black transition-all duration-300">
                                    <ArrowRight size={14} />
                                </div>
                            </div>

                            {/* Background Decor */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-neutral-800/10 to-transparent rounded-bl-full pointer-events-none"></div>
                        </div>
                    );
                })}
            </div>

            {/* MODAL 1: Edit Existing Device */}
            {
                editingId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-medium text-white">Editar Dispositivo</h3>
                                <button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nome do Equipamento</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">IP / Serial</label>
                                    <input
                                        type="text"
                                        value={editIp}
                                        onChange={(e) => setEditIp(e.target.value)}
                                        className="w-full bg-black border border-neutral-800 text-white font-mono text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors"
                                        placeholder="192.168.x.x"
                                    />
                                </div>

                                <button
                                    onClick={handleSaveEdit}
                                    className="w-full bg-white text-black font-medium py-3 rounded-xl mt-4 hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-neutral-900 border border-red-900/50 p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-xl font-medium text-white mb-2">Excluir Dispositivo?</h3>
                                <p className="text-neutral-400 text-sm mb-6">
                                    Essa ação não pode ser desfeita. Todos os dados e logs deste fermentador serão perdidos permanentemente.
                                </p>

                                <div className="flex w-full gap-3">
                                    <button
                                        onClick={() => setDeletingId(null)}
                                        className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white py-3 rounded-xl font-medium transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-medium transition-colors shadow-[0_0_15px_rgba(220,38,38,0.4)]"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-medium text-white">Adicionar Manualmente</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-neutral-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nome do Equipamento</label>
                                    <input
                                        type="text"
                                        value={newDeviceName}
                                        onChange={(e) => setNewDeviceName(e.target.value)}
                                        placeholder="Ex: Fermentador 03"
                                        className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">IP / Serial</label>
                                    <input
                                        type="text"
                                        value={newDeviceIp}
                                        onChange={(e) => setNewDeviceIp(e.target.value)}
                                        placeholder="Ex: 192.168.1.50 ou SERIAL_123"
                                        className="w-full bg-black border border-neutral-800 text-white font-mono text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors"
                                    />
                                </div>

                                <button
                                    onClick={handleManualAdd}
                                    disabled={!newDeviceName || !newDeviceIp}
                                    className="w-full bg-white text-black font-medium py-3 rounded-xl mt-4 hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl w-full max-w-md shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-medium text-white">Procurar na Rede</h3>
                                <button onClick={() => {
                                    setIsScanModalOpen(false);
                                    setDeviceToAddFromScan(null);
                                    setScannedDevices([]);
                                }} className="text-neutral-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Sub-view: Enter Name for Scanned Device */}
                            {deviceToAddFromScan ? (
                                <div className="space-y-4 animate-in slide-in-from-right duration-300">
                                    <div className="bg-neutral-800/50 p-4 rounded-xl border border-neutral-700 flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-sm text-white font-medium">{deviceToAddFromScan.type}</p>
                                            <p className="text-xs text-neutral-500 font-mono">{deviceToAddFromScan.ip}</p>
                                        </div>
                                        <div className="text-xs text-green-500 font-mono">{deviceToAddFromScan.rssi} dBm</div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nomear Dispositivo</label>
                                        <input
                                            type="text"
                                            value={newDeviceName}
                                            onChange={(e) => setNewDeviceName(e.target.value)}
                                            className="w-full bg-black border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="flex gap-2 mt-4">
                                        <button
                                            onClick={() => setDeviceToAddFromScan(null)}
                                            className="flex-1 bg-neutral-800 text-neutral-300 font-medium py-3 rounded-xl hover:bg-neutral-700 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleSaveScanned}
                                            disabled={!newDeviceName}
                                            className="flex-1 bg-white text-black font-medium py-3 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50"
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
                                                <Loader2 size={48} className="text-blue-500 animate-spin relative z-10" />
                                            </div>
                                            <p className="text-neutral-400 text-sm animate-pulse">Escaneando rede local...</p>
                                        </div>
                                    ) : scannedDevices.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-xs text-neutral-500 mb-2 uppercase tracking-wide">Dispositivos Encontrados ({scannedDevices.length})</p>
                                            {scannedDevices.map((device) => (
                                                <div key={device.ip} className="flex items-center justify-between bg-neutral-800/30 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600 p-3 rounded-xl transition-all group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-500">
                                                            <Smartphone size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-neutral-200 font-medium group-hover:text-white">{device.type}</p>
                                                            <p className="text-[10px] text-neutral-600 font-mono">{device.ip}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleSelectScanned(device)}
                                                        className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-center">
                                            <Network size={48} className="text-neutral-800 mb-4" />
                                            <p className="text-neutral-500 text-sm">Nenhum dispositivo encontrado.</p>
                                            <button onClick={startScan} className="text-blue-500 text-xs mt-2 hover:underline">Tentar novamente</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div>
    );
};
