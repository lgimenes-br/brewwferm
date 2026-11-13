import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader, SiteFooter } from './SiteChrome';
import { ArrowRight } from 'lucide-react';
import { FermentationStory } from './landing/FermentationStory';
import { InstallTimeline, OpenSource, Projection, Pricing, Closing } from './landing/sections';

// Home de vendas (visitante sem login em "/"). Mundo: "a curva é a página" (contrato em .impeccable/surfaces).
// Caminho por tipo de visitante: quem tem (ou vai comprar) um ESP32 vai para o guia de montagem;
// quem quer o controlador pronto entra na lista de espera; criar a conta e o passo seguinte.

export const Landing: React.FC = () => {
    const finalCta = useRef<HTMLElement>(null);
    const [heroGone, setHeroGone] = useState(false);
    const [endVisible, setEndVisible] = useState(false);
    const showBar = heroGone && !endVisible;

    useEffect(() => {
        document.title = 'Breww — Controle de fermentação no celular';
    }, []);

    // Barra fixa no celular: aparece quando o titulo sai de cena e some no fecho da pagina
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined' || !finalCta.current) return;
        const io = new IntersectionObserver(([e]) => setEndVisible(e.isIntersecting));
        io.observe(finalCta.current);
        return () => io.disconnect();
    }, []);

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />

            <main>
                <FermentationStory onHeroGone={setHeroGone} />

                <InstallTimeline />
                <OpenSource />
                <Projection />
                <Pricing />
                <Closing ref={finalCta} />
            </main>

            <SiteFooter />

            {/* Celular: acao principal sempre ao alcance do polegar */}
            <div
                className={`fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-[var(--bg)]/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 ease-out md:hidden ${showBar ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
                aria-hidden={!showBar}
            >
                <div className="flex gap-2">
                    <Link to="/instalar" tabIndex={showBar ? 0 : -1} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-[15px] font-medium text-white">
                        Monte o seu <ArrowRight size={17} />
                    </Link>
                    <a href="#pronto" tabIndex={showBar ? 0 : -1} className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-5 text-[15px] font-medium">Prefiro o pronto</a>
                </div>
            </div>
        </div>
    );
};

export default Landing;
