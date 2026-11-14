import React from 'react';
import { Link } from 'react-router-dom';
import { BrewwLogo } from './BrewwMark';
import { TempDisplay, SmallValue, Chip } from './app/AppUI';

// Moldura das telas de entrada (login, cadastro), na identidade do app.
// Computador: a esquerda, a frase da marca e um cartao do app de verdade (dados de exemplo, rotulados);
// a direita, o formulario direto sobre o fundo. Celular: so o formulario.

/** Campo das telas de entrada: pilula escura com icone, como os campos do app */
export const authInput = 'w-full h-12 rounded-full bg-[var(--cell-2)] border border-[var(--line)] pl-11 pr-4 text-[16px] text-[var(--ink)] placeholder:text-[var(--tertiary)] focus:outline-none focus:border-[rgba(113,252,143,0.55)] transition-colors';
export const authLabel = 'block text-[14px] text-[var(--muted)] mb-2 px-1';

export const AuthShell: React.FC<{ title: string; subtitle?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="min-h-screen min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden overflow-hidden border-r border-[var(--line)] px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-16">
            <Link to="/" aria-label="Breww, início" className="self-start rounded-full"><BrewwLogo className="text-[var(--ink)]" /></Link>

            <div className="max-w-[460px]">
                <p className="text-[52px] font-light leading-[1.04] tracking-[-0.03em] text-[var(--ink)]">
                    Sua fermentação, <span className="text-[var(--accent)]">no ponto.</span>
                </p>
                <p className="mt-4 text-[17px] leading-relaxed text-[var(--muted)]">
                    Temperatura, perfis e alertas do seu controlador, ao vivo no celular e no computador.
                </p>

                {/* O mesmo cartao do app (exemplo) */}
                <figure className="mt-10" aria-label="Exemplo de um aparelho no Breww">
                    <div className="app-card p-6 flex flex-col gap-5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.9)]" aria-hidden>
                        <div>
                            <p className="text-[19px] font-medium text-[var(--ink)]">Fermentador da garagem</p>
                            <p className="text-[14px] text-[var(--muted)]">Fermentando Pilsen da casa · Primária</p>
                        </div>
                        <div className="flex items-end justify-between gap-4">
                            <TempDisplay value={18.1} size={72} />
                            <div className="flex gap-5 pb-2">
                                <div className="flex flex-col items-end gap-0.5"><span className="text-[12px] text-[var(--muted)]">Densidade</span><SmallValue value="1.021" /></div>
                                <div className="flex flex-col items-end gap-0.5"><span className="text-[12px] text-[var(--muted)]">Alvo</span><SmallValue value="18.0" unit="°C" /></div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Chip dot="on">No alvo</Chip>
                            <Chip>Dia 4 de 10</Chip>
                        </div>
                    </div>
                    <figcaption className="mt-3 px-1 text-[13px] text-[var(--tertiary)]">Exemplo de um aparelho no app</figcaption>
                </figure>
            </div>

            <p className="text-[13px] text-[var(--tertiary)]">© {new Date().getFullYear()} Breww · <Link to="/privacidade" className="hover:text-[var(--ink)]">Privacidade</Link> · <Link to="/termos" className="hover:text-[var(--ink)]">Termos</Link></p>
        </aside>

        <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-10">
            <div className="w-full max-w-[400px]">
                <Link to="/" aria-label="Breww, início" className="mb-10 inline-block rounded-full lg:hidden"><BrewwLogo className="text-[var(--ink)]" /></Link>
                <h1 className="text-[40px] font-light leading-[1.05] tracking-[-0.03em] text-[var(--ink)]">{title}</h1>
                {subtitle && <p className="mt-2 text-[16px] leading-relaxed text-[var(--muted)]">{subtitle}</p>}
                <div className="mt-8">{children}</div>
            </div>
        </main>
    </div>
);
