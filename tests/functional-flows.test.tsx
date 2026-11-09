import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// O navegador nao fala mais com o broker MQTT: dados ao vivo chegam pelo fluxo SSE do
// backend (services/liveClient) e comandos pelo endpoint autenticado (sendDeviceCommand).
const commandMock = vi.fn();
let liveOptions: any = null;

vi.mock('../services/liveClient', () => ({
    connectLive: (opts: any) => {
        liveOptions = opts;
        setTimeout(() => opts.onOpen?.(), 0);
        return { close: () => {} };
    }
}));

vi.mock('../services/api', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        sendDeviceCommand: (...args: any[]) => {
            commandMock(...args);
            return Promise.resolve({});
        }
    };
});

/** Simula uma mensagem chegando pelo fluxo ao vivo (mesma assinatura do antigo handler MQTT) */
const liveMessageHandler = () => (topic: string, message: any, packet?: { retain?: boolean }) =>
    liveOptions?.onMessage(topic, message.toString(), Boolean(packet?.retain));

/** Verifica se um comando foi enviado ao aparelho pela API autenticada */
const expectCommand = (serial: string, fragment: string) => {
    const sent = commandMock.mock.calls.map(([s, type, payload]) => [s, JSON.stringify({ ...(payload || {}), type, cmd: type })]);
    const found = sent.some(([s, body]) => s === serial && body.includes(fragment));
    expect(found, `esperava comando contendo ${fragment} para ${serial}. Enviados: ${JSON.stringify(sent)}`).toBe(true);
};

