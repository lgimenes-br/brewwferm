import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';

// Ajuda / solucao de problemas (Fase 5.2), no estilo das paginas publicas (.brew-landing)

type Item = { q: string; a: React.ReactNode };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
    {
        title: 'Instalação',
        items: [
            {
                q: 'O instalador não encontra a placa',
                a: <>Use um cabo USB <b>de dados</b> (muitos só carregam) e o Chrome ou o Edge no computador. Se a placa não aparecer na lista, segure o botão <b>BOOT</b> enquanto conecta o cabo. No Windows e no macOS, algumas placas precisam do driver do chip USB (CP210x ou CH340), disponível no site do fabricante.</>,
            },
            {
                q: 'A gravação parou no meio',
                a: <>Tente outra porta USB, de preferência direto no computador (sem hub), e clique em Instalar de novo. A instalação apaga e grava tudo outra vez, então pode repetir sem medo.</>,
            },
        ],
    },
    {
        title: 'Wi-Fi e app',
        items: [
            {
                q: 'A rede Breww-XXXX não aparece no celular',
                a: <>Ela aparece quando a placa não tem Wi-Fi salvo, ou quando não consegue conectar por 3 minutos. Para forçar, segure o botão <b>BOOT por 10 segundos</b>: o Wi-Fi salvo é apagado e a placa reinicia com a rede Breww aberta.</>,
            },
            {
                q: 'Digitei a senha e não conectou',
                a: <>A página mostra "Não conectou" e deixa tentar de novo. Confira a senha e se a rede é de <b>2,4 GHz</b>: o ESP32 não conecta em redes só de 5 GHz. Em roteadores com as duas no mesmo nome, normalmente funciona.</>,
            },
            {
                q: 'O aparelho não aparece em "Buscar aparelhos na rede"',
                a: <>O celular precisa estar na mesma internet que o aparelho (volte para o Wi-Fi de casa depois de configurar). Se ainda assim não aparecer, use o <b>código de confirmação</b> mostrado na página de Wi-Fi ou na telinha: ele funciona de qualquer rede.</>,
            },
        ],
    },
    {
        title: 'Sensores',
        items: [
            {
                q: 'A temperatura mostra −127 °C',
                a: <>O sensor DS18B20 não está respondendo: confira o fio de dados no pino certo, o 3,3 V, o GND e o <b>resistor de 4,7 kΩ</b> entre o fio de dados e o 3,3 V. Sem esse resistor, o sensor não funciona.</>,
            },
            {
                q: 'A temperatura trava em 85 °C',
                a: <>É o valor que o DS18B20 mostra antes da primeira leitura, ou quando a alimentação está fraca. Confira o 3,3 V e o GND; se usar cabo longo, prefira a ligação com 3 fios (sem alimentação parasita).</>,
            },
            {
                q: 'A umidade não aparece',
                a: <>Com DHT22, confira o pino de dados e a alimentação. Com sensores I²C (SHT3x, AHT20, BME280), confira SDA e SCL; eles são reconhecidos quando a placa liga, então reinicie depois de ligar. No app, em <b>Hardware</b>, aparece qual sensor foi detectado.</>,
            },
        ],
    },
    {
        title: 'Relés e controle',
        items: [
            {
                q: 'O relé funciona ao contrário',
                a: <>O seu módulo liga com o nível oposto ao configurado. No app, abra o aparelho e vá em <b>Configurações → Ferramentas → Hardware → Tipo de relé</b>: "Módulo de relé" para módulos comuns e "SSR ou nível alto" para SSR. Depois confira com o aparelho em Limpeza: tudo deve ficar desligado.</>,
            },
            {
                q: 'O resfriamento demora para ligar',
                a: <>É a <b>proteção do compressor</b>: depois que o resfriamento desliga (ou a placa reinicia), ele espera 5 minutos antes de ligar de novo. O aquecimento não tem essa espera.</>,
            },
            {
                q: 'Quero usar outros pinos',
                a: <>Nas placas sem tela, dá para trocar pelo app, em <b>Hardware → Pinos</b>. O aparelho confere se o pino pode ser usado e reinicia para aplicar.</>,
            },
        ],
    },
    {
        title: 'Tela e atualizações',
        items: [
            {
                q: 'A tela OLED mostra a imagem deslocada ou com chuvisco',
                a: <>Telas OLED de 1,3" geralmente usam o controlador SH1106, e as de 0,96" o SSD1306. Com a placa no USB, abra o monitor serial (115200) e digite <code className="rounded bg-black/5 px-1">tela sh1106</code> (ou <code className="rounded bg-black/5 px-1">tela ssd1306</code>).</>,
            },
            {
                q: 'Como atualizo o firmware?',
                a: <>Quando sai uma versão nova, o app mostra um aviso no aparelho. Toque em atualizar e acompanhe a barra de progresso; o controle desliga os relés durante a atualização e volta sozinho.</>,
            },
        ],
    },
];

export const Help: React.FC = () => {
    useEffect(() => { document.title = 'Ajuda — Breww'; }, []);
    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />
            <main className="mx-auto max-w-4xl px-4 pb-24 pt-14 sm:px-6 lg:pt-20">
                <h1 className="[font-family:var(--font-display)] text-[44px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[60px]">
                    Ajuda. <span className="text-[var(--muted)]">Resolva em minutos.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                    As dúvidas mais comuns de quem monta e usa o Breww. Ainda está montando? Comece pelo <Link to="/instalar" className="font-medium text-[var(--ink)] underline underline-offset-4">guia de montagem</Link>.
                </p>

                <div className="mt-14 space-y-12">
                    {GROUPS.map(g => (
                        <section key={g.title}>
                            <h2 className="text-sm font-medium text-[var(--muted)]">{g.title}</h2>
                            <div className="mt-3 divide-y divide-black/5 overflow-hidden rounded-3xl bg-white">
                                {g.items.map(item => (
                                    <details key={item.q} className="group">
                                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden">
                                            {item.q}
                                            <ChevronDown size={20} className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
                                        </summary>
                                        <div className="px-6 pb-6 leading-relaxed text-[var(--muted)]">{item.a}</div>
                                    </details>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-[28px] bg-[var(--card)] p-8 text-white sm:flex-row sm:items-center">
                    <p className="[font-family:var(--font-display)] text-2xl font-light tracking-[-0.02em]">Ainda não montou o seu?</p>
                    <Link to="/instalar" className="group inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                        Ver o guia de montagem <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
            </main>
            <SiteFooter />
        </div>
    );
};

export default Help;
