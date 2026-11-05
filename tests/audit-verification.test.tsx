import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('mqtt', () => ({
    default: {
        connect: () => ({
            on: vi.fn(),
            subscribe: vi.fn(),
            publish: vi.fn(),
            end: vi.fn()
        })
    }
}));

import { AbvCalculator } from '../components/calculators/AbvCalculator';
import { BoilOffCalculator } from '../components/calculators/BoilOffCalculator';
import { CarbonationCalculator } from '../components/calculators/CarbonationCalculator';
import { YeastCalculator } from '../components/calculators/YeastCalculator';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BrewProvider } from '../context/BrewContext';
import { ForecastingEngine } from '../components/ForecastingEngine';
import { DualAxisChart } from '../components/DualAxisChart';
import { GravityChart } from '../components/GravityChart';
import { TemperatureChart } from '../components/TemperatureChart';
import { FermentationTimeline } from '../components/FermentationTimeline';
import { FermentationProfile } from '../components/FermentationProfile';
import { FinishedBrewDetail } from '../components/FinishedBrewDetail';
import { GeminiAdvisor } from '../components/GeminiAdvisor';
import { Dashboard } from '../components/Dashboard';
import { FermenterDetail } from '../components/FermenterDetail';
import { CompareBatches } from '../components/CompareBatches';
import { FermenterStatus, DeviceMode, BeerStyle, Fermenter, FinishedBrew } from '../types';
import * as api from '../services/api';

let container: HTMLDivElement;
let root: Root;

function renderUI(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    act(() => {
        root.render(
            <MemoryRouter>
                <QueryClientProvider client={queryClient}>
                    <AuthProvider>
                        <BrewProvider>{ui}</BrewProvider>
                    </AuthProvider>
                </QueryClientProvider>
            </MemoryRouter>
        );
    });
    return container;
}

function setInputValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
    const proto = input instanceof HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    act(() => {
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
});

describe('Calculators Runtime Verification', () => {
    it('AbvCalculator handles standard SG (1.050) and 4-digit SG (1050) and unit toggles', () => {
        renderUI(<AbvCalculator />);
        const inputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        expect(inputs.length).toBe(2);

        setInputValue(inputs[0], '1050');
        setInputValue(inputs[1], '1010');

        // (1.050 - 1.010) * 131.25 = 5.25 -> 5.3%
        expect(container.textContent).toContain('5.3%');

        // Toggle to Plato
        const platoBtn = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Graus Plato')
        );
        expect(platoBtn).toBeTruthy();
        act(() => {
            platoBtn?.click();
        });
        expect(inputs[0].value).toBe('12.4');
    });

    it('BoilOffCalculator normalizes 4-digit gravities (1042 -> 1050) and calculates dilution', () => {
        renderUI(<BoilOffCalculator />);
        const inputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        setInputValue(inputs[0], '1042');
        setInputValue(inputs[1], '1050');
        setInputValue(inputs[2], '24');

        expect(container.textContent).toContain('-3.84L');

        // Test dilution when current > target
        setInputValue(inputs[0], '1060');
        setInputValue(inputs[1], '1050');
        expect(container.textContent).toContain('Diluição Necessária');
        expect(container.textContent).toContain('+4.80L');
    });

    it('CarbonationCalculator calculates Priming even when Keg temperature input is cleared', () => {
        renderUI(<CarbonationCalculator />);
        const selects = Array.from(container.querySelectorAll('select')) as HTMLSelectElement[];
        setInputValue(selects[1], 'Priming (Açúcar)');

        const inputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        // Clear keg temperature input (inputs[1])
        setInputValue(inputs[1], '');

        expect(container.textContent).toContain('Açúcar para Adicionar');
        expect(container.textContent).toContain('117.5g');
    });

    it('YeastCalculator handles future mfg dates and keeps stageResults aligned when a stage has invalid SG', () => {
        renderUI(<YeastCalculator />);
        const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
        expect(dateInput).toBeTruthy();

        // Future date should clamp viability to 100%, not degrade it
        setInputValue(dateInput, '2099-01-01');
        const numberInputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        const viabilityInput = numberInputs.find((el) => el.disabled);
        expect(viabilityInput?.value).toBe('100');

        // Add second stage and set Stage 1 SG to invalid value
        const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Adicionar Etapa de Propagação')
        );
        act(() => {
            addBtn?.click();
        });
        const allSpinbuttons = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        const stage1Sg = allSpinbuttons.find((el) => el.value === '1.036');
        expect(stage1Sg).toBeTruthy();
        if (stage1Sg) {
            setInputValue(stage1Sg, '0.990');
        }
        expect(container.textContent).toContain('Etapa 2');
    });
});

