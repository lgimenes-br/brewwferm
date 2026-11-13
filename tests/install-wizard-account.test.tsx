import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// O assistente comeca pela conta; depois de entrar, segue para conectar a placa e registra o evento 'login'.
const login = vi.fn();
vi.mock('../services/api', () => ({ login: (...a: any[]) => login(...a), register: vi.fn(), loginWithGoogle: vi.fn(), loginWithApple: vi.fn() }));
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => () => {} }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ token: null, user: null }) }));
vi.mock('../components/SiteChrome', () => ({ SiteHeader: () => null }));

import { InstallWizard } from '../components/InstallWizard';

const setInput = (el: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
};
const button = (c: HTMLElement, text: string) => [...c.querySelectorAll('button')].find(b => b.textContent?.includes(text)) as HTMLButtonElement;

describe('Assistente de instalação: conta primeiro', () => {
    let container: HTMLDivElement;
    let root: Root;
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));

    beforeEach(() => {
        sessionStorage.clear();
        login.mockReset();
        fetchMock.mockClear();
        vi.stubGlobal('fetch', fetchMock);
        window.scrollTo = vi.fn() as any;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

    const render = () => act(() => root.render(<MemoryRouter><InstallWizard /></MemoryRouter>));

    it('sem conta mostra a etapa da conta; entrar com e-mail leva a conectar a placa', async () => {
        login.mockResolvedValue({ token: 'tk-1', name: 'Ana' });
        render();
        expect(container.textContent).toContain('Primeiro, sua conta');
        expect(container.textContent).not.toContain('Conectar a placa');

        act(() => button(container, 'Já tenho conta').click());
        const [email, pass] = [...container.querySelectorAll('input')] as HTMLInputElement[];
        act(() => { setInput(email, 'ana@exemplo.com'); setInput(pass, 'segredo1'); });
        await act(async () => { button(container, 'Entrar e continuar').click(); });

        expect(login).toHaveBeenCalledWith('ana@exemplo.com', 'segredo1');
        expect(container.textContent).toContain('Ligue a placa no computador');
        expect(container.textContent).toContain('de Ana');
        expect(JSON.parse(sessionStorage.getItem('breww_install_session')!).token).toBe('tk-1');
        expect(localStorage.getItem('token')).toBeNull(); // nao abre a sessao do site
        const [url, init] = fetchMock.mock.calls[0] as any;
        expect(url).toMatch(/\/install\/events$/);
        expect(JSON.parse(init.body).event).toBe('login');
        expect(init.headers.Authorization).toBe('Bearer tk-1');
    });

    it('com a sessão do assistente guardada, começa direto em conectar', () => {
        sessionStorage.setItem('breww_install_session', JSON.stringify({ token: 'tk-2', name: 'Bia' }));
        render();
        expect(container.textContent).toContain('Ligue a placa no computador');
        expect(container.textContent).not.toContain('Primeiro, sua conta');
    });
});
