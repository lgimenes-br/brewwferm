import { useEffect, useRef } from 'react';

/**
 * Escreve no elemento a variavel CSS --p (0 a 1): 0 quando o topo do elemento entra pela base da tela,
 * 1 quando o elemento chega ao ponto `end` (fracao da altura da tela, a partir do topo).
 * O CSS usa calc(var(--p)) para desenhar linhas e mover camadas (parallax). Um so listener de rolagem,
 * com requestAnimationFrame. Com movimento reduzido, --p fica em 1 (tudo no estado final, parado).
 */
export const useScrollVar = <T extends HTMLElement>(end = 0.35) => {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { el.style.setProperty('--p', '1'); return; }
        let raf = 0;
        const update = () => {
            raf = 0;
            const r = el.getBoundingClientRect();
            const vh = window.innerHeight;
            const start = vh;          // topo do elemento na base da tela
            const stop = vh * end;     // topo do elemento perto do alto da tela
            const p = Math.min(1, Math.max(0, (start - r.top) / Math.max(1, start - stop)));
            el.style.setProperty('--p', p.toFixed(4));
        };
        const on = () => { if (!raf) raf = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', on, { passive: true });
        window.addEventListener('resize', on);
        return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
    }, [end]);
    return ref;
};