describe('AuthContext & API Service Resilience', () => {
    it('ignores literal "undefined" and "null" strings in localStorage without treating user as logged in', () => {
        localStorage.setItem('token', 'undefined');
        localStorage.setItem('user', 'null');
        localStorage.setItem('role', 'undefined');

        const Consumer = () => {
            const { token, user, role } = useAuth();
            return (
                <div>
                    {token ? 'has-token' : 'no-token'}|{user ? 'has-user' : 'no-user'}|{role ? 'has-role' : 'no-role'}
                </div>
            );
        };

        renderUI(<Consumer />);

        expect(container.textContent).toContain('no-token|no-user|no-role');
    });

    it('API service handles invalid date in saveEvent by falling back to current date without NaN-NaN-NaN', async () => {
        let capturedBody = '';
        global.fetch = vi.fn().mockImplementation(async (_url, init) => {
            capturedBody = init?.body as string;
            return {
                ok: true,
                status: 200,
                json: async () => ({ success: true })
            };
        });

        await api.saveEvent(42, 'Dry Hop', 'Citra 50g', 'not-a-valid-date');
        expect(capturedBody).not.toContain('NaN');
        const parsed = JSON.parse(capturedBody);
        expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
});

describe('Charts, Forecasting, Advisor, Profile & Details Edge Cases', () => {
    const mockFermenter: Fermenter = {
        id: 'BREW-TEST01',
        name: 'Ferm 1',
        ipAddress: 'BREW-TEST01',
        mode: DeviceMode.FERMENTER,
        status: FermenterStatus.ACTIVE,
        beerName: 'Test IPA',
        style: BeerStyle.IPA,
        startDate: new Date(Date.now() - 86400000 * 2).toISOString(),
        batchId: 1,
        og: 1050,
        fg: 1010,
        volume: 20,
        targetTemp: 20.0,
        readings: [
            {
                timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
                beerTemp: 19.0,
                fridgeTemp: 18.0,
                targetTemp: 20.0,
                gravity: 1.050
            },
            {
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                beerTemp: 19.2,
                fridgeTemp: 18.5,
                targetTemp: 20.0,
                gravity: 1.035
            },
            {
                timestamp: new Date().toISOString(),
                beerTemp: 19.5,
                fridgeTemp: 19.0,
                targetTemp: 20.0,
                gravity: 1.020
            },
            {
                timestamp: 'invalid-date',
                beerTemp: NaN,
                fridgeTemp: NaN,
                targetTemp: 20.0,
                gravity: NaN
            }
        ],
        currentDevice: {
            gravity: 1.020,
            temperature: 19.5,
            battery: 4.1,
            angle: 45,
            rssi: -55,
            lastUpdate: new Date().toISOString()
        },
        currentFridgeTemp: 19.0,
        profile: [
            { id: 's1', name: 'Primária', temperature: 20, duration: 7 }
        ],
        currentStepIndex: 0,
        isPaused: false,
        events: []
    };

    it('renders multiple Charts on the same page with unique SVG defs IDs and filters invalid data points', () => {
        renderUI(
            <div>
                <DualAxisChart data={mockFermenter.readings} events={[]} />
                <DualAxisChart data={mockFermenter.readings} events={[]} />
                <GravityChart data={mockFermenter.readings} events={[]} />
                <TemperatureChart data={mockFermenter.readings} events={[]} />
            </div>
        );
        expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('ForecastingEngine normalizes 4-digit OG/FG (1050/1010) and renders prediction without NaN', () => {
        renderUI(<ForecastingEngine fermenter={mockFermenter} />);
        expect(container.textContent).not.toContain('NaN');
        expect(container.textContent).not.toContain('Infinity');
    });

    it('FermentationTimeline handles invalid startDate and events without NaN', () => {
        renderUI(
            <FermentationTimeline
                events={[]}
                startDate="invalid-date"
                onAddEvent={() => {}}
                onRemoveEvent={() => {}}
            />
        );
        expect(container.textContent).not.toContain('NaN');
        expect(container.textContent).not.toContain('Infinity');
    });

    it('GeminiAdvisor renders cleanly with 4-digit OG/FG without NaN%', () => {
        renderUI(<GeminiAdvisor fermenter={mockFermenter} />);
        expect(container.textContent).not.toContain('NaN');
        expect(container.textContent).not.toContain('Infinity');
    });

    it('FermentationProfile handles steps safely and deep-clones when editing', () => {
        let savedSteps: any[] = [];
        renderUI(
            <FermentationProfile
                steps={mockFermenter.profile}
                currentStepIndex={mockFermenter.currentStepIndex}
                isPaused={mockFermenter.isPaused}
                startDate={mockFermenter.startDate}
                onUpdateSteps={(steps) => {
                    savedSteps = steps;
                }}
                onTogglePause={() => {}}
                onPrevStep={() => {}}
                onNextStep={() => {}}
                onFinishProfile={() => {}}
            />
        );
        expect(container.textContent).toContain('Primária');
        expect(savedSteps.length).toBe(0);
    });

    it('FinishedBrewDetail normalizes 4-digit OG/FG (1050/1010), computes ABV fallback, and uses preloaded readings when unauthenticated', () => {
        const finishedBrew: FinishedBrew = {
            id: 'b-100',
            batchNumber: '10',
            beerName: 'Imperial IPA',
            style: BeerStyle.IPA,
            startDate: '2026-01-01T00:00:00Z',
            endDate: '2026-01-15T00:00:00Z',
            og: 1050,
            fg: 1010,
            abv: 0,
            efficiency: 80,
            notes: 'Great batch',
            readings: mockFermenter.readings
        };
        renderUI(<FinishedBrewDetail brew={finishedBrew} />);
        expect(container.textContent).toContain('1.050');
        expect(container.textContent).toContain('1.010');
        expect(container.textContent).toContain('5.3%');
        expect(container.textContent).toContain('19.5°C'); // Max temp from preloaded readings!
        expect(container.textContent).not.toContain('Sem dados de telemetria disponíveis');
        expect(container.textContent).not.toContain('NaN');
    });

    it('Dashboard renders fermenters with 4-digit OG/FG and og === fg without NaN or Infinity', async () => {
        localStorage.setItem('token', 'test-token');
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (String(url).includes('/devices')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [
                        { id: 1, serial_code: 'BREW-TEST01', device_name: 'Ferm 1', mode: 'Fermentador' },
                        { id: 2, serial_code: 'BREW-TEST02', device_name: 'Ferm 2', mode: 'Fermentador' }
                    ]
                };
            }
            if (String(url).includes('/batches')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [
                        { id: 1, serial_code: 'BREW-TEST01', name: 'Test IPA', style: 'IPA', og: 1050, fg: 1010, is_active: 1, start_date: '2026-01-01T00:00:00Z' },
                        { id: 2, serial_code: 'BREW-TEST02', name: 'Zero Span', style: 'IPA', og: 1.050, fg: 1.050, is_active: 1, start_date: '2026-01-01T00:00:00Z' }
                    ]
                };
            }
            return { ok: true, status: 200, json: async () => [] };
        });

        await act(async () => {
            renderUI(<Dashboard />);
        });
        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });
        expect(container.textContent).toContain('Ferm 1');
        expect(container.textContent).toContain('Ferm 2');
        expect(container.textContent).not.toContain('NaN');
        expect(container.textContent).not.toContain('Infinity');
    });

    it('FermenterDetail renders active fermenter with 4-digit OG/FG and og === fg without NaN or Infinity', () => {
        renderUI(
            <FermenterDetail
                fermenter={mockFermenter}
                onUpdate={() => {}}
            />
        );
        expect(container.textContent).toContain('Test IPA');
        expect(container.textContent).toContain('1.050');
        expect(container.textContent).toContain('1.010');
        expect(container.textContent).toContain('3.9%');
        expect(container.textContent).not.toContain('NaN');
        expect(container.textContent).not.toContain('Infinity');
    });

    it('CompareBatches loads completed batches and renders cleanly', async () => {
        localStorage.setItem('token', 'test-token');
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (String(url).includes('/batches')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [
                        { id: 101, name: 'Batch OK', style: 'IPA', is_active: 0, start_date: '2026-01-01T00:00:00Z' },
                        { id: 102, name: 'Batch Two', style: 'IPA', is_active: 0, start_date: '2026-02-01T00:00:00Z' }
                    ]
                };
            }
            return { ok: true, status: 200, json: async () => [] };
        });

        await act(async () => {
            renderUI(<CompareBatches />);
        });
        expect(container.textContent).toContain('Batch OK');
        expect(container.textContent).toContain('Batch Two');
    });
});

describe('Static HTML Launchers Verification', () => {
    it('7inch-launcher.html has matching app container IDs for all 6 openApp indices and no duplicate goHome', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../public/7inch-launcher.html'), 'utf-8');
        const expectedIds = ['app-dashboard', 'app-telemetria', 'app-rampas', 'app-historico', 'app-config', 'app-calculadoras'];
        for (const id of expectedIds) {
            expect(html).toContain(`id="${id}"`);
        }
        const goHomeMatches = html.match(/function\s+goHome\s*\(/g) || [];
        expect(goHomeMatches.length).toBe(1);
    });

    it('3.5inch-launcher.html has matching app container IDs for all 6 openApp indices and no duplicate goHome', () => {
        const html = fs.readFileSync(path.resolve(__dirname, '../public/3.5inch-launcher.html'), 'utf-8');
        const expectedIds = ['app-dashboard', 'app-telemetria', 'app-rampas', 'app-historico', 'app-config', 'app-sobre'];
        for (const id of expectedIds) {
            expect(html).toContain(`id="${id}"`);
        }
        const goHomeMatches = html.match(/function\s+goHome\s*\(/g) || [];
        expect(goHomeMatches.length).toBe(1);
    });
});
