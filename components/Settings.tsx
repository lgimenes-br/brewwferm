import React, { useState, useEffect } from 'react';
import { Save, Power, Activity, Thermometer, RotateCcw, Download, Trash2, Cpu, Zap, Sliders, ChevronDown, Bell } from 'lucide-react';
import { useFermenters } from '../hooks/useFermenters';
import { useBrew } from '../context/BrewContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { toast } from 'react-hot-toast';

interface PIDParams {
  kp: number;
  ki: number;
  kd: number;
}

interface SystemSettings {
  logInterval: number;
  compressorDelay: number;
  chartPoints: number;
  sensor1Name: string;
  sensor2Name: string;
  offsetS1: number;
  offsetS2: number;
  offsetSG: number;
  pidHeating: PIDParams;
  pidCooling: PIDParams;
  pwmWindowHeat: number;
}

export const Settings: React.FC = () => {
  const { fermenters } = useFermenters();
  const { sendCommand } = useBrew();
  const { token } = useAuth();
  
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  // Set default device
  useEffect(() => {
    if (fermenters.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(fermenters[0].id);
    }
  }, [fermenters]);

  const activeDevice = fermenters.find(f => f.id === selectedDeviceId);

  const [settings, setSettings] = useState<SystemSettings>({
    logInterval: 30,
    compressorDelay: 310,
    chartPoints: parseInt(localStorage.getItem('breww_chartPoints') || '50', 10),
    sensor1Name: 'Fermentador',
    sensor2Name: 'Geladeira',
    offsetS1: 0,
    offsetS2: 0,
    offsetSG: 0,
    pidHeating: { kp: 20000, ki: 100, kd: 0 },
    pidCooling: { kp: 40000, ki: 200, kd: 0 },
    pwmWindowHeat: 2000
  });

  // Sync settings when selecting a device or when telemetry arrives
  useEffect(() => {
    if (activeDevice?.currentDevice) {
        setSettings(prev => ({
            ...prev,
            logInterval: activeDevice.currentDevice.logInterval || prev.logInterval,
            compressorDelay: activeDevice.currentDevice.compressorDelay || prev.compressorDelay
            // Note: add S1/S2 offset mapping here later if needed
        }));
    }
  }, [selectedDeviceId, activeDevice?.currentDevice?.logInterval, activeDevice?.currentDevice?.compressorDelay]);

  const [relayState, setRelayState] = useState<'AUTO' | 'HEAT' | 'COOL'>('AUTO');
  
  const [otaUrl, setOtaUrl] = useState<string>('http://breww.live/firmware/update.bin');
  const [otaMd5, setOtaMd5] = useState<string>('');
  const [latestFirmware, setLatestFirmware] = useState<{version: string, md5?: string, url?: string} | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
      const checkSubscription = async () => {
          try {
              if (Notification.permission === 'granted') {
                  const registration = await navigator.serviceWorker.ready;
                  const subscription = await registration.pushManager.getSubscription();
                  if (subscription) setIsSubscribed(true);
              }
          } catch (e) {
              console.error(e);
          }
      };
      checkSubscription();
  }, []);

  // Fetch latest firmware version from backend
  useEffect(() => {
      const fetchFirmwareVersion = async () => {
          try {
              const baseUrl = window.location.origin;
              const res = await fetch(`${baseUrl}/firmware/version.json?t=${new Date().getTime()}`);
              if (res.ok) {
                  const data = await res.json();
                  setLatestFirmware(data);
              }
          } catch (e) {
              console.error('Erro ao buscar versão do firmware:', e);
          }
      };
      fetchFirmwareVersion();
  }, []);

  const handleChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePIDChange = (type: 'pidHeating' | 'pidCooling', param: keyof PIDParams, value: number) => {
    setSettings(prev => ({
      ...prev,
      [type]: { ...prev[type], [param]: value }
    }));
  };

  const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 mb-6 border-b border-neutral-800 pb-2">
      <Icon size={18} className="text-neutral-400" />
      <h3 className="text-white font-bold text-sm uppercase tracking-widest">{title}</h3>
    </div>
  );

  const InputField = ({ label, value, onChange, type = "text", placeholder = "" }: any) => (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black border border-neutral-800 text-neutral-200 rounded-xl px-4 py-3 focus:outline-none focus:border-neutral-600 transition-colors font-mono text-sm"
      />
    </div>
  );

  const handleSaveGeneral = () => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    
    // Send MQTT configs
    sendCommand(selectedDeviceId, 'setConfig', { field: 'webinterval', val: parseFloat(String(settings.logInterval)) });
    setTimeout(() => {
        sendCommand(selectedDeviceId, 'setConfig', { field: 'compressordelay', val: parseFloat(String(settings.compressorDelay)) });
    }, 200);

    // Save chart limit locally
    localStorage.setItem('breww_chartPoints', String(settings.chartPoints));
    
    toast.success('Configurações Gerais enviadas!');
  };

  const handleSaveSensorNames = () => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    sendCommand(selectedDeviceId, 'setNames', { field: 's1n', val: settings.sensor1Name });
    setTimeout(() => { 
        sendCommand(selectedDeviceId, 'setNames', { field: 's2n', val: settings.sensor2Name }); 
    }, 200);
    toast.success('Nomes dos sensores atualizados!');
  };

  const handleSaveCalibration = () => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    sendCommand(selectedDeviceId, 'setCalibration', { 
        off_t1: parseFloat(String(settings.offsetS1)), 
        off_t2: parseFloat(String(settings.offsetS2)), 
        off_sg: parseFloat(String(settings.offsetSG)) 
    });
    toast.success('Calibração enviada ao equipamento!');
  };

  const handleUpdatePID = () => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    const commands = [
        { type: 'Kp_h', val: parseFloat(String(settings.pidHeating.kp)) }, 
        { type: 'Ki_h', val: parseFloat(String(settings.pidHeating.ki)) }, 
        { type: 'Kd_h', val: parseFloat(String(settings.pidHeating.kd)) },
        { type: 'Kp_c', val: parseFloat(String(settings.pidCooling.kp)) }, 
        { type: 'Ki_c', val: parseFloat(String(settings.pidCooling.ki)) }, 
        { type: 'Kd_c', val: parseFloat(String(settings.pidCooling.kd)) }
    ];
    
    const promise = new Promise<void>((resolve) => {
        commands.forEach((cmd, index) => { 
            setTimeout(() => { 
                sendCommand(selectedDeviceId, cmd.type, { val: cmd.val }); 
                if (index === commands.length - 1) resolve();
            }, index * 150); 
        });
    });

    toast.promise(promise, {
        loading: 'Enviando parâmetros PID...',
        success: 'PID atualizado com sucesso!',
        error: 'Erro ao enviar PID',
    });
  };

  const handleStartAutotune = (mode: 'heat' | 'cool') => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    sendCommand(selectedDeviceId, 'autotune', { mode });
    toast.success(`Auto-Tune de ${mode === 'heat' ? 'aquecimento' : 'refrigeração'} iniciado!`);
  };

  const handleTestRelay = (mode: number, autoState: 'AUTO' | 'HEAT' | 'COOL') => { 
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    setRelayState(autoState);
    sendCommand(selectedDeviceId, 'forceRelay', { value: mode }); 
    if(mode === 0) toast.success('Modo Automático ativado');
    if(mode === 1) toast.success('Aquecimento forçado LIGADO');
    if(mode === 2) toast.success('Refrigeração forçada LIGADA');
  };

  const handleTriggerOTA = () => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    if (!otaUrl || otaUrl.length < 10) return toast.error('Insira uma URL válida para o firmware.');
    
    if (confirm('ATENÇÃO: O ESP32 será reiniciado e iniciará o download do novo firmware. Certifique-se que o arquivo existe na URL especificada. Continuar?')) {
        sendCommand(selectedDeviceId, 'update_firmware', { url: otaUrl, md5: otaMd5 });
        toast.success('Comando de Atualização OTA enviado! O painel da placa exibirá o progresso.');
    }
  };

  const handleClearLogs = async () => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    if (!confirm('Isso apagará TODO o histórico do banco de dados para este dispositivo. Continuar?')) return;
    
    const loadingId = toast.loading('Limpando banco de dados...');
    try {
        const res = await fetch(`${API_URL}/history/${selectedDeviceId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            sendCommand(selectedDeviceId, 'cmd', { action: 'clearchart' });
            toast.success('Histórico limpo com sucesso!', { id: loadingId });
        } else {
            toast.error('Erro ao limpar histórico no servidor.', { id: loadingId });
        }
    } catch (e) { 
        toast.error('Erro de conexão.', { id: loadingId }); 
    }
  };

  const handleDownloadLogs = async () => {
    if (!selectedDeviceId) return toast.error('Selecione um controlador primeiro.');
    const loadingId = toast.loading('Gerando CSV...');
    try {
        const res = await fetch(`${API_URL}/export/${selectedDeviceId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            let filename = `${activeDevice?.name || 'log'}.csv`;
            const disposition = res.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const match = disposition.split('filename=')[1];
                if (match) filename = match.replace(/"/g, '');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success('Download iniciado!', { id: loadingId });
        } else { 
            toast.error('Erro ao baixar. Talvez não haja dados ativos.', { id: loadingId }); 
        }
    } catch (e) { 
        toast.error('Erro de conexão.', { id: loadingId }); 
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  };

  const handleSubscribePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return toast.error('Permissão para notificações negada.');
      
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BL4hVT-vi0XvI2r0Lm91LlaxwNtrqf7gK56y4EjjckSURXsBxSj8EqqyoqZiZggjVLP7o2EhGnEk4ihB7A0VkFs';
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });
      }

      const res = await fetch(`${API_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(subscription)
      });
      
      if (res.ok) {
        toast.success('Notificações ativadas com sucesso!');
        setIsSubscribed(true);
      }
      else toast.error('Erro ao salvar no servidor.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao assinar notificações.');
    }
  };

  return (
    <div className="p-6 md:px-10 w-full mx-auto animate-in fade-in duration-500 space-y-8 pb-20">
      
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h1 className="text-4xl font-light tracking-tight text-white mb-2">Configurações</h1>
           <p className="text-neutral-500 font-light">Parâmetros do controlador ESP32 e calibração de sensores.</p>
        </div>
        
        {/* Device Selector */}
        <div className="relative min-w-[250px]">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Cpu size={16} className="text-neutral-400" />
            </div>
            <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-700 transition-all appearance-none cursor-pointer text-sm font-bold tracking-wider"
            >
                {fermenters.length === 0 ? (
                    <option value="" disabled>Nenhum controlador</option>
                ) : (
                    fermenters.map(f => (
                        <option key={f.id} value={f.id}>
                            {f.name} ({f.id})
                        </option>
                    ))
                )}
            </select>
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <ChevronDown size={16} className="text-neutral-400" />
            </div>
        </div>
      </header>

      {/* 0. Notificações */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Bell} title="Notificações no Celular" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
                <p className="text-neutral-300 text-sm mb-1">Receba alertas de temperatura, fim de rampa e quedas de energia (offline) diretamente no seu dispositivo.</p>
                <p className="text-neutral-500 text-xs">Requer permissão do navegador. Funciona nativamente no iOS (adicionado à tela inicial) e Android.</p>
            </div>
            <button 
                onClick={handleSubscribePush}
                disabled={isSubscribed}
                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 border whitespace-nowrap ${
                    isSubscribed 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/50 cursor-not-allowed' 
                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/50'
                }`}
            >
                <Bell size={14} /> {isSubscribed ? 'Alertas Ativos' : 'Ativar Alertas'}
            </button>
        </div>
      </section>

      {/* 1. Configurações Gerais */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Sliders} title="Configurações Gerais" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField 
            label="Intervalo Log ESP32 (s)" 
            value={settings.logInterval} 
            onChange={(v: number) => handleChange('logInterval', v)} 
            type="number" 
          />
          <InputField 
            label="Delay Compressor (s)" 
            value={settings.compressorDelay} 
            onChange={(v: number) => handleChange('compressorDelay', v)} 
            type="number" 
          />
          <div className="space-y-2">
             <InputField 
              label="Pontos no Gráfico (Zoom)" 
              value={settings.chartPoints} 
              onChange={(v: number) => handleChange('chartPoints', v)} 
              type="number" 
            />
            <p className="text-[10px] text-neutral-600">Define quantos pontos históricos aparecem.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleSaveGeneral}
            disabled={!selectedDeviceId}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${!selectedDeviceId ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-neutral-100 hover:bg-white text-black'}`}
          >
            <Save size={14} /> Salvar Gerais
          </button>
        </div>
      </section>

      {/* 2. Personalizar Sensores */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Thermometer} title="Personalizar Sensores" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField 
            label="Nome Sensor 1 (Fermentador)" 
            value={settings.sensor1Name} 
            onChange={(v: string) => handleChange('sensor1Name', v)} 
          />
          <InputField 
            label="Nome Sensor 2 (Ambiente)" 
            value={settings.sensor2Name} 
            onChange={(v: string) => handleChange('sensor2Name', v)} 
          />
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleSaveSensorNames}
            disabled={!selectedDeviceId}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${!selectedDeviceId ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'}`}
          >
            <Save size={14} /> Salvar Nomes
          </button>
        </div>
      </section>

      {/* 3. Calibração (Offset) */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Activity} title="Calibração (Offset)" />
        <p className="text-neutral-500 text-xs mb-6 -mt-4">Ajuste fino adicionado à leitura bruta dos sensores. Use valores positivos ou negativos (ex: -0.5).</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InputField 
            label="Offset S1 (°C)" 
            value={settings.offsetS1} 
            onChange={(v: number) => handleChange('offsetS1', v)} 
            type="number" 
          />
          <InputField 
            label="Offset S2 (°C)" 
            value={settings.offsetS2} 
            onChange={(v: number) => handleChange('offsetS2', v)} 
            type="number" 
          />
          <InputField 
            label="Offset SG" 
            value={settings.offsetSG} 
            onChange={(v: number) => handleChange('offsetSG', v)} 
            type="number" 
          />
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleSaveCalibration}
            disabled={!selectedDeviceId}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)] ${!selectedDeviceId ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-neutral-100 hover:bg-white text-black'}`}
          >
            <Save size={14} /> Salvar Calibração
          </button>
        </div>
      </section>

      {/* 4. Parâmetros PID */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Cpu} title="Parâmetros PID" />
        
        <div className="mb-6">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neutral-600"></span> Aquecimento (Resistência)
                </div>
                <button 
                    onClick={() => handleStartAutotune('heat')}
                    disabled={!selectedDeviceId}
                    className="px-3 py-1 bg-amber-500/20 text-amber-500 border border-amber-500/50 rounded text-[10px] hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                >
                    Iniciar Auto-Tune
                </button>
            </h4>
            <div className="grid grid-cols-4 gap-4">
                <InputField label="Kp" value={settings.pidHeating.kp} onChange={(v: number) => handlePIDChange('pidHeating', 'kp', v)} type="number" />
                <InputField label="Ki" value={settings.pidHeating.ki} onChange={(v: number) => handlePIDChange('pidHeating', 'ki', v)} type="number" />
                <InputField label="Kd" value={settings.pidHeating.kd} onChange={(v: number) => handlePIDChange('pidHeating', 'kd', v)} type="number" />
                <InputField label="Janela PWM (ms)" value={settings.pwmWindowHeat} onChange={(v: number) => handleChange('pwmWindowHeat', v)} type="number" />
            </div>
        </div>

        <div className="border-t border-neutral-800/50 pt-6">
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-neutral-600"></span> Refrigeração (Compressor)
                </div>
                <button 
                    onClick={() => handleStartAutotune('cool')}
                    disabled={!selectedDeviceId}
                    className="px-3 py-1 bg-blue-500/20 text-blue-500 border border-blue-500/50 rounded text-[10px] hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                >
                    Iniciar Auto-Tune
                </button>
            </h4>
            <div className="grid grid-cols-3 gap-4">
                <InputField label="Kp" value={settings.pidCooling.kp} onChange={(v: number) => handlePIDChange('pidCooling', 'kp', v)} type="number" />
                <InputField label="Ki" value={settings.pidCooling.ki} onChange={(v: number) => handlePIDChange('pidCooling', 'ki', v)} type="number" />
                <InputField label="Kd" value={settings.pidCooling.kd} onChange={(v: number) => handlePIDChange('pidCooling', 'kd', v)} type="number" />
            </div>
        </div>
        
        <div className="mt-8 flex justify-end">
          <button 
            onClick={handleUpdatePID}
            disabled={!selectedDeviceId}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)] ${!selectedDeviceId ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-neutral-100 hover:bg-white text-black'}`}
          >
            <Save size={14} /> Atualizar PID
          </button>
        </div>
      </section>

      {/* 5. Teste de Relés */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Zap} title="Teste de Relés" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
                onClick={() => handleTestRelay(1, 'HEAT')}
                disabled={!selectedDeviceId}
                className={`py-2.5 rounded-lg font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 border ${!selectedDeviceId ? 'opacity-50 cursor-not-allowed' : ''} ${relayState === 'HEAT' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-transparent border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'}`}
            >
                <Thermometer size={14} /> Aquecer
            </button>
            <button 
                onClick={() => handleTestRelay(2, 'COOL')}
                disabled={!selectedDeviceId}
                className={`py-2.5 rounded-lg font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 border ${!selectedDeviceId ? 'opacity-50 cursor-not-allowed' : ''} ${relayState === 'COOL' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-transparent border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'}`}
            >
                <Power size={14} /> Refrigerar
            </button>
            <button 
                onClick={() => handleTestRelay(0, 'AUTO')}
                disabled={!selectedDeviceId}
                className={`py-2.5 rounded-lg font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 border ${!selectedDeviceId ? 'opacity-50 cursor-not-allowed' : ''} ${relayState === 'AUTO' ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-transparent border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300'}`}
            >
                <Cpu size={14} /> Auto
            </button>
        </div>
        <p className="text-xs text-neutral-600 mt-4">* O modo AUTO retorna o controle para o algoritmo PID.</p>
      </section>

      {/* 6. Sistema */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Power} title="Sistema" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
                onClick={() => {
                    if(!selectedDeviceId) return;
                    if(confirm('Deseja reiniciar o ESP32?')) { 
                        sendCommand(selectedDeviceId, 'cmd', {action:'reboot'}); 
                        toast.success('Comando de reinício enviado!'); 
                    }
                }}
                disabled={!selectedDeviceId}
                className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
                <RotateCcw size={14} /> Reiniciar
            </button>
            <button 
                onClick={handleDownloadLogs}
                disabled={!selectedDeviceId}
                className="bg-white hover:bg-neutral-200 text-black py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500"
            >
                <Download size={14} /> Baixar Logs
            </button>
            <button 
                onClick={handleClearLogs}
                disabled={!selectedDeviceId}
                className="bg-transparent border border-neutral-800 hover:border-red-900/50 hover:bg-red-900/10 hover:text-red-500 text-neutral-500 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
                <Trash2 size={14} /> Limpar Logs
            </button>
            <button 
                onClick={() => {
                    if(!selectedDeviceId) return;
                    if(confirm('ATENÇÃO: Isso apagará todas as configurações de rede do ESP32. Continuar?')) { 
                        sendCommand(selectedDeviceId, 'cmd', {action:'resetconfig'}); 
                        toast.error('Reset de Fábrica enviado!'); 
                    }
                }}
                disabled={!selectedDeviceId}
                className="bg-transparent border border-neutral-800 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 text-neutral-500 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
                <Power size={14} /> Reset Fábrica
            </button>
        </div>
      </section>

      {/* 7. Atualização de Firmware (OTA) */}
      <section className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8">
        <SectionHeader icon={Download} title="Atualização Remota (OTA)" />
        <p className="text-neutral-500 text-xs mb-6 -mt-4">Envie um novo arquivo binário de firmware para o ESP32 através de uma URL pública. Opcionalmente, inclua o hash MD5 para validação de integridade.</p>
        
        {latestFirmware && activeDevice?.currentDevice?.version && latestFirmware.version !== activeDevice.currentDevice.version && (
            <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-500">
                <div>
                    <h4 className="text-emerald-500 font-bold text-sm mb-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Nova Versão Oficial Disponível: {latestFirmware.version}
                    </h4>
                    <p className="text-emerald-500/70 text-xs">Seu equipamento está na versão {activeDevice.currentDevice.version}. Atualize para obter as últimas melhorias.</p>
                </div>
                <button 
                    onClick={() => {
                        const baseUrl = window.location.origin;
                        const finalUrl = latestFirmware.url || `${baseUrl}/firmware/update.bin`;
                        setOtaUrl(finalUrl);
                        if(latestFirmware.md5) setOtaMd5(latestFirmware.md5);
                        
                        setTimeout(() => {
                            if (confirm(`Deseja instalar a versão ${latestFirmware.version} agora? O ESP32 será reiniciado.`)) {
                                sendCommand(selectedDeviceId, 'update_firmware', { url: finalUrl, md5: latestFirmware.md5 || '' });
                                toast.success('Comando de Atualização OTA enviado! O painel da placa exibirá o progresso.');
                            }
                        }, 100);
                    }}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shrink-0 shadow-[0_0_15px_rgba(5,150,105,0.3)]"
                >
                    Instalar Automático
                </button>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <InputField 
            label="URL do Arquivo .bin" 
            value={otaUrl} 
            onChange={(v: string) => setOtaUrl(v)} 
            placeholder="http://seu-servidor.com/firmware.bin"
          />
          <InputField 
            label="Hash MD5 (Opcional)" 
            value={otaMd5} 
            onChange={(v: string) => setOtaMd5(v)} 
            placeholder="Ex: 5d41402abc4b2a76b9719d911017c592"
          />
        </div>
        
        <div className="flex justify-end">
          <button 
            onClick={handleTriggerOTA}
            disabled={!selectedDeviceId}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${!selectedDeviceId ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white shadow-[0_0_15px_rgba(220,38,38,0.1)]'}`}
          >
            <Download size={14} /> Disparar Atualização OTA
          </button>
        </div>
      </section>

    </div>
  );
};
