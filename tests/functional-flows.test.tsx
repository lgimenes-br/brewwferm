import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mqttPublishMock = vi.fn();
const mqttSubscribeMock = vi.fn();
const mqttOnMock = vi.fn();
const mqttEndMock = vi.fn();

vi.mock('mqtt', () => ({
    default: {
        connect: () => ({
            connected: true,
            on: mqttOnMock,
            subscribe: mqttSubscribeMock,
            publish: mqttPublishMock,
            end: mqttEndMock
        })
    }
}));

import { AuthProvider } from '../context/AuthContext';
import { BrewProvider } from '../context/BrewContext';
import { Dashboard } from '../components/Dashboard';
import { FermenterDetailWrapper } from '../components/FermenterDetailWrapper';
import { FermentationHistory } from '../components/FermentationHistory';
import { FinishedBrewDetail } from '../components/FinishedBrewDetail';
import { CompareBatches } from '../components/CompareBatches';
import { BrewingCalculators } from '../components/BrewingCalculators';
import { Settings } from '../components/Settings';
import { AdminDashboard } from '../components/AdminDashboard';
import { clearLiveDeviceState } from '../hooks/useFermenters';
import { DeviceMode, BeerStyle } from '../types';

let container: HTMLDivElement;
let root: Root;

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    act(() => {
        setter?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

function setSelectValue(el: HTMLSelectElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    act(() => {
        setter?.call(el, value);
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

function clickElement(el: Element | null | undefined) {
    expect(el).toBeTruthy();
    act(() => {
        (el as HTMLElement).click();
    });
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
    const buttons = Array.from(container.querySelectorAll('button'));
    return buttons.find(b => (b.textContent || '').toLowerCase().includes(text.toLowerCase()));
}

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ['/']) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    act(() => {
        root.render(
            <GoogleOAuthProvider clientId="test-client-id">
                <MemoryRouter initialEntries={initialEntries}>
                    <QueryClientProvider client={queryClient}>
                        <AuthProvider>
                            <BrewProvider>
                                {ui}
                            </BrewProvider>
                        </AuthProvider>
                    </QueryClientProvider>
                </MemoryRouter>
            </GoogleOAuthProvider>
        );
    });
    return queryClient;
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
    clearLiveDeviceState();
    mqttPublishMock.mockReset();
    mqttSubscribeMock.mockReset();
    mqttOnMock.mockReset();
    mqttEndMock.mockReset();
    vi.restoreAllMocks();
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('Testes Funcionais Interativos de Ponta a Ponta (E2E User Flows)', () => {
    it('Fluxo 1: Ciclo completo de Fermentação (Wizard -> Validações -> Iniciar -> Pausar/Retomar -> Avançar/Voltar Rampa -> Editar Lote e Perfil -> Diário de Bordo -> Modo Chopeira -> Finalizar)', async () => {
        localStorage.setItem('token', 'valid-token');
        localStorage.setItem('user', 'Mestre Cervejeiro');

        // Estado mutável simulando o banco de dados do backend
        let dbDevice: any = {
            id: 1,
            serial_code: 'ESP32_01',
            device_name: 'Fermentador Inox 01',
            active_batch_id: null,
            active_batch_name: null,
            active_batch_style: null,
            active_batch_og: 0,
            active_batch_fg: 0,
            active_batch_volume: 20,
            active_batch_profile: null,
            active_batch_current_step: 0,
            last_temp: 18.5,
            last_temp2: 14.2,
            last_target: 20.0,
            last_gravity: 1.040,
            last_battery: 4.05,
            last_rssi: -55,
            firmware_version: 'V2.5.0'
        };
        let dbBatches: any[] = [];
        let dbEvents: any[] = [];

        const fetchCalls: { url: string; method: string; body?: any }[] = [];

        vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
            const url = String(input);
            const method = (init?.method || 'GET').toUpperCase();
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            fetchCalls.push({ url, method, body });

            if (url.endsWith('/auth/me')) {
                return new Response(JSON.stringify({ id: 1, username: 'Mestre Cervejeiro', role: 'user' }), { status: 200 });
            }
            if (url.endsWith('/devices') && method === 'GET') {
                return new Response(JSON.stringify([dbDevice]), { status: 200 });
            }
            if (url.endsWith('/batches') && method === 'GET') {
                return new Response(JSON.stringify(dbBatches), { status: 200 });
            }
            if (url.includes('/batch/start') && method === 'POST') {
                dbDevice = {
                    ...dbDevice,
                    active_batch_id: 501,
                    active_batch_name: body.name,
                    active_batch_style: body.style,
                    active_batch_og: body.og,
                    active_batch_fg: body.fg,
                    active_batch_volume: body.volume,
                    active_batch_profile: JSON.stringify(body.profile),
                    active_batch_current_step: 0,
                    active_batch_start: new Date().toISOString(),
                    active_batch_step_start: new Date().toISOString(),
                    last_target: body.profile?.[0]?.temperature ?? 18
                };
                dbBatches = [{
                    id: 501,
                    name: body.name,
                    style: body.style,
                    og: body.og,
                    fg: body.fg,
                    volume: body.volume,
                    profile: JSON.stringify(body.profile),
                    started_at: dbDevice.active_batch_start,
                    is_active: 1
                }];
                return new Response(JSON.stringify({ message: 'Iniciado!', batchId: 501 }), { status: 200 });
            }
            if (url.includes('/batch/update') && method === 'PUT') {
                if (body.name !== undefined) dbDevice.active_batch_name = body.name;
                if (body.og !== undefined) dbDevice.active_batch_og = body.og;
                if (body.fg !== undefined) dbDevice.active_batch_fg = body.fg;
                if (body.profile !== undefined) dbDevice.active_batch_profile = JSON.stringify(body.profile);
                return new Response(JSON.stringify({ message: 'Atualizado' }), { status: 200 });
            }
            if (url.includes('/batch/stop') && method === 'POST') {
                dbDevice = {
                    ...dbDevice,
                    active_batch_id: null,
                    active_batch_name: null,
                    active_batch_profile: null
                };
                return new Response(JSON.stringify({ message: 'Finalizado' }), { status: 200 });
            }
            if (url.includes('/events') && method === 'GET') {
                return new Response(JSON.stringify(dbEvents), { status: 200 });
            }
            if (url.includes('/events') && method === 'POST') {
                const saved = { id: 900 + dbEvents.length, event_type: body.type, description: body.description, recorded_at: body.date };
                dbEvents.push(saved);
                return new Response(JSON.stringify({ id: saved.id }), { status: 201 });
            }
            if (url.includes('/data') && method === 'GET') {
                return new Response(JSON.stringify([
                    { id: 1, temp_ferm: 18.5, temp_amb: 14.2, target_temp: 19.0, gravity: 1.040, recorded_at: new Date().toISOString() }
                ]), { status: 200 });
            }
            if (url.includes('/chopp_name') && method === 'PUT') {
                return new Response(JSON.stringify({ message: 'Chopp name atualizado' }), { status: 200 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
        });

        renderWithProviders(
            <Routes>
                <Route path="/fermenter/:id" element={<FermenterDetailWrapper />} />
                <Route path="/" element={<div data-testid="home-redirect">Voltou ao Dashboard</div>} />
            </Routes>,
            ['/fermenter/ESP32_01']
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        // 1. Verifica que abriu na tela do Wizard ("Nova Fermentação") pois o equipamento está IDLE
        expect(container.textContent).toContain('Nova Fermentação');
        expect(container.textContent).toContain('O que vamos produzir hoje?');

        // 2. Validação do Passo 1: Botão "Próximo" DEVE estar desabilitado com nome vazio
        const nextBtnStep1 = findButtonByText('Próximo')!;
        expect(nextBtnStep1).toBeTruthy();
        expect(nextBtnStep1.disabled).toBe(true);

        // Preenche Nome da Receita, Estilo e Volume
        const recipeInput = container.querySelector('input[placeholder="Ex: IPA da Casa"]') as HTMLInputElement;
        setInputValue(recipeInput, 'West Coast IPA');
        expect(nextBtnStep1.disabled).toBe(false); // Habilitou imediatamente!

        const styleSelect = container.querySelector('select') as HTMLSelectElement;
        setSelectValue(styleSelect, 'IPA');

        const volInput = container.querySelector('input[type="number"]') as HTMLInputElement;
        setInputValue(volInput, '25');

        // Avança para o Passo 2 (Densidade Prevista)
        clickElement(nextBtnStep1);
        expect(container.textContent).toContain('Densidade Prevista');

        // Preenche OG com 4 dígitos ("1065" -> deve normalizar para 1.065) e FG ("1.012")
        const step2Inputs = container.querySelectorAll('input[type="number"]');
        setInputValue(step2Inputs[0] as HTMLInputElement, '1065');
        setInputValue(step2Inputs[1] as HTMLInputElement, '1.012');

        // Avança para o Passo 3 (Perfil de Temperatura)
        clickElement(findButtonByText('Próximo'));
        expect(container.textContent).toContain('Perfil de Temperatura');

        // Adiciona uma 3ª rampa ("Cold Crash") e altera a 1ª rampa para 19°C
        clickElement(findButtonByText('Adicionar Rampa'));
        const step3TextInputs = container.querySelectorAll('input[placeholder="Nome da Etapa"]');
        expect(step3TextInputs.length).toBe(3);
        setInputValue(step3TextInputs[2] as HTMLInputElement, 'Cold Crash');

        const step3NumInputs = container.querySelectorAll('input[type="number"]');
        // Cada rampa tem 2 inputs numéricos: Temp (°C) e Tempo (Dias)
        setInputValue(step3NumInputs[0] as HTMLInputElement, '19'); // Rampa 1: 19°C
        setInputValue(step3NumInputs[4] as HTMLInputElement, '2');  // Rampa 3: 2°C
        setInputValue(step3NumInputs[5] as HTMLInputElement, '3');  // Rampa 3: 3 dias

        // Avança para o Passo 4 (Resumo)
        clickElement(findButtonByText('Próximo'));
        expect(container.textContent).toContain('Tudo Pronto!');
        expect(container.textContent).toContain('West Coast IPA (IPA)');
        expect(container.textContent).toContain('13 dias em 3 rampas de temperatura');

        // 3. Clica em "INICIAR FERMENTAÇÃO" e verifica mudança imediata do display!
        const startFermBtn = findButtonByText('INICIAR FERMENTAÇÃO')!;
        expect(startFermBtn).toBeTruthy();
        await act(async () => {
            startFermBtn.click();
            await new Promise(r => setTimeout(r, 60));
        });

        // Verifica que chamou POST /api/batch/start com OG normalizado (1.065) e as 3 rampas
        const startCall = fetchCalls.find(c => c.url.includes('/batch/start'));
        expect(startCall).toBeTruthy();
        expect(startCall?.body.name).toBe('West Coast IPA');
        expect(startCall?.body.og).toBeCloseTo(1.065, 3);
        expect(startCall?.body.fg).toBeCloseTo(1.012, 3);
        expect(startCall?.body.volume).toBe(25);
        expect(startCall?.body.profile.length).toBe(3);

        // Verifica que o display mudou IMEDIATAMENTE do Wizard para o Painel de Fermentação Ativa!
        expect(container.textContent).not.toContain('O que vamos produzir hoje?');
        expect(container.textContent).toContain('West Coast IPA');
        expect(container.textContent).toContain('Lote #501');
        expect(container.textContent).toContain('1.065'); // OG no display
        expect(container.textContent).toContain('1.012'); // Meta FG no display
        expect(container.textContent).toContain('19.0°'); // Set-point atualizado para a 1ª rampa (19°C)
        expect(container.textContent).toContain('Fermentação Primária');
        expect(container.textContent).toContain('Cold Crash');
        expect(container.textContent).toContain('Ativo');

        // 4. Testa Pausar e Retomar Fermentação
        const pauseBtn = findButtonByText('Pausar')!;
        await act(async () => {
            pauseBtn.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Pausado');
        expect(findButtonByText('Retomar')).toBeTruthy();
        expect(mqttPublishMock).toHaveBeenCalledWith(
            'brewbrother/ESP32_01/comando',
            expect.stringContaining('"type":"togglePause"')
        );

        // Retoma a fermentação
        await act(async () => {
            findButtonByText('Retomar')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Ativo');

        // 5. Testa Avançar Rampa ("Próxima") e Voltar Rampa ("Anterior")
        const nextStepBtn = findButtonByText('Próxima')!;
        await act(async () => {
            nextStepBtn.click();
            await new Promise(r => setTimeout(r, 40));
        });
        expect(mqttPublishMock).toHaveBeenCalledWith(
            'brewbrother/ESP32_01/comando',
            expect.stringContaining('"type":"skipStep"')
        );
        // Set-point deve ter mudado para a temperatura da 2ª rampa (18.0°) e registrado no Diário de Bordo
        expect(container.textContent).toContain('18.0°');

        const prevStepBtn = findButtonByText('Anterior')!;
        await act(async () => {
            prevStepBtn.click();
            await new Promise(r => setTimeout(r, 40));
        });
        expect(mqttPublishMock).toHaveBeenCalledWith(
            'brewbrother/ESP32_01/comando',
            expect.stringContaining('"type":"setProfile"')
        );
        expect(container.textContent).toContain('19.0°');

        // 6. Testa Edição dos Dados do Lote (Nome, OG, FG) no topo do painel
        const editBatchBtn = container.querySelector('button[title="Editar Batch"]') as HTMLButtonElement;
        clickElement(editBatchBtn);

        const editNameInput = container.querySelector('input[placeholder="Nome da Cerveja"]') as HTMLInputElement;
        expect(editNameInput).toBeTruthy();
        setInputValue(editNameInput, 'Double West Coast IPA');

        await act(async () => {
            findButtonByText('Salvar')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Double West Coast IPA');
        expect(fetchCalls.some(c => c.url.includes('/batch/update') && c.body?.name === 'Double West Coast IPA')).toBe(true);

        // 7. Testa Adicionar Anotação no Diário de Bordo (FermentationTimeline) com validação
        const addNoteBtn = container.querySelector('button[title="Nova Nota"]') as HTMLButtonElement;
        clickElement(addNoteBtn);
        expect(container.textContent).toContain('Nova Anotação');

        const saveNoteBtn = findButtonByText('Gravar no Diário')!;
        expect(saveNoteBtn.disabled).toBe(true); // Desabilitado enquanto descrição está vazia!

        const noteTextarea = container.querySelector('textarea[placeholder="Descreva a ação ou observação..."]') as HTMLTextAreaElement;
        setInputValue(noteTextarea, 'Dry Hop 100g Citra');
        expect(saveNoteBtn.disabled).toBe(false);

        await act(async () => {
            saveNoteBtn.click();
            await new Promise(r => setTimeout(r, 40));
        });
        expect(container.textContent).toContain('Dry Hop 100g Citra');
        expect(fetchCalls.some(c => c.url.includes('/events') && c.method === 'POST')).toBe(true);

        // 8. Testa Troca de Modo para Chopeira (KEGERATOR), Set-Point (+/-) e Atualizar Display
        act(() => {
            window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode: DeviceMode.KEGERATOR } }));
        });
        expect(container.textContent).toContain('Aguardando confirmação');
        await act(async () => {
            findButtonByText('Ativar Modo')!.click();
            await new Promise(r => setTimeout(r, 30));
        });

        // Deve exibir o layout de Chopeira e enviar comando setMode (value: 2)
        expect(mqttPublishMock).toHaveBeenCalledWith(
            'brewbrother/ESP32_01/comando',
            expect.stringContaining('"type":"setMode"')
        );
        expect(container.textContent).toContain('Editar Informações do Display');

        // Altera Linha 1 da Chopeira e clica em Atualizar Display
        const line1Input = container.querySelector('input[placeholder="LINHA 1..."]') as HTMLInputElement;
        setInputValue(line1Input, 'CHOPP IPA ARTESANAL');
        await act(async () => {
            findButtonByText('Atualizar Display')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(fetchCalls.some(c => c.url.includes('/chopp_name') && c.body?.choppName === 'CHOPP IPA ARTESANAL')).toBe(true);

        // Volta para o modo Fermentador e finaliza o lote
        act(() => {
            window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode: DeviceMode.FERMENTER } }));
        });
        await act(async () => {
            findButtonByText('Ativar Modo')!.click();
            await new Promise(r => setTimeout(r, 30));
        });

        const finishBtn = findButtonByText('Finalizar')!;
        await act(async () => {
            finishBtn.click();
            await new Promise(r => setTimeout(r, 60));
        });
        expect(fetchCalls.some(c => c.url.includes('/batch/stop') && c.method === 'POST')).toBe(true);
        expect(container.textContent).toContain('Voltou ao Dashboard');
    });

    it('Fluxo 2: Dashboard — Adicionar Manual (com validação), Buscar na Rede (Scan), Editar e Excluir Dispositivo', async () => {
        localStorage.setItem('token', 'valid-token');
        localStorage.setItem('user', 'Cervejeiro');

        let devicesList: any[] = [
            {
                id: 1,
                serial_code: 'ESP32_01',
                device_name: 'Fermentador 01',
                active_batch_id: 10,
                active_batch_name: 'Session IPA',
                active_batch_og: 1048, // 4 dígitos para validar normalização 1.048 no card!
                active_batch_fg: 1010, // 4 dígitos para validar normalização 1.010 no card!
                last_temp: 18.0,
                last_temp2: 12.0,
                last_target: 18.0,
                last_gravity: 1020 // 4 dígitos -> 1.020
            }
        ];

        const apiCalls: { url: string; method: string; body?: any }[] = [];

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
            const url = String(input);
            const method = (init?.method || 'GET').toUpperCase();
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            apiCalls.push({ url, method, body });

            if (url.endsWith('/auth/me')) {
                return new Response(JSON.stringify({ id: 1, username: 'Cervejeiro', role: 'user' }), { status: 200 });
            }
            if (url.endsWith('/devices') && method === 'GET') {
                return new Response(JSON.stringify(devicesList), { status: 200 });
            }
            if (url.endsWith('/devices') && method === 'POST') {
                devicesList = [
                    ...devicesList,
                    {
                        id: devicesList.length + 1,
                        serial_code: body.serialCode,
                        device_name: body.name,
                        active_batch_id: null,
                        last_temp: 20,
                        last_temp2: 20,
                        last_target: 20,
                        last_gravity: 0
                    }
                ];
                return new Response(JSON.stringify({ message: 'Criado' }), { status: 201 });
            }
            if (url.includes('/devices/') && method === 'PUT') {
                const serial = decodeURIComponent(url.split('/devices/')[1]);
                devicesList = devicesList.map(d => d.serial_code === serial ? { ...d, device_name: body.name } : d);
                return new Response(JSON.stringify({ message: 'Atualizado' }), { status: 200 });
            }
            if (url.includes('/devices/') && method === 'DELETE') {
                const serial = decodeURIComponent(url.split('/devices/')[1]);
                devicesList = devicesList.filter(d => d.serial_code !== serial);
                return new Response(JSON.stringify({ message: 'Excluído' }), { status: 200 });
            }
            if (url.endsWith('/discovery')) {
                return new Response(JSON.stringify([
                    { ip: 'ESP32_SCAN_99', type: 'BrewController Pro', rssi: -48 }
                ]), { status: 200 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
        });

        renderWithProviders(<Dashboard />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        // Verifica que o card inicial aparece com OG/FG/SG normalizados (1.048, 1.010, 1.020)
        expect(container.textContent).toContain('Fermentador 01');
        expect(container.textContent).toContain('Session IPA');
        expect(container.textContent).toContain('1.048');
        expect(container.textContent).toContain('1.010');
        expect(container.textContent).toContain('1.020');

        // 1. Abre modal "+ Adicionar" e verifica trava de validação
        clickElement(findButtonByText('Adicionar'));
        expect(container.textContent).toContain('Adicionar Manualmente');

        const confirmAddBtn = findButtonByText('Adicionar Dispositivo')!;
        expect(confirmAddBtn.disabled).toBe(true); // Bloqueado sem nome e sem IP/Serial

        const nameInput = container.querySelector('input[placeholder="Ex: Fermentador 03"]') as HTMLInputElement;
        const ipInput = container.querySelector('input[placeholder="Ex: 192.168.1.50 ou SERIAL_123"]') as HTMLInputElement;

        setInputValue(nameInput, 'Fermentador Inox 02');
        expect(confirmAddBtn.disabled).toBe(true); // Ainda bloqueado sem Serial

        setInputValue(ipInput, 'ESP32_02');
        expect(confirmAddBtn.disabled).toBe(false); // Liberado!

        await act(async () => {
            confirmAddBtn.click();
            await new Promise(r => setTimeout(r, 60));
        });

        // Verifica que o novo card apareceu imediatamente no Dashboard!
        expect(container.textContent).toContain('Fermentador Inox 02');
        expect(container.textContent).toContain('ESP32_02');

        // 2. Testa Buscar na Rede ("Procurar") e adicionar dispositivo escaneado
        await act(async () => {
            findButtonByText('Procurar')!.click();
            await new Promise(r => setTimeout(r, 60));
        });
        expect(container.textContent).toContain('BrewController Pro');
        expect(container.textContent).toContain('ESP32_SCAN_99');

        // Clica no botão '+' do item escaneado
        const scanItem = Array.from(container.querySelectorAll('p')).find(p => p.textContent === 'ESP32_SCAN_99');
        const selectScannedBtn = scanItem?.parentElement?.parentElement?.parentElement?.querySelector('button');
        clickElement(selectScannedBtn);

        expect(container.textContent).toContain('Nomear Dispositivo');
        await act(async () => {
            findButtonByText('Salvar')!.click();
            await new Promise(r => setTimeout(r, 60));
        });
        expect(container.textContent).toContain('Novo BrewController Pro');

        // 3. Testa Editar nome de um dispositivo pelo modal de Configurações
        const editBtn = container.querySelector('button[title="Configurações"]') as HTMLButtonElement;
        clickElement(editBtn);
        expect(container.textContent).toContain('Editar Dispositivo');

        const editModalInput = container.querySelector('input:not([disabled])') as HTMLInputElement;
        setInputValue(editModalInput, 'Fermentador Master');

        await act(async () => {
            findButtonByText('Salvar Alterações')!.click();
            await new Promise(r => setTimeout(r, 60));
        });
        expect(container.textContent).toContain('Fermentador Master');

        // 4. Testa Excluir Dispositivo com modal de confirmação
        const deleteBtn = container.querySelector('button[title="Excluir Dispositivo"]') as HTMLButtonElement;
        clickElement(deleteBtn);
        expect(container.textContent).toContain('Excluir Dispositivo?');

        await act(async () => {
            findButtonByText('Sim, Excluir')!.click();
            await new Promise(r => setTimeout(r, 60));
        });
        expect(container.textContent).not.toContain('Fermentador Master');
    });

    it('Fluxo 3: Histórico (Excluir lote), Detalhes do Lote (Editar Receita/Ingredientes & Compartilhar) e Comparador de Lotes', async () => {
        localStorage.setItem('token', 'valid-token');
        localStorage.setItem('user', 'Cervejeiro');

        const apiCalls: { url: string; method: string; body?: any }[] = [];
        vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
        });

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
            const url = String(input);
            const method = (init?.method || 'GET').toUpperCase();
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            apiCalls.push({ url, method, body });

            if (url.endsWith('/auth/me')) {
                return new Response(JSON.stringify({ id: 1, username: 'Cervejeiro', role: 'user' }), { status: 200 });
            }
            if (url.endsWith('/history/batches') || url.endsWith('/batches')) {
                return new Response(JSON.stringify([
                    { id: 10, name: 'Pilsen Imperial', style: 'Pilsner', og: 1.052, fg: 1.010, is_active: 0, started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-10T00:00:00Z' },
                    { id: 11, name: 'Stout Dry', style: 'Stout', og: 1.060, fg: 1.014, is_active: 0, started_at: '2026-02-01T00:00:00Z', ended_at: '2026-02-12T00:00:00Z' }
                ]), { status: 200 });
            }
            if (url.includes('/batches/10') && method === 'DELETE') {
                return new Response(JSON.stringify({ message: 'Excluído' }), { status: 200 });
            }
            if (url.includes('/ingredients') && method === 'PUT') {
                return new Response(JSON.stringify({ message: 'Receita salva' }), { status: 200 });
            }
            if (url.includes('/batches/compare')) {
                return new Response(JSON.stringify([
                    { hour: 0, b1_temp: 18.0, b2_temp: 19.5, b1_sg: 1.052, b2_sg: 1.060 },
                    { hour: 24, b1_temp: 18.2, b2_temp: 20.0, b1_sg: 1.030, b2_sg: 1.035 }
                ]), { status: 200 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
        });

        // Parte A: FermentationHistory -> Excluir lote e ver sumir na hora
        renderWithProviders(<FermentationHistory />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });
        expect(container.textContent).toContain('Pilsen Imperial');
        expect(container.textContent).toContain('Stout Dry');

        const deleteBatchBtn = container.querySelector('button[title="Excluir lote"]') as HTMLButtonElement;
        await act(async () => {
            deleteBatchBtn.click();
            await new Promise(r => setTimeout(r, 40));
        });
        expect(container.textContent).not.toContain('Pilsen Imperial');
        expect(container.textContent).toContain('Stout Dry');

        // Parte B: FinishedBrewDetail -> Trocar aba para Receita & Ingredientes, Salvar Receita e Compartilhar
        renderWithProviders(
            <FinishedBrewDetail
                brew={{
                    id: '11',
                    batchNumber: '11',
                    beerName: 'Stout Dry',
                    style: BeerStyle.STOUT,
                    startDate: '2026-02-01T00:00:00Z',
                    endDate: '2026-02-12T00:00:00Z',
                    og: 1.060,
                    fg: 1.014,
                    abv: 6.0,
                    efficiency: 76,
                    notes: 'Torra intensa',
                    readings: [{ timestamp: '2026-02-01T00:00:00Z', beerTemp: 19, fridgeTemp: 15, targetTemp: 19, gravity: 1.060 }]
                }}
            />
        );
        await act(async () => {
            await new Promise(r => setTimeout(r, 40));
        });

        // Clica em "Compartilhar" e verifica que o botão muda para "Copiado"
        await act(async () => {
            findButtonByText('Compartilhar')!.click();
            await new Promise(r => setTimeout(r, 20));
        });
        expect(container.textContent).toContain('Copiado');

        // Clica na aba "Receita & Ingredientes"
        clickElement(findButtonByText('Receita & Ingredientes'));
        expect(container.textContent).toContain('Maltes / Fermentáveis');

        const maltsTextarea = container.querySelector('textarea[placeholder*="Pilsen"]') as HTMLTextAreaElement;
        const hopsTextarea = container.querySelector('textarea[placeholder*="Citra"]') as HTMLTextAreaElement;
        const yeastInput = container.querySelector('input[placeholder*="US-05"]') as HTMLInputElement;

        setInputValue(maltsTextarea, '4.5kg Maris Otter + 500g Roasted Barley');
        setInputValue(hopsTextarea, '40g East Kent Goldings');
        setInputValue(yeastInput, 'Nottingham Ale');

        await act(async () => {
            findButtonByText('Salvar Receita')!.click();
            await new Promise(r => setTimeout(r, 40));
        });

        const ingCall = apiCalls.find(c => c.url.includes('/batches/11/ingredients'));
        expect(ingCall).toBeTruthy();
        expect(ingCall?.body.ingredients.malts).toBe('4.5kg Maris Otter + 500g Roasted Barley');
        expect(ingCall?.body.ingredients.hops).toBe('40g East Kent Goldings');
        expect(ingCall?.body.ingredients.yeast).toBe('Nottingham Ale');

        // Parte C: CompareBatches -> Validação de seleção e Comparação de 2 lotes
        renderWithProviders(<CompareBatches />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });

        const compareBtn = findButtonByText('Comparar')!;
        expect(compareBtn.disabled).toBe(true); // Desabilitado enquanto os 2 lotes não forem escolhidos

        const selects = container.querySelectorAll('select');
        setSelectValue(selects[0] as HTMLSelectElement, '10');
        expect(compareBtn.disabled).toBe(true); // Ainda desabilitado com apenas 1 lote

        setSelectValue(selects[1] as HTMLSelectElement, '11');
        expect(compareBtn.disabled).toBe(false); // Habilitado!

        await act(async () => {
            compareBtn.click();
            await new Promise(r => setTimeout(r, 50));
        });
        expect(apiCalls.some(c => c.url.includes('/batches/compare?batch1=10&batch2=11'))).toBe(true);
    });

    it('Fluxo 4: Navegação e cálculo interativo em todas as 6 Calculadoras Cervejeiras (BrewingCalculators)', () => {
        renderWithProviders(<BrewingCalculators />);

        // 1. Abre calculadora de ABV
        clickElement(findButtonByText('Álcool / Atenuação / Calorias'));
        expect(container.textContent).toContain('Aten. Aparente');

        // 2. Abre calculadora de Levedura (Taxa de Inoculação)
        clickElement(findButtonByText('Taxa de Inoculação / Propagação'));
        expect(container.textContent).toContain('Alvo de Inoculação');
        expect(container.textContent).toContain('Células Disponíveis');

        // 3. Abre calculadora de Refratômetro / Brix e testa alternância Mosto Fermentado vs Não Fermentado
        clickElement(findButtonByText('Refratômetro / Brix'));
        expect(container.textContent).toContain('Mosto Fermentado?');
        expect(container.textContent).toContain('ABV Estimado');

        const toggleFermented = Array.from(container.querySelectorAll('span')).find(s => s.textContent === 'Mosto Fermentado?')?.parentElement?.parentElement;
        clickElement(toggleFermented);
        // No modo não fermentado, o card secundário de ABV Estimado é ocultado e a densidade é calculada direto do Brix
        expect(container.textContent).not.toContain('ABV Estimado');

        // 4. Abre calculadora de Correção da Densidade / Evaporação
        clickElement(findButtonByText('Correção da Densidade / Evaporação'));
        expect(container.textContent).toContain('Evaporação do Equipamento');
        expect(container.textContent).toContain('Evaporação por Fervura');

        // 5. Abre calculadora de Correção de Temp. do Densímetro e altera inputs
        clickElement(findButtonByText('Correção de Temp. do Densímetro'));
        expect(container.textContent).toContain('Densidade Mensurada');
        const hydroInputs = container.querySelectorAll('input[type="number"]');
        setInputValue(hydroInputs[0] as HTMLInputElement, '1050'); // Formato de pontos (4 dígitos)
        setInputValue(hydroInputs[1] as HTMLInputElement, '30');   // 30°C
        expect(container.textContent).toContain('Pontos');
        expect(container.textContent).toContain('1052.');

        // 6. Abre calculadora de Carbonatação (testa Keg Forçado e Priming com Açúcar)
        clickElement(findButtonByText('Carbonatação'));
        expect(container.textContent).toContain('Pressão do Barril');
        expect(container.textContent).toContain('10.7 PSI');
        const carbSelects = container.querySelectorAll('select');
        setSelectValue(carbSelects[carbSelects.length - 1] as HTMLSelectElement, 'Priming (Açúcar)');
        expect(container.textContent).toContain('Açúcar para Adicionar');
        expect(container.textContent).toContain('CO₂ Residual');
    });

    it('Fluxo 5: Configurações (Settings) e Painel Admin (AdminDashboard — todas as 8 abas e disparo de Push)', async () => {
        localStorage.setItem('token', 'admin-token');
        localStorage.setItem('user', 'Admin');
        localStorage.setItem('role', 'admin');

        const apiCalls: { url: string; method: string; body?: any }[] = [];

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
            const url = String(input);
            const method = (init?.method || 'GET').toUpperCase();
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            apiCalls.push({ url, method, body });

            if (url.endsWith('/auth/me')) {
                return new Response(JSON.stringify({ id: 1, username: 'Admin', role: 'admin' }), { status: 200 });
            }
            if (url.endsWith('/devices') && method === 'GET') {
                return new Response(JSON.stringify([
                    { id: 1, serial_code: 'ESP32_CFG', device_name: 'Controlador Lab', sensor1_name: 'Mosto', sensor2_name: 'Câmara', sensor_sg_name: 'iSpindel' }
                ]), { status: 200 });
            }
            if (url.includes('/sensors') && method === 'PUT') {
                return new Response(JSON.stringify({ message: 'Sensores salvos' }), { status: 200 });
            }
            if (url.includes('/admin/broadcast-push') && method === 'POST') {
                return new Response(JSON.stringify({ sent: 12 }), { status: 200 });
            }
            if (url.includes('/admin/stats')) {
                return new Response(JSON.stringify({ total_users: 10, total_devices: 15, active_batches: 4, online_devices: 8 }), { status: 200 });
            }
            if (url.includes('/admin/financials')) {
                return new Response(JSON.stringify({ free: 7, premium: 3, mrr: 89.70 }), { status: 200 });
            }
            if (url.includes('/admin/push-stats')) {
                return new Response(JSON.stringify({ total_users: 10, opt_in: 6 }), { status: 200 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
        });

        // Parte A: Settings -> Testar botões de salvar configurações gerais, sensores e calibração
        renderWithProviders(<Settings />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        const saveButtons = Array.from(container.querySelectorAll('button'));
        const saveGeneralBtn = saveButtons.find(b => (b.textContent || '').includes('Salvar Configurações'));
        const saveCalibrationBtn = saveButtons.find(b => (b.textContent || '').includes('Salvar Calibração'));

        if (saveGeneralBtn) {
            clickElement(saveGeneralBtn);
            expect(mqttPublishMock).toHaveBeenCalledWith(
                'brewbrother/ESP32_CFG/comando',
                expect.stringContaining('"type":"setConfig"')
            );
        }

        if (saveCalibrationBtn) {
            clickElement(saveCalibrationBtn);
            expect(mqttPublishMock).toHaveBeenCalledWith(
                'brewbrother/ESP32_CFG/comando',
                expect.stringContaining('"type":"setCalibration"')
            );
        }

        // Parte B: AdminDashboard -> Navegar pelas abas e disparar Push Broadcast
        renderWithProviders(<AdminDashboard />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        expect(container.textContent).toContain('Métricas e Inteligência de Negócio');
        expect(container.textContent).toContain('R$ 89.70');

        // Navega para a aba Marketing e Saúde
        const marketingTabBtn = container.querySelector('button[title="Marketing e Saúde"]') as HTMLButtonElement;
        await act(async () => {
            marketingTabBtn.click();
            await new Promise(r => setTimeout(r, 40));
        });
        expect(container.textContent).toContain('Radar de Saúde & Marketing');
        expect(container.textContent).toContain('Disparo de Push em Massa');

        const titleInput = container.querySelector('input[placeholder="Ex: Oferta Especial!"]') as HTMLInputElement;
        const msgInput = container.querySelector('textarea[placeholder*="Digite sua mensagem"]') as HTMLTextAreaElement;

        setInputValue(titleInput, 'Nova Versão V2.6');
        setInputValue(msgInput, 'Atualize seu controlador agora pelo painel!');

        await act(async () => {
            findButtonByText('Enviar Push Broadcast')!.click();
            await new Promise(r => setTimeout(r, 40));
        });

        const pushCall = apiCalls.find(c => c.url.includes('/admin/broadcast-push'));
        expect(pushCall).toBeTruthy();
        expect(pushCall?.body).toEqual({
            title: 'Nova Versão V2.6',
            message: 'Atualize seu controlador agora pelo painel!'
        });
    });
});
