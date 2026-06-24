
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

export interface ISpindelData {
  gravity: number; // Specific Gravity (e.g., 1.050)
  temperature: number; // Celsius (Beer Temp)
  battery: number; // Volts
  angle: number; // Tilt angle
  rssi: number; // Wifi strength dBm
  lastUpdate: string; // ISO timestamp
  statOp?: string; // Operation Status (e.g. AQUECENDO, RESFRIANDO)
  logInterval?: number; // webinterval (ms)
  compressorDelay?: number; // cds
  version?: string; // Firmware version (e.g. V1.0.017 SAFE-BOOT STABLE)
}

export interface Reading {
  timestamp: string;
  beerTemp: number;
  fridgeTemp: number;
  targetTemp: number;
  gravity: number;
}

export interface FermentationStep {
  id: string;
  name: string; // ex: Primária, Descanso Diacetil
  temperature: number;
  duration: number; // dias
}

export interface KegeratorConfig {
  line1: string;
  line2: string;
  style: string;
  brewery: string;
  ibu: number;
  abv: number;
    login: (email: string, pass: string) => Promise<boolean>;
    loginWithGoogle: (idToken: string) => Promise<boolean>;
    logout: () => void;
}

export interface Fermenter {
  id: string;
  name: string;
  ipAddress?: string; // IP ou Serial do dispositivo
  mode: DeviceMode; // Novo campo: Modo de Operação
  sensor1_name?: string;
  sensor2_name?: string;
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
  currentDevice: ISpindelData;
  currentFridgeTemp: number; // Ambient/Fridge Temperature
  profile: FermentationStep[]; // Lista de rampas
  currentStepIndex: number; // Índice da rampa ativa
  isPaused: boolean; // Controle de pausa do perfil
  events?: FermentationEvent[]; // New field for logged events
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
  notes: string;
  readings: Reading[]; // Adicionado para gráficos históricos
  ingredients?: any; // Receita (Maltes, Lúpulos, Levedura)
}

export interface ScannedDevice {
    ip: string;
    type: string;
    rssi: number;
}
