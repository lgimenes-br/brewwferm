// Todas as acoes do painel de admin, contra um servidor simulado (nada toca a producao).
// Cada acao confere a chamada exata: metodo, endereco e dados enviados.
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const commandMock = vi.fn();
vi.mock('../services/liveClient', () => ({ connectLive: () => ({ close: () => {} }) }));
vi.mock('../services/api', async (importOriginal) => {
    const actual: any = await importOriginal();
    return { ...actual, sendDeviceCommand: (...args: any[]) => { commandMock(...args); return Promise.resolve({}); } };
});

import { AuthProvider } from '../context/AuthContext';
import { BrewProvider } from '../context/BrewContext';
import { AdminDashboard } from '../components/AdminDashboard';

type Call = { method: string; url: string; body: any };
let calls: Call[] = [];
let container: HTMLDivElement;
let root: Root;

// Respostas do servidor simulado
const DATA: Record<string, any> = {
    'GET /admin/users': [
        { id: 1, name: 'Ana Teste', email: 'ana@exemplo.com', role: 'user', plan_type: 'free', device_count: 1 },
        { id: 2, name: 'Bruno Teste', email: 'bruno@exemplo.com', role: 'user', plan_type: 'premium', device_count: 0 },
    ],
    'GET /admin/users/trash': [{ id: 3, name: 'Carlos Lixeira', email: 'carlos@exemplo.com', device_count: 2, days_left: 27 }],
    'GET /admin/devices': [{ id: 10, serial_code: 'AABBCCDDEEFF', device_name: 'Fermentador', user_id: 1 }],
    'GET /admin/telemetry': [{ id: 10, serial_code: 'AABBCCDDEEFF', device_name: 'Fermentador', owner_name: 'Ana Teste', is_online: 1 }],
    'GET /admin/broadcasts': [{ id: 5, title: 'Manutenção', message: 'Hoje às 23h', is_active: 1, created_at: '2026-11-12T10:00:00Z' }],
    'GET /admin/audit': [],
    'GET /ingredients/fermentables': [{ id: 7, name: 'Pilsner Malt', name_pt: 'Malte Pilsen' }],
    'GET /admin/fleet': { total: 1, online: 1, reporting: 1, boards: [{ name: 's3-35', count: 1, online: 1 }], versions: [], modules: [] },
    'GET /admin/server/status': [{ name: 'breww-server', pm2_env: { status: 'online', restart_time: 3 }, monit: { cpu: 1, memory: 80 * 1048576 } }],
    'GET /admin/server/logs': { logs: 'linha 1' },
};

function installFetch() {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
        const url = String(typeof input === 'string' ? input : input.url);
        const method = (init?.method || 'GET').toUpperCase();
        let body: any = undefined;
        try { body = init?.body ? JSON.parse(init.body) : undefined; } catch { body = init?.body; }
        calls.push({ method, url, body });
        const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0];
        const key = `${method} ${path}`;
        const data = key in DATA ? DATA[key] : (method === 'GET' ? [] : { ok: true, id: 99 });
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
}

const wait = (ms = 40) => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const q = <T extends Element>(sel: string) => container.querySelector(sel) as T;
const byText = (text: string, scope: ParentNode = container) =>
    Array.from(scope.querySelectorAll('button')).find(b => (b.textContent || '').trim().toLowerCase().includes(text.toLowerCase())) as HTMLButtonElement;
const click = async (el: Element | null | undefined) => { expect(el, 'elemento nao encontrado').toBeTruthy(); await act(async () => { (el as HTMLElement).click(); }); await wait(); };
function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    act(() => {
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
}
const submit = async (form: HTMLFormElement) => { await act(async () => { form.requestSubmit(); }); await wait(); };
const last = (method: string, frag: string) => [...calls].reverse().find(c => c.method === method && c.url.includes(frag));

async function open(section: string) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    act(() => {
        root.render(
            <GoogleOAuthProvider clientId="test">
                <MemoryRouter initialEntries={[`/admin/${section}`]}>
                    <QueryClientProvider client={qc}>
                        <AuthProvider><BrewProvider><AdminDashboard /></BrewProvider></AuthProvider>
                    </QueryClientProvider>
                </MemoryRouter>
            </GoogleOAuthProvider>
        );
    });
    await wait(80);
}

