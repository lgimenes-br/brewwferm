
export enum FermenterStatus {
  IDLE = 'Inativo',
  ACTIVE = 'Fermentando',
  COLD_CRASH = 'Cold Crash',
  DIACETYL_REST = 'Descanso de Diacetil',
  CARBONATION = 'Carbonatação Forçada'
}

export enum DeviceMode {
  FERMENTER = 'Fermentador',
  KEGERATOR = 'Choppeira',
  FRIDGE = 'Geladeira'
}

export enum BeerStyle {
  IPA = 'IPA',
  STOUT = 'Stout',
  LAGER = 'Lager',
  PALE_ALE = 'Pale Ale',
  NEIPA = 'NEIPA',
  WHEAT = 'Wheat'
}

export enum EventType {
  DRY_HOP = 'Dry Hop',
  FRUIT = 'Adição de Fruta',
  CLARIFIER = 'Clarificador',
  SPICE = 'Especiarias',
  OTHER = 'Outro',
  SYSTEM_ACTION = 'Sistema'
}

export interface FermentationEvent {
  id: string;
  type: EventType;
  description: string;
  timestamp: string;
}

export interface DeviceData {
  gravity: number; // Specific Gravity (e.g., 1.050)
  temperature: number; // Celsius (Beer Temp)
  battery: number; // Volts
  angle: number; // Tilt angle
  rssi: number; // Wifi strength dBm
  lastUpdate: string; // ISO timestamp
  statOp?: string; // Operation Status (e.g. AQUECENDO, RESFRIANDO)
  logInterval?: number; // webinterval (ms)
  extSens?: any; // Extra sensors like humidity
  macCtrl?: string; // Control sensor 1-Wire MAC
  compressorDelay?: number; // cds
  version?: string; // Firmware version (e.g. V1.0.017 SAFE-BOOT STABLE)
  stepTime?: number; // Elapsed time in current step (in hours, from ESP32)
}

export interface Reading {
  timestamp: string;
  beerTemp: number;
  fridgeTemp: number;
  targetTemp: number;
  gravity: number;
  extra_sensors?: Record<string, number>;
}

export interface FermentationStep {
  id: string;
  name: string; // ex: Primária, Descanso Diacetil
  temperature: number;
  duration: number; // dias
  triggerGravity?: number; // Meta opcional de SG para avançar automaticamente (ex: 1.018)
}

export interface KegeratorConfig {
  line1: string;
  line2: string;
  style: string;
  brewery: string;
  ibu: number;
  abv: number;
}

export interface Fermenter {
  id: string;
  name: string;
  ipAddress?: string; // IP ou Serial do dispositivo
  /** Ultimo contato registrado no servidor (ISO), para "visto ha X" com o aparelho offline */
  lastSeen?: string;
  /** O servidor viu sensor de umidade / iSpindel neste aparelho nos ultimos 14 dias */
  hasHumidity?: boolean;
  hasIspindel?: boolean;
  /** Sensores de temperatura que existem [1, 2, 3, 4] (vistos pelo servidor nos ultimos 14 dias) */
  tempSeen?: boolean[];
  mode: DeviceMode; // Novo campo: Modo de Operação
  sensor1_name?: string;
  sensor2_name?: string;
  sensor3_name?: string;
  sensor4_name?: string;
  sensor_sg_name?: string;
  /** Linhas escondidas no grafico pelo usuario ('s1'..'s4', 'sg'); vale no app e no site */
  chart_hidden?: string[];
  chopp_name?: string;
  status: FermenterStatus;
  beerName: string;
  style: BeerStyle;
  startDate: string;
  batchId?: number; // Active batch ID from backend
  og: number; // Original Gravity
  fg: number; // Target Final Gravity (Estimated)
  volume: number; // Liters
  targetTemp: number;
  readings: Reading[];
  currentDevice: DeviceData;
  currentFridgeTemp: number; // Ambient/Fridge Temperature
  profile: FermentationStep[]; // Lista de rampas
  currentStepIndex: number; // Índice da rampa ativa
  isPaused: boolean; // Controle de pausa do perfil
  events?: FermentationEvent[]; // New field for logged events
  stepStartDate?: string;
  kegeratorConfig?: KegeratorConfig; // Configurações específicas da choppeira
}

