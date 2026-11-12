import React from 'react';

// Logo Breww: "b" de traco fino com o bojo aberto no alto a direita e uma bolha saindo pela abertura.
// Mesma geometria do app (breww-app/src/components/BrewwMark.tsx, altura H = 100):
// traco 0.105H, raio do bojo 0.29H, bojo de -20° a 290°, bolha a -55° e 1.55R do centro.
export const BrewwMark: React.FC<{ className?: string; title?: string }> = ({ className, title }) => (
    <svg viewBox="-1 -1 66 102" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} fill="currentColor" stroke="currentColor">
        <rect x="0" y="0" width="10.5" height="100" rx="5.25" stroke="none" />
        <path d="M51.32 62.88 A23.75 23.75 0 1 1 37.12 48.68" fill="none" strokeWidth="10.5" strokeLinecap="round" />
        <circle cx="54.78" cy="34.18" r="4.61" fill="none" strokeWidth="5.78" />
    </svg>
);

/** Marca + nome, para cabecalho e rodape */
export const BrewwLogo: React.FC<{ className?: string }> = ({ className }) => (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
        <BrewwMark className="h-8 w-auto" />
        <span className="text-[22px] font-normal tracking-[-0.02em]">breww</span>
    </span>
);
