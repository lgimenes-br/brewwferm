
import { Fermenter, FermenterStatus, BeerStyle, Reading, FinishedBrew, DeviceMode, EventType, ScannedDevice } from '../types';

// Updated generator to accept an anchor date (endDate)
const generateReadings = (days: number, startOg: number, anchorDate: Date = new Date()): Reading[] => {
  const readings: Reading[] = [];
  let currentGravity = startOg;

  for (let i = days * 24; i >= 0; i--) { // Hourly readings for X days
    const time = new Date(anchorDate.getTime() - i * 60 * 60 * 1000);
    const progress = 1 - (i / (days * 24));

    // Simulate fermentation curve (exponential decay of gravity)
    if (currentGravity > 1.010) {
      currentGravity = startOg - ((startOg - 1.010) * Math.pow(progress, 0.5));
    }

    readings.push({
      timestamp: time.toISOString(),
      beerTemp: 19 + (Math.random() * 0.5 - 0.25), // Fluctuation around 19C
      fridgeTemp: 18.5 + (Math.sin(i / 2) * 1.5), // Compressor cycling
      targetTemp: 19.0,
      gravity: Number(currentGravity.toFixed(3))
    });
  }
  return readings;
};

export const MOCK_FERMENTERS: Fermenter[] = [
  {
    id: 'f1',
    name: 'Fermentador Cônico 01',
    ipAddress: '192.168.0.101',
    mode: DeviceMode.FERMENTER,
    status: FermenterStatus.ACTIVE,
    beerName: 'Galaxy Haze NEIPA',
    style: BeerStyle.NEIPA,
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    og: 1.065,
    fg: 1.012,
    volume: 25,
    targetTemp: 19.0,
    currentFridgeTemp: 17.8,
    readings: generateReadings(5, 1.065),
    events: [
      { id: 'e1', type: EventType.DRY_HOP, description: '50g Galaxy + 50g Citra', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    profile: [
      { id: 's1', name: 'Fermentação Primária', temperature: 18.0, duration: 4 },
      { id: 's2', name: 'Biotransformação', temperature: 20.0, duration: 2 },
      { id: 's3', name: 'Descanso de Diacetil', temperature: 22.0, duration: 3 },
      { id: 's4', name: 'Cold Crash', temperature: 2.0, duration: 3 }
    ],
    currentStepIndex: 1, // Biotransformação ativa
    isPaused: false,
    currentDevice: {
      gravity: 1.018,
      temperature: 19.2,
      battery: 4.1,
      angle: 45.3,
      rssi: -65,
      lastUpdate: new Date().toISOString()
    }
  },
  {
    id: 'f2',
    name: 'Bombona Azul 60L',
    ipAddress: '192.168.0.105',
    mode: DeviceMode.FERMENTER,
    status: FermenterStatus.COLD_CRASH,
    beerName: 'Bohemian Pilsner',
    style: BeerStyle.LAGER,
    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    og: 1.048,
    fg: 1.010,
    volume: 50,
    targetTemp: 2.0,
    currentFridgeTemp: 1.8,
    readings: generateReadings(14, 1.048).map(r => ({ ...r, targetTemp: r.timestamp > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() ? 2.0 : 12.0 })),
    events: [
      { id: 'e2', type: EventType.CLARIFIER, description: 'Biofine Clear', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    profile: [
      { id: 's1', name: 'Primária', temperature: 10.0, duration: 7 },
      { id: 's2', name: 'Descanso Diacetil', temperature: 16.0, duration: 3 },
      { id: 's3', name: 'Lagering', temperature: 2.0, duration: 15 }
    ],
    currentStepIndex: 2, // Lagering ativo
    isPaused: true,
    currentDevice: {
      gravity: 1.009,
      temperature: 2.1,
      battery: 3.8,
      angle: 25.1,
      rssi: -72,
      lastUpdate: new Date().toISOString()
    }
  },
  {
    id: 'f3',
    name: 'Kegerator Sala',
    ipAddress: '192.168.0.120',
    mode: DeviceMode.KEGERATOR,
    status: FermenterStatus.IDLE,
    beerName: 'Stout Nitro',
    style: BeerStyle.STOUT,
    startDate: '',
    og: 0,
    fg: 0,
    volume: 40,
    targetTemp: 4.0,
    currentFridgeTemp: 4.2,
    readings: [],
    events: [],
    profile: [],
    currentStepIndex: 0,
    isPaused: false,
    kegeratorConfig: {
      line1: 'NITRO STOUT',
      line2: 'CREAMY BATCH',
      style: 'DRY STOUT',
      brewery: 'HOMEBREW CO.',
      ibu: 35,
      abv: 4.5
    },
    currentDevice: {
      gravity: 1.020,
      temperature: 4.5,
      battery: 0,
      angle: 90,
      rssi: -60,
      lastUpdate: new Date().toISOString()
    }
  }
];

export const MOCK_HISTORY: FinishedBrew[] = [
  {
    id: 'h1',
    batchNumber: '#042',
    beerName: 'Summer Ale',
    style: BeerStyle.PALE_ALE,
    startDate: '2023-11-01',
    endDate: '2023-11-15',
    og: 1.050,
    fg: 1.010,
    abv: 5.2,
    efficiency: 80,
    rating: 4,
    notes: 'Fermentação limpa, notas cítricas bem presentes.',
    readings: generateReadings(14, 1.050, new Date('2023-11-15'))
  }
];

export const MOCK_SCANNED_DEVICES: ScannedDevice[] = [
  { ip: '192.168.0.150', type: 'iSpindel', rssi: -68 },
  { ip: '192.168.0.151', type: 'BrewPi', rssi: -72 },
  { ip: '192.168.0.152', type: 'Tilt Red', rssi: -55 }
];