export interface FinishedBrew {
  id: string;
  batchNumber: string;
  beerName: string;
  style: BeerStyle;
  startDate: string;
  endDate: string;
  og: number;
  fg: number;
  abv: number;
  efficiency: number; // attenuation
  rating?: number; // 1-5 stars
  isActive?: boolean;
  notes: string;
  readings: Reading[]; // Adicionado para gráficos históricos
  ingredients?: any; // Receita (Maltes, Lúpulos, Levedura)
  sensor1_name?: string;
  sensor2_name?: string;
  sensor3_name?: string;
  sensor4_name?: string;
  sensor_sg_name?: string;
  chopp_name?: string;
}

export interface ScannedDevice {
    ip: string; // serial do aparelho
    type: string;
    rssi: number;
    localIp?: string | null; // IP na rede local (informativo)
}

export const normalizeGravity = (val: any, fallback = 0): number => {
    if (val === null || val === undefined || val === '') return fallback;
    const n = parseFloat(String(val));
    if (isNaN(n) || !isFinite(n)) return fallback;
    return n > 500 ? n / 1000 : n;
};

/** Faixa de mosto (SG 0,980 a 1,200): fora disso o densimetro esta fora do liquido ou descalibrado */
export const isPlausibleGravity = (g: number | null | undefined): g is number => typeof g === 'number' && Number.isFinite(g) && g >= 0.98 && g <= 1.2;

/** Densidade para mostrar: qualquer leitura aparece, por mais estranha que seja (como no app); "--" so
 *  sem leitura. As contas (ABV, atenuacao) usam apenas valores plausiveis. */
export const formatGravity = (g: number): string => (Number.isFinite(g) && g > 0 ? g.toFixed(3) : '--');

export const isDeviceOnline = (fermenter?: Fermenter | null, nowMs = Date.now(), timeoutMs = 30000): boolean => {
    if (!fermenter?.currentDevice?.lastUpdate) return false;
    const lastUpdate = new Date(fermenter.currentDevice.lastUpdate).getTime();
    return !isNaN(lastUpdate) && lastUpdate > 0 && (nowMs - lastUpdate) < timeoutMs;
};

export const parseBeerStyle = (rawStyle: any): BeerStyle => {
    if (typeof rawStyle === 'string') {
        const styleUpper = rawStyle.toUpperCase().replace(/\s+/g, '_');
        if (styleUpper.includes('PALE') && styleUpper.includes('ALE')) return BeerStyle.PALE_ALE;
        if (styleUpper.includes('NEIPA')) return BeerStyle.NEIPA;
        if (styleUpper.includes('IPA')) return BeerStyle.IPA;
        if (styleUpper.includes('STOUT')) return BeerStyle.STOUT;
        if (styleUpper.includes('LAGER') || styleUpper.includes('PILSNER')) return BeerStyle.LAGER;
        if (styleUpper.includes('WHEAT')) return BeerStyle.WHEAT;
    }
    return BeerStyle.LAGER;
};

export const mapBatchToFinishedBrew = (b: any): FinishedBrew => {
    const og = normalizeGravity(b?.og, 0);
    const fg = normalizeGravity(b?.fg, 0) || normalizeGravity(b?.last_gravity, 0);
    const extractNotes = (ing: any, rawNotes?: string) => {
        if (rawNotes) return rawNotes;
        if (!ing) return '';
        try {
            const parsed = typeof ing === 'string' ? JSON.parse(ing) : ing;
            return parsed && typeof parsed.notes === 'string' ? parsed.notes : '';
        } catch {
            return '';
        }
    };
    return {
        id: String(b.id),
        batchNumber: String(b.id),
        beerName: b.name || b.beer_name || 'Sem Nome',
        style: b.style || b.beer_style || 'Other',
        startDate: b.started_at || b.start_date,
        endDate: b.ended_at || b.end_date || '',
        og,
        fg,
        abv: (og && fg && og > fg) ? ((og - fg) * 131.25) : 0,
        efficiency: (og && fg && og > 1) ? ((og - fg) / (og - 1.0) * 100) : 0,
        notes: extractNotes(b.ingredients, b.notes),
        ingredients: b.ingredients,
        sensor1_name: b.sensor1_name,
        sensor2_name: b.sensor2_name,
        sensor_sg_name: b.sensor_sg_name,
        readings: []
    };
};

/** Tipo do evento vindo do servidor: os automaticos chegam como SYSTEM_ACTION (como no app) */
export const eventTypeFromServer = (raw: unknown): EventType =>
    raw === 'SYSTEM_ACTION' || raw === EventType.SYSTEM_ACTION ? EventType.SYSTEM_ACTION : ((raw as EventType) || EventType.OTHER);

