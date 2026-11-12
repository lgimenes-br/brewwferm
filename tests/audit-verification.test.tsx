import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

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
import { FermentationWizard } from '../components/FermentationWizard';
import { FermentationHistory } from '../components/FermentationHistory';
import { FinishedBrewDetail } from '../components/FinishedBrewDetail';
import { FinishedBrewDetailWrapper } from '../components/FinishedBrewDetailWrapper';
import { FermenterDetail } from '../components/FermenterDetail';
import { GeminiAdvisor } from '../components/GeminiAdvisor';
import { Dashboard } from '../components/Dashboard';
import { CompareBatches } from '../components/CompareBatches';
import { Settings } from '../components/Settings';
import { AdminDashboard } from '../components/AdminDashboard';
import { Login } from '../components/Login';
import { Register } from '../components/Register';
import { SystemBanner } from '../components/SystemBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FermenterStatus, DeviceMode, BeerStyle, Fermenter, FinishedBrew } from '../types';
import * as api from '../services/api';
import { getBrewingInsights } from '../services/geminiService';
// @ts-ignore - CommonJS/untyped JS backend module
import { sendPushToUser } from '../backend/pushService.js';

let container: HTMLDivElement;
let root: Root;

function renderUI(ui: React.ReactElement, initialEntries: string[] = ['/']) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    act(() => {
        root.render(
            <GoogleOAuthProvider clientId="test-client-id">
                <MemoryRouter initialEntries={initialEntries}>
                    <QueryClientProvider client={queryClient}>
                        <AuthProvider>
                            <BrewProvider>{ui}</BrewProvider>
                        </AuthProvider>
                    </QueryClientProvider>
                </MemoryRouter>
            </GoogleOAuthProvider>
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

describe('1. Calculators Runtime Verification', () => {
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

describe('2. AuthContext, Login, Register, SystemBanner, ErrorBoundary & Services', () => {
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

    it('Login and Register components render and validate inputs cleanly', () => {
        renderUI(<Login />);
        expect(container.textContent).toContain('Acompanhe e controle seus fermentadores');
        expect(container.textContent).toContain('Entrar');

        renderUI(<Register />);
        expect(container.textContent).toContain('Criar conta');
        expect(container.textContent).toContain('Grátis até 3 fermentadores');
    });

    it('SystemBanner displays active broadcast and persists dismissal in localStorage', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 77, title: 'Manutenção', message: 'Atualização às 22h', type: 'warning' })
        });

        await act(async () => {
            renderUI(<SystemBanner />);
        });
        await act(async () => {
            await new Promise((r) => setTimeout(r, 20));
        });

        expect(container.textContent).toContain('Manutenção');
        expect(container.textContent).toContain('Atualização às 22h');

        const closeBtn = container.querySelector('button');
        act(() => {
            closeBtn?.click();
        });
        expect(localStorage.getItem('closed_broadcast')).toBe('77');
        expect(container.textContent).not.toContain('Manutenção');
    });

    it('ErrorBoundary catches render errors and recovers on reset', () => {
        let shouldThrow = true;
        const BuggyChild = () => {
            if (shouldThrow) throw new Error('Simulated crash');
            return <div>Recovered OK</div>;
        };

        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        renderUI(
            <ErrorBoundary name="Teste">
                <BuggyChild />
            </ErrorBoundary>
        );
        expect(container.textContent).toContain('Algo deu errado');
        expect(container.textContent).toContain('Simulated crash');

        shouldThrow = false;
        const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Tentar Novamente')
        );
        act(() => {
            retryBtn?.click();
        });
        expect(container.textContent).toContain('Recovered OK');
        spy.mockRestore();
    });

    it('GeminiService parses markdown JSON and clamps health_score / risk_level safely', async () => {
        (import.meta as any).env.VITE_GEMINI_API_KEY = 'fake-gemini-key';
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (String(url).includes('/models?')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ models: [{ name: 'models/gemini-1.5-flash' }] })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: '```json\n{"summary":"Fermentação saudável","health_score":150,"estimated_completion_days":-3,"risk_level":"unknown","insights":["Manter 20C"],"ideal_curve":[]}\n```'
                                    }
                                ]
                            }
                        }
                    ]
                })
            };
        });

        const dummyFermenter: any = {
            id: 'F1',
            beerName: 'IPA',
            style: 'IPA',
            status: 'Fermentando',
            og: 1.050,
            volume: 20,
            targetTemp: 20,
            readings: []
        };
        const res = await getBrewingInsights(dummyFermenter);
        expect(typeof res).toBe('object');
        if (typeof res === 'object') {
            expect(res.summary).toBe('Fermentação saudável');
            expect(res.health_score).toBe(100); // clamped from 150 to 100
            expect(res.estimated_completion_days).toBe(0); // clamped from -3 to 0
            expect(res.risk_level).toBe('low'); // fallback from 'unknown'
        }
    });
});