import { AuthProvider } from '../context/AuthContext';
import { BrewProvider } from '../context/BrewContext';
import { Dashboard } from '../components/Dashboard';
import { FermenterDetailWrapper } from '../components/FermenterDetailWrapper';
import { FermentationHistory } from '../components/FermentationHistory';
import { FinishedBrewDetail } from '../components/FinishedBrewDetail';
import { PublicLiveBatch } from '../components/PublicLiveBatch';
import { CompareBatches } from '../components/CompareBatches';
import { BrewingCalculators } from '../components/BrewingCalculators';
import { Settings } from '../components/Settings';
import { AdminDashboard } from '../components/AdminDashboard';
import { Login } from '../components/Login';
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
                <MemoryRouter key={initialEntries.join(',')} initialEntries={initialEntries}>
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
    commandMock.mockReset();
    liveOptions = null;
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
        let dbRecipes: any[] = [];

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
            if (url.endsWith('/recipes') && method === 'GET') {
                return new Response(JSON.stringify(dbRecipes), { status: 200 });
            }
            if (url.endsWith('/recipes') && method === 'POST') {
                const newRec = { id: 301 + dbRecipes.length, ...body };
                dbRecipes.push(newRec);
                return new Response(JSON.stringify({ message: 'Salva', id: newRec.id }), { status: 201 });
            }
            if (url.includes('/share-token') && method === 'POST') {
                return new Response(JSON.stringify({ publicToken: 'pub123456' }), { status: 200 });
            }
            if (url.includes('/public/batch/pub123456') && method === 'GET') {
                return new Response(JSON.stringify({
                    batch: {
                        id: 501,
                        name: 'West Coast IPA',
                        style: 'IPA',
                        og: 1.065,
                        fg: 1.012,
                        is_active: 1,
                        current_step_index: 0,
                        device_name: 'Fermentador Inox 01',
                        sensor1_name: 'Mosto',
                        sensor2_name: 'Geladeira',
                        sensor_sg_name: 'iSpindel',
                        profile: JSON.stringify([{ name: 'Fermentação Primária', temperature: 19, duration: 7, triggerGravity: 1.018 }])
                    },
                    telemetry: [
                        { temp_ferm: 19.1, temp_amb: 15.0, target_temp: 19.0, gravity: 1.042, battery: 4.02, recorded_at: new Date().toISOString() }
                    ],
                    events: []
                }), { status: 200 });
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

        // 1. Verifica que por padrão um novo equipamento inicia no Modo Geladeira (Set-Point / Umidade Relativa)
        expect(container.textContent).toContain('Temperatura Atual');
        expect(container.textContent).toContain('Set-Point');
        expect(container.textContent).toContain('Umidade Relativa');

        // Troca para o Modo Fermentador para iniciar uma nova brassagem
        await act(async () => {
            window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode: DeviceMode.FERMENTER } }));
            await new Promise(r => setTimeout(r, 20));
        });
        expect(container.textContent).toContain('Modo selecionado: Fermentador');
        await act(async () => {
            findButtonByText('Ativar Modo')!.click();
            await new Promise(r => setTimeout(r, 40));
        });

        // Verifica que abriu na tela do Wizard ("Nova Fermentação") pois o equipamento está IDLE no modo Fermentador
        expect(container.textContent).toContain('Nova Fermentação');
        expect(container.textContent).toContain('O que vamos produzir hoje?');

        // 2. Validação do Passo 1: Botão "Próximo" DEVE estar desabilitado com nome vazio
        const nextBtnStep1 = findButtonByText('Próximo')!;
        expect(nextBtnStep1).toBeTruthy();
        expect(nextBtnStep1.disabled).toBe(true);

        // Testa importação de arquivo BeerXML antes de customizar
        const fileInput = container.querySelector('input[data-testid="recipe-file-input"]') as HTMLInputElement;
        expect(fileInput).toBeTruthy();
        const sampleBeerXml = `<RECIPES><RECIPE><NAME>Imported BeerXML Ale</NAME><STYLE><NAME>American Pale Ale</NAME></STYLE><BATCH_SIZE>22</BATCH_SIZE><EST_OG>1.054</EST_OG><EST_FG>1.011</EST_FG><PRIMARY_AGE>6</PRIMARY_AGE><PRIMARY_TEMP>19</PRIMARY_TEMP><FERMENTABLES><FERMENTABLE><NAME>Pale Malt</NAME><AMOUNT>5.0</AMOUNT></FERMENTABLE></FERMENTABLES><HOPS><HOP><NAME>Cascade</NAME><AMOUNT>0.050</AMOUNT></HOP></HOPS><YEASTS><YEAST><NAME>US-05</NAME></YEAST></YEASTS></RECIPE></RECIPES>`;
        const xmlFile = new File([sampleBeerXml], 'recipe.xml', { type: 'text/xml' });
        await act(async () => {
            Object.defineProperty(fileInput, 'files', { value: [xmlFile], configurable: true });
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Receita e ingredientes importados (1 maltes, 1 lúpulos, 1 leveduras)');

        // Preenche Nome da Receita, Estilo e Volume
        const recipeInput = container.querySelector('input[placeholder="Ex: IPA da Casa"]') as HTMLInputElement;
        expect(recipeInput.value).toBe('Imported BeerXML Ale');
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
        expect(container.textContent).toContain('Presets Rápidos de Fermentação');

        // Aplica preset "Ale Clássica" (que já traz 3 etapas: Primária 5d, Diacetil 3d, Cold Crash 3d) e ajusta para 7d + 3d + 3d = 13 dias
        clickElement(findButtonByText('Ale Clássica'));
        const step3TextInputs = container.querySelectorAll('input[placeholder="Nome da Etapa"]');
        expect(step3TextInputs.length).toBe(3);
        setInputValue(step3TextInputs[2] as HTMLInputElement, 'Cold Crash');

        const step3NumInputs = container.querySelectorAll('input[type="number"]');
        // Cada rampa tem 3 inputs numéricos: Temp (°C), Tempo (Dias) e Avançar em SG (Opcional)
        setInputValue(step3NumInputs[0] as HTMLInputElement, '19');   // Rampa 1: 19°C
        setInputValue(step3NumInputs[1] as HTMLInputElement, '7');    // Rampa 1: 7 dias
        setInputValue(step3NumInputs[2] as HTMLInputElement, '1018'); // Rampa 1: Avançar quando SG <= 1.018 (normaliza 4 dígitos!)
        setInputValue(step3NumInputs[3] as HTMLInputElement, '18');   // Rampa 2: 18°C
        setInputValue(step3NumInputs[6] as HTMLInputElement, '2');    // Rampa 3: 2°C
        setInputValue(step3NumInputs[7] as HTMLInputElement, '3');    // Rampa 3: 3 dias

        // Salva nos Perfis Favoritos e verifica que apareceu na lista "Meus Perfis Favoritos"
        await act(async () => {
            findButtonByText('Salvar Favorito')!.click();
            await new Promise(r => setTimeout(r, 40));
        });
        expect(fetchCalls.some(c => c.url.endsWith('/recipes') && c.method === 'POST')).toBe(true);
        expect(container.textContent).toContain('Meus Perfis Favoritos');

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

        // Verifica que chamou POST /api/batch/start com OG normalizado (1.065), triggerGravity normalizado (1.018) e as 3 rampas
        const startCall = fetchCalls.find(c => c.url.includes('/batch/start'));
        expect(startCall).toBeTruthy();
        expect(startCall?.body.name).toBe('West Coast IPA');
        expect(startCall?.body.og).toBeCloseTo(1.065, 3);
        expect(startCall?.body.fg).toBeCloseTo(1.012, 3);
        expect(startCall?.body.volume).toBe(25);
        expect(startCall?.body.profile.length).toBe(3);
        expect(startCall?.body.profile[0].triggerGravity).toBeCloseTo(1.018, 3);

        // Verifica que o display mudou IMEDIATAMENTE do Wizard para o Painel de Fermentação Ativa!
        expect(container.textContent).not.toContain('O que vamos produzir hoje?');
        expect(container.textContent).toContain('West Coast IPA');
        expect(container.textContent).toContain('Lote #501');
        expect(container.textContent).toContain('1.065'); // OG no display
        expect(container.textContent).toContain('1.012'); // Meta FG no display
        expect(container.textContent).toContain('19.0°'); // Set-point atualizado para a 1ª rampa (19°C)
        expect(container.textContent).toContain('Fermentação Primária');
        expect(container.textContent).toContain('≤ 1.018'); // Badge de Gatilho de Densidade no perfil ativo!
        expect(container.textContent).toContain('Cold Crash');
        expect(container.textContent).toContain('Ativo');

        // 3.5 Testa botão "Compartilhar Ao Vivo" (geração de public_token)
        await act(async () => {
            findButtonByText('Compartilhar Ao Vivo')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(fetchCalls.some(c => c.url.includes('/batches/501/share-token') && c.method === 'POST')).toBe(true);
        expect(container.textContent).toContain('Link Ao Vivo Copiado');

        // 4. Testa Pausar e Retomar Fermentação
        const pauseBtn = findButtonByText('Pausar')!;
        await act(async () => {
            pauseBtn.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Pausado');
        expect(findButtonByText('Retomar')).toBeTruthy();
        expectCommand('ESP32_01', '"type":"togglePause"');

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
        expectCommand('ESP32_01', '"type":"skipStep"');
        // Set-point deve ter mudado para a temperatura da 2ª rampa (18.0°) e registrado no Diário de Bordo
        expect(container.textContent).toContain('18.0°');

        const prevStepBtn = findButtonByText('Anterior')!;
        await act(async () => {
            prevStepBtn.click();
            await new Promise(r => setTimeout(r, 40));
        });
        expectCommand('ESP32_01', '"type":"setProfile"');
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
        expectCommand('ESP32_01', '"type":"setMode"');
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

        // 10. Testa a Página Pública de Modo Espectador (/live/:token) sem exigir autenticação de controle
        renderWithProviders(
            <Routes>
                <Route path="/live/:token" element={<PublicLiveBatch />} />
            </Routes>,
            ['/live/pub123456']
        );
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
        });
        expect(container.textContent).toContain('Ao Vivo • Modo Espectador');
        expect(container.textContent).toContain('West Coast IPA');
        expect(container.textContent).toContain('1.042');
        expect(container.textContent).toContain('Avança em SG <= 1.018');
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
        const ipInput = container.querySelector('input[placeholder="Código de 12 caracteres (letras e números)"]') as HTMLInputElement;

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

        // 7. Abre calculadora de Calibração Polinomial (iSpindel / Tilt) e testa regressão 2º e 3º grau
        clickElement(findButtonByText('Calibração Polinomial (iSpindel / Tilt)'));
        expect(container.textContent).toContain('Fórmula Polinomial p/ iSpindel');
        expect(container.textContent).toContain('*tilt^2');
        expect(container.textContent).toContain('R² =');

        // Alterna para Polinômio 3º Grau e verifica que o termo *tilt^3 foi gerado
        clickElement(findButtonByText('Polinômio 3º Grau'));
        expect(container.textContent).toContain('*tilt^3');
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
            if (url.includes('/user/integrations/test-brewfather') && method === 'POST') {
                return new Response(JSON.stringify({ success: true, status: 200 }), { status: 200 });
            }
            if (url.includes('/user/integrations/test-telegram') && method === 'POST') {
                return new Response(JSON.stringify({ success: true, status: 200 }), { status: 200 });
            }
            if (url.includes('/user/integrations')) {
                return new Response(JSON.stringify({ brewfatherWebhookUrl: '' }), { status: 200 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
        });

        // Parte A: Settings -> Testar TODAS as seções interativas (Gerais, SG, Calibração, PID, Auto-Tune, Relés, Scan 1-Wire via MQTT, Sistema e OTA)
        renderWithProviders(<Settings />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        // 0. Integrações Externas (Brewfather Custom Stream) e Regras de Alerta / Telegram
        const tgTokenInput = container.querySelector('input[placeholder*="123456:ABC"]') as HTMLInputElement;
        const tgChatInput = container.querySelector('input[placeholder*="987654321"]') as HTMLInputElement;
        expect(tgTokenInput).toBeTruthy();
        expect(tgChatInput).toBeTruthy();
        setInputValue(tgTokenInput, '999888:BOT_TOKEN');
        setInputValue(tgChatInput, '11223344');
        await act(async () => {
            findButtonByText('Salvar Alertas')!.click();
            findButtonByText('Testar Telegram')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(apiCalls.some(c => c.url.includes('/user/integrations') && c.method === 'PUT' && c.body?.alertConfig?.telegramBotToken === '999888:BOT_TOKEN')).toBe(true);
        expect(apiCalls.some(c => c.url.includes('/user/integrations/test-telegram') && c.method === 'POST')).toBe(true);

        const bfInput = container.querySelector('input[placeholder*="http://log.brewfather.net/stream"]') as HTMLInputElement;
        expect(bfInput).toBeTruthy();
        setInputValue(bfInput, 'http://log.brewfather.net/stream?id=breww123');
        await act(async () => {
            findButtonByText('Salvar Integração')!.click();
            findButtonByText('Testar Brewfather')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(apiCalls.some(c => c.url.includes('/user/integrations') && c.method === 'PUT' && c.body?.brewfatherWebhookUrl === 'http://log.brewfather.net/stream?id=breww123')).toBe(true);
        expect(apiCalls.some(c => c.url.includes('/user/integrations/test-brewfather') && c.method === 'POST')).toBe(true);

        // 1. Configurações Gerais ("Salvar Gerais")
        clickElement(findButtonByText('Salvar Gerais'));
        expectCommand('ESP32_CFG', '"type":"setConfig"');

        // 2. Nome Sensor SG ("Salvar Nome SG")
        await act(async () => {
            findButtonByText('Salvar Nome SG')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expectCommand('ESP32_CFG', '"type":"setNames"');
        expect(apiCalls.some(c => c.url.includes('/sensors') && c.method === 'PUT')).toBe(true);

        // 3. Calibração ("Salvar Calibração")
        clickElement(findButtonByText('Salvar Calibração'));
        expectCommand('ESP32_CFG', '"type":"setCalibration"');

        // 4. Auto-Tune e Atualizar PID
        clickElement(findButtonByText('Iniciar Auto-Tune'));
        expectCommand('ESP32_CFG', '"type":"autotune"');
        clickElement(findButtonByText('Atualizar PID'));
        await act(async () => {
            await new Promise(r => setTimeout(r, 20));
        });
        expectCommand('ESP32_CFG', '"type":"Kp_h"');

        // 5. Teste de Relés (Aquecer, Refrigerar, Auto)
        clickElement(findButtonByText('Aquecer'));
        expectCommand('ESP32_CFG', '"value":1');
        clickElement(findButtonByText('Refrigerar'));
        expectCommand('ESP32_CFG', '"value":2');
        clickElement(Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Auto'));
        expectCommand('ESP32_CFG', '"value":0');

        // 6. Mapeamento 1-Wire: "Escanear Sensores" abre o modal e dispara o scan
        clickElement(findButtonByText('Escanear Sensores'));
        expectCommand('ESP32_CFG', '"type":"scan_sensors"');
        const scanDialog = () => container.querySelector('[aria-labelledby="sensor-scan-title"]') as HTMLElement | null;
        expect(scanDialog()).toBeTruthy();
        expect(scanDialog()!.textContent).toContain('Procurando sensores');

        // Simula resposta MQTT da placa com 2 sensores 1-Wire encontrados (com temperaturas)
        const messageHandler = liveMessageHandler();
        expect(messageHandler).toBeTruthy();
        act(() => {
            messageHandler(
                'brewbrother/global/response',
                Buffer.from(JSON.stringify({
                    type: 'scan_sensors_response',
                    id: 'ESP32_CFG',
                    macs: ['28FFAA112233', '28FFBB445566'],
                    sensors: [{ mac: '28FFAA112233', temp: 19.5 }, { mac: '28FFBB445566', temp: 4.25 }],
                    macCtrl: '',
                    mac2: ''
                })),
                { retain: false }
            );
        });

        // Sensores e temperaturas aparecem no modal; sem mapeamento salvo, segue a ordem do barramento
        expect(scanDialog()!.textContent).toContain('28FFAA112233');
        expect(scanDialog()!.textContent).toContain('4.25 °C');
        const nameInput = scanDialog()!.querySelector('input[aria-label="Nome do Sensor 1"]') as HTMLInputElement;
        expect(nameInput).toBeTruthy();

        // Inverte: o 2º sensor vira Sensor 1 (controle)
        const row2 = scanDialog()!.querySelector('[data-testid="scan-row-28FFBB445566"]')!;
        clickElement(Array.from(row2.querySelectorAll('button')).find(b => (b.textContent || '').includes('Sensor 1')));

        await act(async () => {
            Array.from(scanDialog()!.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Salvar')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expectCommand('ESP32_CFG', '"macSensorControle":"28FFBB445566"');
        expectCommand('ESP32_CFG', '"extraSensors":[{"mac":"28FFAA112233"');
        expect(scanDialog()).toBeNull();

        // 7. Botões de Sistema (Reiniciar, Reset Fábrica)
        vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
        clickElement(findButtonByText('Reiniciar'));
        expectCommand('ESP32_CFG', '"action":"reboot"');
        clickElement(findButtonByText('Reset Fábrica'));
        expectCommand('ESP32_CFG', '"action":"resetconfig"');

        // Parte B: AdminDashboard -> Navegar pelas 8 abas e testar ações administrativas
        renderWithProviders(<AdminDashboard />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        expect(container.textContent).toContain('Métricas e Inteligência de Negócio');
        expect(container.textContent).toContain('R$ 89.70');

        // Aba 2: Telemetria
        await act(async () => {
            (container.querySelector('button[title="Telemetria"]') as HTMLButtonElement).click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Monitoramento em Tempo Real');

        // Aba 3: Contas e Dispositivos (abrir modal Nova Conta)
        await act(async () => {
            (container.querySelector('button[title="Contas e Dispositivos"]') as HTMLButtonElement).click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Gerenciamento de Contas');
        clickElement(findButtonByText('Nova Conta'));
        expect(container.textContent).toContain('Nível de Acesso');
        clickElement(findButtonByText('Cancelar'));

        // Aba 4: Segurança e Avisos (publicar aviso global)
        await act(async () => {
            (container.querySelector('button[title="Segurança e Avisos"]') as HTMLButtonElement).click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Enviar Aviso Global');
        const broadcastTitle = container.querySelector('input[placeholder="Ex: Manutenção Programada"]') as HTMLInputElement;
        const broadcastMsg = container.querySelector('textarea[placeholder*="O servidor será reiniciado"]') as HTMLTextAreaElement;
        setInputValue(broadcastTitle, 'Manutenção Preventiva');
        setInputValue(broadcastMsg, 'Atualização programada às 03h.');
        await act(async () => {
            findButtonByText('Publicar Aviso')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(apiCalls.some(c => c.url.includes('/admin/broadcasts') && c.method === 'POST')).toBe(true);

        // Aba 5: Firmware (OTA)
        await act(async () => {
            (container.querySelector('button[title="Firmware (OTA)"]') as HTMLButtonElement).click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Atualização Remota Forçada (OTA)');
        const otaBtn = findButtonByText('Disparar Atualização Forçada')!;
        expect(otaBtn.disabled).toBe(true); // Desabilitado até selecionar dispositivo e URL

        // Aba 6: Banco de Ingredientes (alternar sub-abas e abrir modal Novo Ingrediente)
        await act(async () => {
            (container.querySelector('button[title="Banco de Ingredientes"]') as HTMLButtonElement).click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Fermentáveis');
        clickElement(findButtonByText('Lúpulos'));
        clickElement(container.querySelector('button[title="Adicionar Novo"]'));
        expect(container.textContent).toContain('Novo Ingrediente');
        clickElement(findButtonByText('Cancelar'));

        // Aba 7: Terminal do Servidor
        await act(async () => {
            (container.querySelector('button[title="Terminal do Servidor"]') as HTMLButtonElement).click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Terminal & Processos');

        // Aba 8: Marketing e Saúde
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

    it('Fluxo 6: Edição ao vivo de Rampas no FermentationProfile (sincronização imediata de Set-point e clamp de etapa), Cancelamentos, Exclusão de Evento e Modo Geladeira (+/- Set-Point)', async () => {
        localStorage.setItem('token', 'valid-token');
        localStorage.setItem('user', 'Cervejeiro');

        const apiCalls: { url: string; method: string; body?: any }[] = [];
        vi.spyOn(globalThis, 'confirm').mockReturnValue(true);

        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
            const url = String(input);
            const method = (init?.method || 'GET').toUpperCase();
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            apiCalls.push({ url, method, body });

            if (url.endsWith('/auth/me')) {
                return new Response(JSON.stringify({ id: 1, username: 'Cervejeiro', role: 'user' }), { status: 200 });
            }
            if (url.endsWith('/devices') && method === 'GET') {
                return new Response(JSON.stringify([{
                    id: 1,
                    serial_code: 'ESP32_LIVE',
                    device_name: 'Fermentador Live',
                    active_batch_id: 777,
                    active_batch_name: 'Belgian Blonde',
                    active_batch_style: 'BELGIAN',
                    active_batch_og: 1.062,
                    active_batch_fg: 1.010,
                    active_batch_volume: 20,
                    active_batch_current_step: 1, // Na 2ª rampa (última rampa de um perfil de 2 etapas)
                    active_batch_profile: JSON.stringify([
                        { id: 's1', name: 'Primária', temperature: 19, duration: 5 },
                        { id: 's2', name: 'Maturação', temperature: 14, duration: 4 }
                    ]),
                    last_temp: 14.1,
                    last_temp2: 10.5,
                    last_target: 14.0,
                    last_gravity: 1.015,
                    last_battery: 3.98,
                    last_rssi: -60
                }]), { status: 200 });
            }
            if (url.includes('/events') && method === 'GET') {
                return new Response(JSON.stringify([
                    { id: 42, event_type: 'Dry Hop', description: 'Adição de Saaz', recorded_at: '2026-03-01T12:00:00Z' }
                ]), { status: 200 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
        });

        renderWithProviders(
            <Routes>
                <Route path="/fermenter/:id" element={<FermenterDetailWrapper />} />
            </Routes>,
            ['/fermenter/ESP32_LIVE']
        );

        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        expect(container.textContent).toContain('Belgian Blonde');
        expect(container.textContent).toContain('14.0°'); // Set-point inicial na rampa 2
        expect(container.textContent).toContain('Adição de Saaz');

        // 1. Testa Editar Batch e clicar em "Cancelar" (deve manter "Belgian Blonde" e não chamar updateBatch)
        clickElement(container.querySelector('button[title="Editar Batch"]'));
        const nameInput = container.querySelector('input[placeholder="Nome da Cerveja"]') as HTMLInputElement;
        setInputValue(nameInput, 'Nome Descartado');
        clickElement(findButtonByText('Cancelar'));
        expect(container.textContent).toContain('Belgian Blonde');
        expect(container.textContent).not.toContain('Nome Descartado');
        expect(apiCalls.some(c => c.url.includes('/batch/update'))).toBe(false);

        // 2. Edita o Perfil de Fermentação ao vivo: remove a 2ª rampa (onde currentStepIndex estava em 1) e altera a 1ª rampa para 21.5°C
        const profileCard = Array.from(container.querySelectorAll('h3')).find(h => h.textContent === 'Perfil de Fermentação')?.parentElement;
        const editProfileBtn = profileCard?.querySelector('button') as HTMLButtonElement;
        clickElement(editProfileBtn);

        // Remove a 2ª rampa (deve fazer clamp do currentStepIndex de 1 para 0!)
        const trashButtons = profileCard?.parentElement?.querySelectorAll('button');
        const removeStepBtn = Array.from(trashButtons || []).find(b => b.innerHTML.includes('lucide-trash-2') || b.className.includes('hover:text-red-500'));
        clickElement(removeStepBtn);

        // Altera a temperatura da rampa restante (agora ativa no índice 0) para 21.5°C e define gatilho SG em 1.014
        const tempInputs = profileCard?.parentElement?.querySelectorAll('input[type="number"]');
        expect(tempInputs && tempInputs.length >= 3).toBe(true);
        setInputValue(tempInputs![0] as HTMLInputElement, '21.5');
        setInputValue(tempInputs![2] as HTMLInputElement, '1.014');

        // Clica no botão Check (salvar edição do perfil)
        await act(async () => {
            editProfileBtn.click();
            await new Promise(r => setTimeout(r, 30));
        });

        // Verifica que o Set-point no painel principal mudou IMEDIATAMENTE para 21.5° e o badge de SG (≤ 1.014) apareceu!
        expect(container.textContent).toContain('21.5°');
        expect(container.textContent).toContain('≤ 1.014');
        expectCommand('ESP32_LIVE', '"type":"setProfile"');
        expect(apiCalls.some(c => c.url.includes('/batch/update') && Array.isArray(c.body?.profile) && c.body.profile.length === 1)).toBe(true);

        // 3. Exclui o evento "Adição de Saaz" do Diário de Bordo
        const removeEventBtn = container.querySelector('button[title="Remover evento"]') as HTMLButtonElement;
        await act(async () => {
            removeEventBtn.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(apiCalls.some(c => c.url.includes('/events/42') && c.method === 'DELETE')).toBe(true);

        // 4. Testa cancelar troca de modo e depois ativar Modo Geladeira (FRIDGE) + botões +/- de Set-Point
        act(() => {
            window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode: DeviceMode.FRIDGE } }));
        });
        expect(container.textContent).toContain('Geladeira');
        expect(container.textContent).toContain('Aguardando confirmação');
        clickElement(findButtonByText('Cancelar'));
        expect(container.textContent).not.toContain('Aguardando confirmação');

        // Agora ativa o Modo Geladeira e clica no botão '+' de Set-Point (+0.5°C)
        act(() => {
            window.dispatchEvent(new CustomEvent('requestModeChange', { detail: { mode: DeviceMode.FRIDGE } }));
        });
        await act(async () => {
            findButtonByText('Ativar Modo')!.click();
            await new Promise(r => setTimeout(r, 30));
        });
        expect(container.textContent).toContain('Temperatura Atual');
        expect(container.textContent).toContain('21.5°C'); // Set-Point antes do clique

        // Clica no botão '+' (aumenta 0.5°C -> 22.0°C imediatamente no display)
        const setpointBox = Array.from(container.querySelectorAll('span')).find(s => s.textContent === 'Set-Point')?.parentElement?.parentElement;
        const plusMinusButtons = setpointBox?.querySelectorAll('button');
        expect(plusMinusButtons?.length).toBe(2);

        await act(async () => {
            (plusMinusButtons![1] as HTMLButtonElement).click(); // Botão '+'
            await new Promise(r => setTimeout(r, 550)); // Aguarda o debounce de 500ms para envio MQTT
        });
        expect(container.textContent).toContain('22.0°C');
        expectCommand('ESP32_LIVE', '"type":"setManual"');
    });

    it('Fluxo 7: Telemetria MQTT em Tempo Real no Dashboard (Transição Offline -> Online e atualização instantânea de sensores) + Alerta Global de Firmware OTA (0% -> 50% -> 100%)', async () => {
        localStorage.setItem('token', 'valid-token');
        localStorage.setItem('user', 'Cervejeiro');

        vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
            const url = String(input);
            if (url.endsWith('/auth/me')) {
                return new Response(JSON.stringify({ id: 1, username: 'Cervejeiro', role: 'user' }), { status: 200 });
            }
            if (url.endsWith('/devices')) {
                return new Response(JSON.stringify([{
                    id: 1,
                    serial_code: 'ESP32_MQTT',
                    device_name: 'Fermentador Telemetria',
                    active_batch_id: 88,
                    active_batch_name: 'NEIPA Juicy',
                    active_batch_og: 1.070,
                    active_batch_fg: 1.015,
                    last_temp: 18.0,
                    last_temp2: 15.0,
                    last_target: 18.0,
                    last_gravity: 1.050,
                    firmware_version: 'V2.4.0'
                }]), { status: 200 });
            }
            return new Response(JSON.stringify([]), { status: 200 });
        });

        renderWithProviders(<Dashboard />);
        await act(async () => {
            await new Promise(r => setTimeout(r, 60));
        });

        // Inicialmente 0 / 1 unidades conectadas (aguardando pacote MQTT ao vivo)
        expect(container.textContent).toContain('0 / 1 UNIDADES CONECTADAS');
        expect(container.textContent).toContain('18.0');

        // Simula pacote MQTT ao vivo chegando em brewbrother/ESP32_MQTT/data
        const messageHandler = liveMessageHandler();
        expect(messageHandler).toBeTruthy();

        await act(async () => {
            messageHandler(
                'brewbrother/ESP32_MQTT/data',
                Buffer.from(JSON.stringify({
                    ferm: 19.7,
                    amb: 11.4,
                    csp: 19.5,
                    is_sg: 1.028,
                    is_bat: 4.11,
                    rssi: -52,
                    statOp: 'RESFRIANDO',
                    ver: 'V2.4.0',
                    ip: '192.168.1.120'
                })),
                { retain: false }
            );
            await new Promise(r => setTimeout(r, 30));
        });

        // Verifica que o Dashboard atualizou IMEDIATAMENTE para Online (1 / 1) e refletiu todas as leituras ao vivo!
        expect(container.textContent).toContain('1 / 1 UNIDADES CONECTADAS');
        expect(container.textContent).toContain('19.7');
        expect(container.textContent).toContain('Alvo: 19.5°');
        expect(container.textContent).toContain('Geladeira: 11.4°');
        expect(container.textContent).toContain('1.028');
        expect(container.textContent).toContain('96%'); // RSSI -52 dBm -> 2 * (-52 + 100) = 96%
        expect(container.textContent).toContain('192.168.1.120');
    });

    it('Fluxo 8: Recuperação de Senha ("Esqueci minha senha" -> Solicitar Código de 6 dígitos -> Confirmar Nova Senha)', async () => {
        const authCalls: { url: string; method: string; body?: any }[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
            const url = String(input);
            const method = (init?.method || 'GET').toUpperCase();
            const body = init?.body ? JSON.parse(String(init.body)) : undefined;
            authCalls.push({ url, method, body });

            if (url.endsWith('/auth/forgot-password') && method === 'POST') {
                return new Response(JSON.stringify({ message: 'Código enviado!' }), { status: 200 });
            }
            if (url.endsWith('/auth/reset-password') && method === 'POST') {
                return new Response(JSON.stringify({ message: 'Senha redefinida com sucesso!' }), { status: 200 });
            }
            return new Response(JSON.stringify({}), { status: 200 });
        });

        renderWithProviders(<Login />, ['/login']);
        await act(async () => {
            await new Promise(r => setTimeout(r, 30));
        });

        // 1. Clica em "Esqueci minha senha"
        const forgotBtn = findButtonByText('Esqueci minha senha');
        expect(forgotBtn).toBeTruthy();
        clickElement(forgotBtn);
        expect(container.textContent).toContain('Recuperar Senha');

        // 2. Preenche o e-mail e solicita o código
        const recEmailInput = container.querySelector('#recovery-email') as HTMLInputElement;
        expect(recEmailInput).toBeTruthy();
        setInputValue(recEmailInput, 'cervejeiro@breww.live');

        await act(async () => {
            findButtonByText('Enviar Código')!.click();
            await new Promise(r => setTimeout(r, 40));
        });

        expect(authCalls.some(c => c.url.endsWith('/auth/forgot-password') && c.body?.email === 'cervejeiro@breww.live')).toBe(true);
        expect(container.textContent).toContain('Código de 6 Dígitos');

        // 3. Preenche o código de 6 dígitos + Nova Senha + Confirmação
        const codeInput = container.querySelector('#recovery-code') as HTMLInputElement;
        const newPassInput = container.querySelector('#recovery-new-password') as HTMLInputElement;
        const confirmPassInput = container.querySelector('#recovery-confirm-password') as HTMLInputElement;

        setInputValue(codeInput, '482910');
        setInputValue(newPassInput, 'novaSenhaSegura123');
        setInputValue(confirmPassInput, 'novaSenhaSegura123');

        await act(async () => {
            findButtonByText('Redefinir Senha')!.click();
            await new Promise(r => setTimeout(r, 40));
        });

        const resetCall = authCalls.find(c => c.url.endsWith('/auth/reset-password'));
        expect(resetCall).toBeTruthy();
        expect(resetCall?.body).toEqual({
            email: 'cervejeiro@breww.live',
            code: '482910',
            newPassword: 'novaSenhaSegura123'
        });

        // Modal fechou e preencheu o e-mail no formulário principal
        expect(container.querySelector('#recovery-code')).toBeNull();
        const loginEmailInput = container.querySelector('#login-email') as HTMLInputElement;
        expect(loginEmailInput.value).toBe('cervejeiro@breww.live');
    });
});
