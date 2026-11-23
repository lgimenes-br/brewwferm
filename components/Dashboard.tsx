
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Fermenter, FermenterStatus, DeviceMode, ScannedDevice, normalizeGravity, formatGravity, isDeviceOnline as checkDeviceOnline, sensorView, otherSensors, sensorPresence } from '../types';
import { Wifi, WifiOff, ArrowRight, Thermometer, Settings, X, Save, Network, Plus, Search, Loader2, Smartphone, Trash2, AlertTriangle, CheckCircle2, QrCode, Pencil, Droplets } from 'lucide-react';
import { PageHeader, TempDisplay, SmallValue, Chip, formatAgo } from './app/AppUI';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFermenters } from '../hooks/useFermenters';
import { useBrew } from '../context/BrewContext';
import { fetchDiscoveryDevices, AddDeviceResult, fetchFirmwareVersion } from '../services/api';
import { isFirmwareUpdateAvailable } from '../services/firmware';
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
    // Versao mais nova do firmware: cada cartao avisa so do proprio aparelho
    const [latestFw, setLatestFw] = useState<string | null>(null);
    useEffect(() => { fetchFirmwareVersion().then(d => { if (d?.version) setLatestFw(d.version); }).catch(() => {}); }, []);
    
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

    const openDevice = (id: string) => navigate(`/fermenter/${encodeURIComponent(id)}`);
    const searchNetwork = () => { setIsScanModalOpen(true); startScan(); };

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 pt-8 pb-16">
            <PageHeader
                title="Cheers!"
                subtitle={fermenters.length ? `${onlineCount} de ${fermenters.length} ${fermenters.length === 1 ? 'aparelho online' : 'aparelhos online'}` : 'Seus aparelhos aparecem aqui'}
                actions={<>
                    <button type="button" onClick={searchNetwork} className="app-btn-quiet"><Search size={16} aria-hidden /> Buscar na rede</button>
                    <button type="button" onClick={() => setIsAddModalOpen(true)} className="app-btn"><Plus size={16} aria-hidden /> Adicionar aparelho</button>
                </>}
            />

            {fermenters.length === 0 && !isInitialSyncing ? (
                <section className="app-card p-6 sm:p-8 max-w-3xl" aria-labelledby="empty-title">
                    <h2 id="empty-title" className="text-[22px] font-normal text-[var(--ink)]">Nenhum aparelho ainda</h2>
                    <p className="mt-2 text-[16px] text-[var(--muted)] max-w-xl">
                        Ligue o controlador e vincule à sua conta. Ele começa no modo Geladeira, a 4,0 °C, até você escolher outro modo.
                    </p>
                    <ol className="mt-6 flex flex-col gap-2">
                        {[
                            { icon: <CheckCircle2 size={18} />, title: 'Conta pronta', text: 'Sua conta já pode receber aparelhos.' },
                            { icon: <Wifi size={18} />, title: 'Wi-Fi do aparelho', text: 'Na tela do controlador (ou no assistente de instalação), conecte ao seu Wi-Fi.' },
                            { icon: <QrCode size={18} />, title: 'Vincular', text: 'Digite o código de 12 caracteres que aparece no aparelho, ou busque na mesma rede.' },
                        ].map(step => (
                            <li key={step.title} className="flex items-center gap-4 rounded-[22px] bg-[var(--cell-2)] px-4 py-3.5">
                                <span className="app-icon-btn text-[var(--accent)] shrink-0" aria-hidden>{step.icon}</span>
                                <span className="min-w-0">
                                    <span className="block text-[16px] text-[var(--ink)]">{step.title}</span>
                                    <span className="block text-[14px] text-[var(--muted)]">{step.text}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    <div className="mt-6 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setIsAddModalOpen(true)} className="app-btn"><Plus size={16} aria-hidden /> Digitar o código</button>
                        <button type="button" onClick={searchNetwork} className="app-btn-quiet"><Search size={16} aria-hidden /> Buscar no mesmo Wi-Fi</button>
                    </div>
                </section>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                {fermenters.map((f) => {
                    const isOnline = isDeviceOnline(f);
                    const isFermenter = f.mode === DeviceMode.FERMENTER;
                    const num = (v: unknown) => { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : undefined; };

                    // Temperatura grande: o sensor que controla o modo; os outros so para ver
                    const sv = sensorView(f);
                    const mainTemp = sv.temps[sv.control];
                    const others = otherSensors(sv);
                    const target = num(f.targetTemp);
                    const lastChartGravity = f.readings && f.readings.length > 0 ? f.readings[f.readings.length - 1].gravity : 0;
                    const gravity = normalizeGravity(f.currentDevice?.gravity > 0 ? f.currentDevice.gravity : lastChartGravity, 0);
                    const humidity = num(f.currentDevice?.extSens?.hum);
                    const has = sensorPresence(f); // umidade e densidade so de quem tem o sensor
                    const rssi = f.currentDevice?.rssi || 0;

                    const isCorrupted = isOnline && isInitialSyncing && !f.currentDevice?.rssi && f.currentDevice?.temperature === 0 && (f.currentFridgeTemp === 20 || f.currentFridgeTemp === 0) && !f.currentDevice?.extSens?.hum;
                    const connecting = (!isOnline && isInitialSyncing) || isCorrupted;
                    // Sem conexao, 0,0 exato e "nunca leu", nao 0 °C: mostra "--" como o app
                    const shown = (v?: number) => (connecting || (!isOnline && v === 0) ? undefined : v);

                    const statOp = String(f.currentDevice?.statOp || '').toUpperCase();
                    const stateWord = statOp === 'AQUECENDO' ? 'Aquecendo' : statOp === 'RESFRIANDO' ? 'Resfriando'
                        : statOp.startsWith('DELAY') || statOp === 'AGUARDANDO' ? 'Aguardando' : 'Parado';
                    const step = isFermenter && f.status !== FermenterStatus.IDLE && f.profile ? f.profile[f.currentStepIndex] : undefined;
                    const kegName = f.kegeratorConfig?.line1 || f.chopp_name || '';
                    // O que o aparelho esta fazendo, em linguagem de gente (offline nao usa verbo)
                    const activity = isFermenter
                        ? (f.beerName && f.status !== FermenterStatus.IDLE
                            ? `${isOnline ? 'Fermentando' : 'Lote'} ${f.beerName}${step ? ` · ${step.name}` : ''}`
                            : 'Fermentador · sem lote ativo')
                        : f.mode === DeviceMode.KEGERATOR
                            ? (kegName ? `${isOnline ? 'Servindo' : 'Choppeira ·'} ${kegName}` : 'Choppeira')
                            : 'Geladeira';
                    const weakWifi = isOnline && rssi !== 0 && rssi < -75;

                    return (
                        <article
                            key={f.id}
                            role={isOnline ? 'button' : undefined}
                            tabIndex={isOnline ? 0 : undefined}
                            aria-label={`${f.name}, ${isOnline ? 'online' : 'offline'}, ${shown(mainTemp) === undefined ? 'sem leitura' : `${mainTemp!.toFixed(1)} graus`}${isOnline ? '. Abrir o aparelho' : ''}`}
                            onClick={() => isOnline && openDevice(f.id)}
                            onKeyDown={(e) => { if (isOnline && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDevice(f.id); } }}
                            className={`app-card p-5 sm:p-6 flex flex-col gap-5 transition-[background-color,border-color,transform] duration-200 ${isOnline ? 'cursor-pointer hover:bg-[#1C212B] hover:border-[var(--line-strong)] active:scale-[0.99]' : ''}`}
                        >
                            {/* Nome, o que esta fazendo e acoes */}
                            <div className="flex items-start gap-3" style={{ opacity: isOnline ? 1 : 0.5 }}>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-[19px] font-medium text-[var(--ink)] truncate">{f.name}</h2>
                                    <p className="text-[14px] text-[var(--muted)] truncate" title={activity}>{activity}</p>
                                </div>
                                <button type="button" onClick={(e) => handleEditClick(e, f)} aria-label={`Editar ${f.name}`} title="Editar" className="app-icon-btn !w-9 !h-9 text-[var(--muted)]">
                                    <Pencil size={14} aria-hidden />
                                </button>
                                <button type="button" onClick={(e) => handleDeleteClick(e, f.id)} aria-label={`Excluir ${f.name}`} title="Excluir" className="app-icon-btn !w-9 !h-9 text-[var(--muted)] hover:!text-[var(--danger)]">
                                    <Trash2 size={14} aria-hidden />
                                </button>
                            </div>

                            {/* Leitura principal */}
                            <div className="flex items-end justify-between gap-4" style={{ opacity: isOnline ? 1 : 0.5 }}>
                                <TempDisplay value={shown(mainTemp)} size={64} />
                                <div className="flex gap-5 pb-2">
                                    {isFermenter ? (has.gravity && (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-[12px] text-[var(--muted)]">Densidade</span>
                                            <SmallValue value={formatGravity(gravity)} />
                                        </div>
                                    )) : (has.humidity && (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-[12px] text-[var(--muted)]">Umidade</span>
                                            <SmallValue value={humidity !== undefined ? String(Math.round(humidity)) : '--'} unit="%" />
                                        </div>
                                    ))}
                                    <div className="flex flex-col items-end gap-0.5">
                                        <span className="text-[12px] text-[var(--muted)]">Alvo</span>
                                        <SmallValue value={target !== undefined ? target.toFixed(1) : '--'} unit="°C" />
                                    </div>
                                </div>
                            </div>

                            {/* Chips: estado, outro sensor, umidade, alertas (quebram de linha; sem rolagem) */}
                            <div className="flex flex-wrap gap-2" style={{ opacity: isOnline ? 1 : 0.5 }}>
                                {connecting ? (
                                    <Chip icon={<Loader2 size={14} className="animate-spin" />}>Conectando…</Chip>
                                ) : isOnline ? (
                                    <Chip dot="on">{stateWord}</Chip>
                                ) : (
                                    <Chip dot="off">Offline · {formatAgo(f.lastSeen)}</Chip>
                                )}
                                {others.filter(o => shown(o.temp) !== undefined).map(o => (
                                    <Chip key={o.slot} icon={<Thermometer size={14} />} title={o.name}>{o.temp.toFixed(1)}°C</Chip>
                                ))}
                                {isFermenter && humidity !== undefined && <Chip icon={<Droplets size={14} />} title="Umidade">{Math.round(humidity)}%</Chip>}
                                {weakWifi && <Chip dot="warn">Wi-Fi fraco</Chip>}
                                {latestFw && isFirmwareUpdateAvailable(latestFw, f.currentDevice?.version) && <Chip dot="on" title="Abra o aparelho para atualizar">Firmware {latestFw}</Chip>}
                            </div>
                        </article>
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
                                    <label htmlFor="edit-device-name-input" className="text-xs font-medium text-[var(--muted)] ">Nome do Equipamento</label>
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
                                    <label htmlFor="add-device-name-input" className="text-xs font-medium text-[var(--muted)] ">Nome do Equipamento</label>
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
                                    <label htmlFor="add-device-serial-input" className="text-xs font-medium text-[var(--muted)] ">Código do Aparelho (Serial / IP)</label>
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
                                    <label htmlFor="add-device-confirm-input" className="text-xs font-medium text-[var(--muted)] ">Código de confirmação</label>
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
                                        <label className="text-xs font-medium text-[var(--muted)] ">Nomear Dispositivo</label>
                                        <input
                                            type="text"
                                            value={newDeviceName}
                                            onChange={(e) => setNewDeviceName(e.target.value)}
                                            className="w-full bg-[var(--bg)] border border-black/[0.07] text-[var(--ink)] rounded-xl px-4 py-3 focus:outline-none focus:border-black/25 transition-colors"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="scan-device-confirm-input" className="text-xs font-medium text-[var(--muted)] ">Código de confirmação</label>
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
                                                            <p className="text-[12px] text-black/40 font-mono">{device.ip}{device.localIp ? ` · ${device.localIp}` : ''}</p>
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