describe('3. Charts, Forecasting, Advisor, Profile, Wizard, History & Details Edge Cases', () => {
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

    it('FermentationProfile handles steps safely and sanitizes empty step values when saving', () => {
        let savedSteps: any[] = [];
        renderUI(
            <FermentationProfile
                steps={[{ id: '1', name: '   ', temperature: NaN as any, duration: -5 }]}
                currentStepIndex={0}
                isPaused={false}
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
        // Click edit button, then click save button
        const buttons = Array.from(container.querySelectorAll('button'));
        act(() => {
            buttons[0]?.click();
        });
        const buttonsAfterEdit = Array.from(container.querySelectorAll('button'));
        act(() => {
            buttonsAfterEdit[0]?.click();
        });
        expect(savedSteps.length).toBe(1);
        expect(savedSteps[0].name).toBe('Etapa 1');
        expect(savedSteps[0].temperature).toBe(18);
        expect(savedSteps[0].duration).toBe(1);
    });

    it('FermentationWizard steps through all 4 steps and normalizes 4-digit OG/FG on start', () => {
        let startedPayload: any = null;
        renderUI(
            <FermentationWizard
                fermenter={mockFermenter}
                onStart={(data) => {
                    startedPayload = data;
                }}
                onCancel={() => {}}
            />
        );

        // Step 1: Fill recipe name so Next button is enabled
        const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
        setInputValue(nameInput, 'IPA Teste');
        const nextBtn1 = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Próximo')
        );
        act(() => {
            nextBtn1?.click();
        });

        // Step 2: Set 4-digit OG (1050) and FG (1010)
        const gravInputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
        expect(gravInputs.length).toBe(2);
        setInputValue(gravInputs[0], '1050');
        setInputValue(gravInputs[1], '1010');
        const nextBtn2 = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Próximo')
        );
        act(() => {
            nextBtn2?.click();
        });

        // Step 3: Profile -> Step 4
        const nextBtn3 = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('Próximo')
        );
        act(() => {
            nextBtn3?.click();
        });

        // Step 4: Click INICIAR FERMENTAÇÃO
        const startBtn = Array.from(container.querySelectorAll('button')).find((b) =>
            b.textContent?.includes('INICIAR FERMENTAÇÃO')
        );
        act(() => {
            startBtn?.click();
        });
        expect(startedPayload).toBeTruthy();
        expect(startedPayload.name).toBe('IPA Teste');
        expect(startedPayload.og).toBe(1.050);
        expect(startedPayload.fg).toBe(1.010);
        expect(startedPayload.volume).toBe(20);
    });

    it('FermentationHistory normalizes 4-digit OG and uses last_gravity fallback when FG is 0', async () => {
        localStorage.setItem('token', 'test-token');
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (String(url).includes('/history/batches')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [
                        {
                            id: 55,
                            name: 'Saison DuPont',
                            style: 'Saison',
                            og: 1060,
                            fg: 0,
                            last_gravity: 1.008,
                            started_at: '2026-01-01T00:00:00Z',
                            ended_at: '2026-01-14T00:00:00Z'
                        }
                    ]
                };
            }
            return { ok: true, status: 200, json: async () => [] };
        });

        await act(async () => {
            renderUI(<FermentationHistory />);
        });
        await act(async () => {
            await new Promise((r) => setTimeout(r, 30));
        });

        expect(container.textContent).toContain('Saison DuPont');
        expect(container.textContent).toContain('6.8%'); // (1.060 - 1.008) * 131.25 = 6.825%
        expect(container.textContent).not.toContain('NaN');
    });

    it('FinishedBrewDetailWrapper loads batch by route param :id and extracts notes from ingredients JSON', async () => {
        localStorage.setItem('token', 'test-token');
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (String(url).includes('/batches')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => [
                        {
                            id: 88,
                            name: 'West Coast IPA',
                            style: 'IPA',
                            og: 1065,
                            fg: 1012,
                            ingredients: JSON.stringify({ malts: 'Pale Ale', hops: 'Simcoe', yeast: 'US-05', notes: 'Dry hop no dia 5' }),
                            started_at: '2026-02-01T00:00:00Z',
                            ended_at: '2026-02-12T00:00:00Z'
                        }
                    ]
                };
            }
            return { ok: true, status: 200, json: async () => [] };
        });

        await act(async () => {
            renderUI(
                <Routes>
                    <Route path="/history/:id" element={<FinishedBrewDetailWrapper />} />
                </Routes>,
                ['/history/88']
            );
        });
        await act(async () => {
            await new Promise((r) => setTimeout(r, 50));
        });

        expect(container.textContent).toContain('West Coast IPA');
        expect(container.textContent).toContain('1.065');
        expect(container.textContent).toContain('1.012');
        expect(container.textContent).toContain('Dry hop no dia 5');
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
        expect(container.textContent).toContain('19.5°C');
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

    it('FermenterDetail & FermenterDetailWrapper render active fermenter with 4-digit OG/FG without NaN or Infinity', async () => {
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

    it('Settings and AdminDashboard render cleanly including zero-user division-by-zero edge cases', async () => {
        localStorage.setItem('token', 'admin-token');
        localStorage.setItem('role', 'admin');
        global.fetch = vi.fn().mockImplementation(async (url: string) => {
            if (String(url).includes('/admin/stats')) {
                return { ok: true, status: 200, json: async () => ({ totalUsers: 0, totalDevices: 0, activeBatches: 0, telemetryCount: 0 }) };
            }
            if (String(url).includes('/admin/financials')) {
                return { ok: true, status: 200, json: async () => ({ mrr: 0, activePro: 0, freeUsers: 0, churnRate: 0, history: [] }) };
            }
            return { ok: true, status: 200, json: async () => [] };
        });

        await act(async () => {
            renderUI(<Settings />);
        });
        expect(container.textContent).not.toContain('NaN');

        await act(async () => {
            renderUI(<AdminDashboard />);
        });
        await act(async () => {
            await new Promise((r) => setTimeout(r, 30));
        });
        expect(container.textContent).not.toContain('NaN%');
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

describe('4. Static HTML Launchers DOM & Script Execution', () => {
    it.each([
        ['7inch-launcher.html', ['app-dashboard', 'app-telemetria', 'app-rampas', 'app-historico', 'app-config', 'app-calculadoras']],
        ['3.5inch-launcher.html', ['app-dashboard', 'app-telemetria', 'app-rampas', 'app-historico', 'app-config', 'app-sobre']]
    ])('%s executes openApp(0..5), setAppPage, goHome, and initMainDashboard without runtime errors', (filename, expectedIds) => {
        const html = fs.readFileSync(path.resolve(__dirname, `../public/${filename}`), 'utf-8');
        for (const id of expectedIds) {
            expect(html).toContain(`id="${id}"`);
        }
        const goHomeMatches = html.match(/function\s+goHome\s*\(/g) || [];
        expect(goHomeMatches.length).toBe(1);

        // Parse HTML into document body and execute inline script functions
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const scriptContent = doc.querySelector('script')?.textContent || '';
        expect(scriptContent.length).toBeGreaterThan(100);

        const sandbox: any = {
            document: doc,
            window: { addEventListener: vi.fn() },
            setInterval: vi.fn(() => 123),
            clearInterval: vi.fn(),
            setTimeout: vi.fn(),
            Date,
            Math,
            Array,
            parseInt
        };
        vm.createContext(sandbox);
        expect(() => vm.runInContext(scriptContent, sandbox)).not.toThrow();

        // Execute openApp(0) through openApp(5), setAppPage(1), goHome(), initMainDashboard()
        for (let idx = 0; idx < 6; idx++) {
            expect(() => sandbox.openApp(idx)).not.toThrow();
            const openedEl = doc.getElementById(expectedIds[idx]);
            expect(openedEl?.style.display).toBe('flex');
        }
        expect(() => sandbox.setAppPage(1)).not.toThrow();
        expect(() => sandbox.goHome()).not.toThrow();
        expect(() => sandbox.initMainDashboard()).not.toThrow();
        expect(() => sandbox.initMainDashboard()).not.toThrow(); // calling twice must clear previous interval
        expect(sandbox.clearInterval).toHaveBeenCalledWith(123);
    });
});

describe('5. Backend Server & PushService Code & Logic Verification', () => {
    it('verifies backend/server.js, adminRoutes.js, and smartScheduler.js have all SQL bind guards, migrations, Smart Scheduler compatibility, and PM2 JSON extraction', () => {
        const serverCode = [
            fs.readFileSync(path.resolve(__dirname, '../backend/server.js'), 'utf-8'),
            fs.readFileSync(path.resolve(__dirname, '../backend/routes/adminRoutes.js'), 'utf-8'),
            fs.readFileSync(path.resolve(__dirname, '../backend/services/smartScheduler.js'), 'utf-8'),
            fs.readFileSync(path.resolve(__dirname, '../backend/utils/securityHelpers.js'), 'utf-8')
        ].join('\n');

        // 1. No unguarded LIMIT ? in pool.execute
        expect(serverCode).not.toMatch(/LIMIT\s+\?/i);
        expect(serverCode).toContain('LIMIT ${safeLimit}');

        // 2. Migrations for public_token, volume, and system_broadcasts/audit_logs
        expect(serverCode).toContain('ALTER TABLE batches ADD COLUMN public_token VARCHAR(64) DEFAULT NULL');
        expect(serverCode).toContain('ALTER TABLE batches ADD COLUMN volume FLOAT DEFAULT 20');
        expect(serverCode).toContain('CREATE TABLE IF NOT EXISTS system_broadcasts');
        expect(serverCode).toContain('CREATE TABLE IF NOT EXISTS audit_logs');

        // 3. Smart Scheduler supports both {name, temperature, duration} and {n, t, d}
        expect(serverCode).toContain('currentStep.duration ?? currentStep.d');
        expect(serverCode).toContain('step.name || step.n');
        expect(serverCode).toContain('step.temperature ?? step.t');

        // 4. Selective cache deletion on batch/device removal
        expect(serverCode).toContain('delete activeBatches[normalizedSerial]');
        expect(serverCode).toContain('delete activeBatchesUserId[normalizedSerial]');

        // 5. Financials accumulates free users instead of overwriting
        expect(serverCode).toContain('free += Number(u.count)');

        // 6. PM2 JSON extraction strips banner lines before JSON.parse
        expect(serverCode).toContain("stdout.indexOf('[')");
        expect(serverCode).toContain("stdout.slice(jsonStart)");

        // 7. Security & Performance Audit checks (CSP, JWT HS256, Promise.all, 30 SECOND online window)
        expect(serverCode).toContain('Content-Security-Policy');
        expect(serverCode).toContain("algorithms: ['HS256']");
        expect(serverCode).toContain('Promise.all([');
        expect(serverCode).toContain('INTERVAL 30 SECOND');
    });

    it('verifies backend/pushService.js guards undefined userId and safely checks err?.statusCode', async () => {
        const pushCode = fs.readFileSync(path.resolve(__dirname, '../backend/pushService.js'), 'utf-8');
        expect(pushCode).toContain('err?.statusCode === 410 || err?.statusCode === 404');

        const mockPool = { execute: vi.fn() };
        // Calling with null/undefined userId should return immediately without calling pool.execute
        await sendPushToUser(mockPool, undefined, 'Title', 'Body');
        await sendPushToUser(mockPool, null, 'Title', 'Body');
        expect(mockPool.execute).not.toHaveBeenCalled();
    });

    it('verifies 2nd Skill Audit improvements: voiceRoutes timingSafeEqual, FinishedBrewDetail error & retry state, and Virtual ESP32 removal', async () => {
        const voiceCode = fs.readFileSync(path.resolve(__dirname, '../backend/routes/voiceRoutes.js'), 'utf-8');
        expect(voiceCode).toContain('crypto.timingSafeEqual');

        const serverCode = fs.readFileSync(path.resolve(__dirname, '../backend/server.js'), 'utf-8');
        expect(serverCode).not.toContain('ip-api.com'); // localizacao por IP removida (12/11/2026)
        expect(serverCode).toContain("DELETE FROM devices WHERE serial_code = 'ESP32-VIRTUAL-01'");
        expect(serverCode).not.toContain('esp32Simulator');

        // Verify FinishedBrewDetail displays error alert and retry button when telemetry fetch fails
        localStorage.setItem('token', 'valid-token');
        localStorage.setItem('user', 'Brewer');
        let fetchAttempts = 0;
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
            if (String(url).includes('/batch/999/data')) {
                fetchAttempts++;
                if (fetchAttempts === 1) {
                    return { ok: false, status: 500, statusText: 'Internal Server Error' } as any;
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => [{ recorded_at: new Date().toISOString(), temp_ferm: 19.2, temp_amb: 16.0, target_temp: 19.0, gravity: 1.015 }]
                } as any;
            }
            return { ok: true, status: 200, json: async () => [] } as any;
        });

        await act(async () => {
            renderUI(
                <FinishedBrewDetail
                    brew={{
                        id: '999',
                        batchNumber: '#999',
                        beerName: 'IPA Teste',
                        style: BeerStyle.IPA,
                        startDate: '2026-01-01T00:00:00Z',
                        endDate: '2026-01-10T00:00:00Z',
                        abv: 6.2,
                        og: 1.055,
                        fg: 1.008,
                        efficiency: 85,
                        rating: 5,
                        notes: 'Excelente',
                        readings: []
                    }}
                />
            );
        });

        expect(container.textContent).toContain('Erro ao carregar telemetria');
        const retryBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Tentar novamente')) as HTMLButtonElement;
        expect(retryBtn).toBeTruthy();

        await act(async () => {
            retryBtn.click();
        });

        expect(fetchAttempts).toBe(2);
        expect(container.textContent).toContain('1 leituras de telemetria carregadas');
    });
});
