import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { classifySensor, SensorTestModal } from '../components/SensorTestModal';

describe('classifySensor', () => {
    it('marks missing values', () => {
        expect(classifySensor('humidity', undefined).status).toBe('missing');
        expect(classifySensor('temperature', '').status).toBe('missing');
    });
    it('treats null (firmware reported no valid reading) as suspect', () => {
        expect(classifySensor('humidity', null).status).toBe('suspect');
    });
    it('flags humidity 0 as suspect', () => {
        const r = classifySensor('humidity', 0);
        expect(r.status).toBe('suspect');
        expect(r.hint).toMatch(/Umidade 0/);
    });
    it('flags DS18B20 error codes', () => {
        expect(classifySensor('temperature', -127).status).toBe('suspect');
        expect(classifySensor('temperature', 85).status).toBe('suspect');
    });
    it('flags non-numeric and out-of-range values', () => {
        expect(classifySensor('temperature', 'nan').status).toBe('suspect');
        expect(classifySensor('humidity', 140).status).toBe('suspect');
        expect(classifySensor('gravity', 1.5).status).toBe('suspect');
    });
    it('accepts plausible values (including numeric strings)', () => {
        expect(classifySensor('temperature', '18.5')).toEqual({ status: 'ok', value: 18.5 });
        expect(classifySensor('humidity', 62).status).toBe('ok');
        expect(classifySensor('gravity', 1.048).status).toBe('ok');
    });
});

describe('SensorTestModal', () => {
    let container: HTMLDivElement;
    let root: Root;
    const names = { sensor1: 'Fermentador', sensor2: 'Geladeira', sg: 'iSpindel' };

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.useRealTimers();
    });

    it('requests status on open and shows timeout when no packet arrives', () => {
        const sendCommand = vi.fn();
        act(() => {
            root.render(<SensorTestModal open onClose={() => {}} deviceId="ABC" device={undefined} names={names} sendCommand={sendCommand} timeoutMs={1000} />);
        });
        expect(sendCommand).toHaveBeenCalledWith('ABC', 'request_status', {});
        expect(container.textContent).toContain('Solicitando leitura');
        act(() => { vi.advanceTimersByTime(1100); });
        expect(container.textContent).toContain('Sem resposta do aparelho');
    });

    it('marks humidity 0 as suspect once a fresh packet arrives', () => {
        const sendCommand = vi.fn();
        const render = (device: any) => root.render(
            <SensorTestModal open onClose={() => {}} deviceId="ABC" device={device} names={names} sendCommand={sendCommand} timeoutMs={5000} />
        );
        act(() => render(undefined));
        act(() => { vi.advanceTimersByTime(10); });
        act(() => render({ lastPacketMs: Date.now(), rawPayload: { ferm: 19.2, amb: 4.1, hum: 0, rssi: -60 } }));

        const hum = container.querySelector('[data-testid="sensor-row-hum"]');
        expect(hum?.getAttribute('data-status')).toBe('suspect');
        expect(container.querySelector('[data-testid="sensor-row-ferm"]')?.getAttribute('data-status')).toBe('ok');
        expect(container.textContent).not.toContain('Sem resposta');
    });
});
