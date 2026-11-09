import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const fetchPairingStatus = vi.fn();
vi.mock('../services/api', () => ({ fetchPairingStatus: (...args: any[]) => fetchPairingStatus(...args) }));

import { PairingWaitModal } from '../components/PairingWaitModal';

describe('PairingWaitModal', () => {
    let container: HTMLDivElement;
    let root: Root;
    const pairing = { pairingId: 'abc', serial: '288485495464', expiresIn: 120 };

    beforeEach(() => {
        vi.useFakeTimers();
        fetchPairingStatus.mockReset();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.useRealTimers();
    });

    const flush = async (ms = 0) => {
        await act(async () => {
            await vi.advanceTimersByTimeAsync(ms);
        });
    };

    it('aguarda a confirmação e chama onConfirmed uma única vez', async () => {
        fetchPairingStatus
            .mockResolvedValueOnce({ status: 'pending', expiresIn: 118 })
            .mockResolvedValue({ status: 'confirmed', expiresIn: 110 });
        const onConfirmed = vi.fn();
        act(() => root.render(<PairingWaitModal pairing={pairing} onConfirmed={onConfirmed} onClose={() => {}} pollMs={1000} />));
        await flush();
        expect(container.textContent).toContain('Confirme na tela do aparelho');
        expect(container.textContent).toContain('1:58');

        await flush(1000);
        expect(container.textContent).toContain('Aparelho vinculado!');
        await flush(3000);
        expect(onConfirmed).toHaveBeenCalledTimes(1);
        expect(onConfirmed).toHaveBeenCalledWith('288485495464');
        expect(fetchPairingStatus).toHaveBeenCalledTimes(2); // parou de consultar depois de concluir
    });

    it('mostra a recusa feita no aparelho', async () => {
        fetchPairingStatus.mockResolvedValue({ status: 'rejected', expiresIn: 0 });
        const onConfirmed = vi.fn();
        act(() => root.render(<PairingWaitModal pairing={pairing} onConfirmed={onConfirmed} onClose={() => {}} />));
        await flush();
        expect(container.textContent).toContain('Vínculo recusado no aparelho');
        expect(onConfirmed).not.toHaveBeenCalled();
    });
});
