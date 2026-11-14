
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
  mode: DeviceMode; // Novo campo: Modo de Operação
  sensor1_name?: string;
  sensor2_name?: string;
  sensor_sg_name?: string;
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

/** Densidade para mostrar: fora da faixa possivel (0,980 a 1,200, ex.: 0 sem densimetro ou 32.293 vindo
 *  de outra grandeza) vira "--", como no app. */
export const formatGravity = (g: number): string => (Number.isFinite(g) && g >= 0.98 && g <= 1.2 ? g.toFixed(3) : '--');

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
