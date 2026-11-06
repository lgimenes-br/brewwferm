import '@testing-library/jest-dom';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const store: Record<string, string> = {};
const localStorageShim = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
        store[key] = String(value);
    },
    removeItem: (key: string) => {
        delete store[key];
    },
    clear: () => {
        for (const k of Object.keys(store)) delete store[k];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
        return Object.keys(store).length;
    }
};

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageShim,
    writable: true,
    configurable: true
});
if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
        value: localStorageShim,
        writable: true,
        configurable: true
    });
}