beforeEach(() => {
    calls = [];
    commandMock.mockReset();
    localStorage.clear();
    localStorage.setItem('token', 'tkn');
    localStorage.setItem('user', 'Admin');
    localStorage.setItem('role', 'admin');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    installFetch();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
});

describe('Painel de admin: todas as acoes', () => {
    it('navegacao: cada secao do menu abre com o proprio titulo', async () => {
        await open('visao-geral');
        const titles: Record<string, string> = {
            frota: 'Frota', telemetria: 'Telemetria', firmware: 'Firmware', contas: 'Contas e aparelhos', saude: 'Saúde e marketing',
            seguranca: 'Segurança e avisos', terminal: 'Terminal do servidor', ingredientes: 'Banco de ingredientes',
        };
        for (const [slug, title] of Object.entries(titles)) {
            await click(q(`a[href="/admin/${slug}"]`));
            expect(q('main h1').textContent).toBe(title);
            expect(q(`a[href="/admin/${slug}"]`).getAttribute('aria-current')).toBe('page');
        }
    });

    it('contas: criar, editar, trocar plano e excluir', async () => {
        await open('contas');
        expect(container.textContent).toContain('Ana Teste');

        await click(byText('Nova Conta'));
        setValue(q('#user-modal-name'), 'Carla Nova');
        setValue(q('#user-modal-email'), 'carla@exemplo.com');
        setValue(q('#user-modal-password'), 'senhaForte123');
        await submit(q<HTMLInputElement>('#user-modal-name').form!);
        expect(last('POST', '/admin/users')?.body).toMatchObject({ name: 'Carla Nova', email: 'carla@exemplo.com', password: 'senhaForte123' });

        await click(q('button[aria-label="Editar Ana Teste"]'));
        setValue(q('#user-modal-name'), 'Ana Editada');
        await submit(q<HTMLInputElement>('#user-modal-name').form!);
        expect(last('PUT', '/admin/users/1')?.body).toMatchObject({ name: 'Ana Editada' });

        setValue(q('select[aria-label="Plano de Ana Teste"]'), 'premium');
        await wait();
        expect(last('PUT', '/admin/users/1/plan')?.body).toMatchObject({ plan_type: 'premium' });

        await click(q('button[aria-label="Excluir Bruno Teste"]'));
        await click(byText('Mover para a lixeira', document.body));
        const del = last('DELETE', '/admin/users/2');
        expect(del && !del.url.includes('permanent')).toBe(true); // vai para a lixeira, nao apaga
    });

    it('lixeira: restaurar e excluir definitivamente (com confirmacao)', async () => {
        await open('contas');
        expect(container.textContent).toContain('Carlos Lixeira');
        expect(container.textContent).toContain('apagada em 27 dias');

        await click(q('button[aria-label="Restaurar Carlos Lixeira"]'));
        expect(last('POST', '/admin/users/3/restore')).toBeTruthy();

        await click(q('button[aria-label="Excluir definitivamente Carlos Lixeira"]'));
        expect(last('DELETE', '/admin/users/3')).toBeFalsy(); // so depois de confirmar
        await click(byText('Apagar para sempre', document.body));
        expect(last('DELETE', '/admin/users/3')?.url).toContain('permanent=1');
    });

    it('aparelhos de uma conta: vincular, editar e remover', async () => {
        await open('contas');
        await click(q('button[aria-label="Dispositivos de Ana Teste"]'));
        expect(container.textContent).toContain('AABBCCDDEEFF');

        await click(byText('Adicionar'));
        setValue(q('#device-modal-serial'), '112233445566');
        setValue(q('#device-modal-name'), 'Geladeira');
        await submit(q<HTMLInputElement>('#device-modal-serial').form!);
        expect(last('POST', '/admin/devices')?.body).toMatchObject({ serial_code: '112233445566', device_name: 'Geladeira', user_id: 1 });

        await click(q('button[aria-label="Editar dispositivo AABBCCDDEEFF"]'));
        setValue(q('#device-modal-name'), 'Fermentador 2');
        await submit(q<HTMLInputElement>('#device-modal-serial').form!);
        expect(last('PUT', '/admin/devices/10')?.body).toMatchObject({ device_name: 'Fermentador 2' });

        await click(q('button[aria-label="Remover dispositivo AABBCCDDEEFF"]'));
        await click(byText('Remover', document.body.querySelector('[role="dialog"], [role="alertdialog"]') || document.body));
        expect(last('DELETE', '/admin/devices/10')).toBeTruthy();
    });

    it('seguranca: publicar aviso e ativar/desativar um aviso existente', async () => {
        await open('seguranca');
        setValue(q('#broadcast-title-input'), 'Atualização');
        setValue(q('#broadcast-message-input'), 'Nova versão disponível');
        await click(byText('Publicar Aviso'));
        expect(last('POST', '/admin/broadcasts')?.body).toMatchObject({ title: 'Atualização', message: 'Nova versão disponível' });

        expect(container.textContent).toContain('Histórico de Avisos');
        await click(byText('Ativo'));
        expect(last('PUT', '/admin/broadcasts/5')?.body).toEqual({ is_active: false });
    });

    it('saude e marketing: enviar push para todos', async () => {
        await open('saude');
        setValue(q('input[placeholder="Ex: Oferta Especial!"]'), 'Novidade');
        setValue(q('textarea[placeholder*="Digite sua mensagem"]'), 'Firmware 2.9 disponível');
        await click(byText('Enviar Push Broadcast'));
        expect(last('POST', '/admin/broadcast-push')?.body).toEqual({ title: 'Novidade', message: 'Firmware 2.9 disponível' });
    });

    it('firmware: OTA so libera com aparelho e URL e pede confirmacao antes de enviar', async () => {
        await open('firmware');
        const btn = byText('Disparar Atualização Forçada');
        expect(btn.disabled).toBe(true);
        setValue(q('#ota-target-device'), 'AABBCCDDEEFF');
        setValue(q('#ota-bin-url'), 'https://breww.live/firmware/update.bin');
        setValue(q('#ota-md5-hash'), 'abc123');
        expect(byText('Disparar Atualização Forçada').disabled).toBe(false);
        await click(byText('Disparar Atualização Forçada'));
        expect(commandMock).not.toHaveBeenCalled(); // so depois de confirmar
        await click(byText('Disparar OTA', document.body));
        const [serial, type, payload] = commandMock.mock.calls.at(-1)!;
        expect([serial, type]).toEqual(['AABBCCDDEEFF', 'update_firmware']);
        expect(payload).toMatchObject({ url: 'https://breww.live/firmware/update.bin', md5: 'abc123' });
    });

    it('ingredientes: criar, editar e excluir', async () => {
        await open('ingredientes');
        expect(container.textContent).toContain('Malte Pilsen');

        await click(q('button[aria-label="Adicionar novo ingrediente"]'));
        setValue(q('#ingredient-name-input'), 'Munich Malt');
        setValue(q('#ingredient-name-pt-input'), 'Malte Munique');
        await click(byText('Salvar'));
        expect(last('POST', '/admin/ingredients/fermentables')?.body).toMatchObject({ name: 'Munich Malt', name_pt: 'Malte Munique' });

        await click(q('button[aria-label="Editar Pilsner Malt"]'));
        setValue(q('#ingredient-name-pt-input'), 'Malte Pilsner');
        await click(byText('Salvar'));
        expect(last('PUT', '/admin/ingredients/fermentables/7')?.body).toMatchObject({ name_pt: 'Malte Pilsner' });

        await click(q('button[aria-label="Excluir Pilsner Malt"]'));
        await click(byText('Excluir', document.body.querySelector('[role="dialog"], [role="alertdialog"]') || document.body));
        expect(last('DELETE', '/admin/ingredients/fermentables/7')).toBeTruthy();
    });

    it('terminal e frota: atualizar recarrega os dados', async () => {
        await open('terminal');
        const before = calls.filter(c => c.url.includes('/admin/server/status')).length;
        await click(byText('Atualizar Agora'));
        expect(calls.filter(c => c.url.includes('/admin/server/status')).length).toBeGreaterThan(before);
        expect(container.textContent).toContain('linha 1');

        await click(q('a[href="/admin/frota"]'));
        const f0 = calls.filter(c => c.url.includes('/admin/fleet')).length;
        await click(byText('Atualizar'));
        expect(calls.filter(c => c.url.includes('/admin/fleet')).length).toBeGreaterThan(f0);
    });

    it('sair: encerra a sessao', async () => {
        await open('visao-geral');
        await click(q('button[aria-label="Sair"]'));
        expect(localStorage.getItem('token')).toBeNull();
    });
});