export const getEventReferenceMarks = (safeData: { timestamp: string }[], events?: FermentationEvent[]) => {
    if (!Array.isArray(safeData) || safeData.length < 2 || !Array.isArray(events)) return [];
    const minTime = new Date(safeData[0].timestamp).getTime();
    const maxTime = new Date(safeData[safeData.length - 1].timestamp).getTime();
    return events
        .filter(event => {
            const t = new Date(event.timestamp).getTime();
            return !isNaN(t) && t >= minTime && t <= maxTime;
        })
        .map(event => {
            const eventTime = new Date(event.timestamp).getTime();
            const closest = safeData.reduce((prev, curr) =>
                Math.abs(new Date(curr.timestamp).getTime() - eventTime) <
                Math.abs(new Date(prev.timestamp).getTime() - eventTime) ? curr : prev
            );
            return { ...event, markTime: closest?.timestamp };
        })
        .filter(e => Boolean(e.markTime));
};

// ---------- Sensores numerados (fw 2.11+) ----------
// Ate 4 DS18B20 (Sensor 1..4). Um so controla a temperatura do modo; os outros aparecem so para ver.
// Mesma regra do app (breww-app/src/core/device.ts: controlSlot/otherSensors). Manter igual.

export interface SensorView {
    temps: (number | undefined)[]; // indice 0 = Sensor 1
    names: string[];
    control: number;               // sensor que controla agora
    controlMap?: number[];         // escolha por modo [fermentador, geladeira, choppeira]; -1 = automatico
    supportsControl: boolean;      // firmware 2.11+ (informa ctlMap)
}

const finiteOrUndef = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === '') return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
};

export const sensorView = (f: Fermenter): SensorView => {
    const raw: any = (f.currentDevice as any)?.rawPayload || {};
    const ext: any = f.currentDevice?.extSens || {};
    const t = Array.isArray(raw.t) ? raw.t : null;
    const temps = [
        t ? finiteOrUndef(t[0]) : finiteOrUndef(f.currentDevice?.temperature),
        t ? finiteOrUndef(t[1]) : finiteOrUndef(f.currentFridgeTemp),
        t ? finiteOrUndef(t[2]) : finiteOrUndef(ext.s3),
        t ? finiteOrUndef(t[3]) : finiteOrUndef(ext.s4),
    ];
    const names = [f.sensor1_name, f.sensor2_name, f.sensor3_name, f.sensor4_name].map((n, i) => (n || '').trim() || `Sensor ${i + 1}`);
    const reported = Number.isInteger(raw.ctl) ? raw.ctl : Number.isInteger(ext.ctl) ? ext.ctl : undefined;
    const cold = f.mode === DeviceMode.FRIDGE || f.mode === DeviceMode.KEGERATOR;
    // Sem o aparelho informar (firmware antigo): fermentador pelo Sensor 1; geladeira/choppeira pelo 2 (sem ele, pelo 1)
    const control = reported !== undefined && reported >= 0 && reported < 4 ? reported : cold ? (temps[1] !== undefined || temps[0] === undefined ? 1 : 0) : 0;
    const controlMap = Array.isArray(raw.ctlMap) ? raw.ctlMap.map((v: unknown) => (Number.isInteger(v) ? Number(v) : -1)) : undefined;
    return { temps, names, control, controlMap, supportsControl: !!controlMap };
};

/**
 * Sensores opcionais que este aparelho TEM. Nao tem = nao aparece (antes ficava "--" para sempre).
 * Tem = o servidor viu o sensor nos ultimos 14 dias, ou ha leitura agora; tem e sem leitura = "--".
 * Densidade tambem conta leitura no grafico do lote (ex.: medida a mao).
 */
export const sensorPresence = (f: Fermenter): { humidity: boolean; gravity: boolean } => {
  const hum = parseFloat(String(f.currentDevice?.extSens?.hum ?? ''));
  const liveGravity = normalizeGravity(f.currentDevice?.gravity, 0);
  const chartGravity = (f.readings || []).some(r => normalizeGravity(r.gravity, 0) > 0.98);
  return {
    humidity: !!f.hasHumidity || Number.isFinite(hum),
    gravity: !!f.hasIspindel || liveGravity > 0.98 || chartGravity,
  };
};

/**
 * Os outros sensores de temperatura (nao controlam). O que controla e a temperatura grande e sempre aparece;
 * os outros aparecem se tem leitura ou se existem (seen, "--" sem leitura); sem nunca ter existido, nao.
 */
export const otherSensors = (v: SensorView, seen?: boolean[]): { slot: number; name: string; temp?: number }[] =>
    v.temps.map((temp, slot) => ({ slot, name: v.names[slot], temp }))
        .filter(s => s.slot !== v.control && (s.temp !== undefined || !!seen?.[s.slot]));
