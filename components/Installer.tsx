import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, Cpu, Smartphone, Thermometer, ToggleRight, Usb, Wifi, Plug, Monitor, Droplets, CircleDot, Gauge } from 'lucide-react';
import { SiteHeader, SiteFooter } from './SiteChrome';

// "Monte o seu" + instalador pelo navegador (Fases 3.1 e 3.5), no estilo da home (.brew-landing).
// O ESP Web Tools grava a imagem completa da placa: /firmware/manifest/<placa>.json (servidor).

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'esp-web-install-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { manifest?: string };
        }
    }
}

type Wire = { pin: string; to: string; note?: string; free?: boolean }; // free = o firmware acha sozinho (contorno tracejado)
// sensorPins: onde o DS18B20 e o DHT22 podem ir (o firmware procura sozinho; igual a pins_sensor_candidate)
type Board = { id: string; name: string; hint: string; wires: Wire[]; relayDefault: string; sensorPins?: number[] };

// Reles e I2C: pinos fixos de boards/*.h. Sensores: qualquer pino de sensorPins (detectados sozinhos, v2.9.2+)
const BOARDS: Board[] = [
    {
        id: 'esp32-devkit', name: 'ESP32 DevKit', hint: 'O mais barato e fácil de achar (WROOM-32 / DevKit V1).',
        wires: [
            { pin: 'Qualquer livre', to: 'Sensor DS18B20 · dados', note: 'resistor de 4,7 kΩ para o 3,3 V', free: true },
            { pin: 'GPIO 26', to: 'Relé de aquecer · IN' },
            { pin: 'GPIO 27', to: 'Relé de resfriar · IN' },
            { pin: 'Qualquer livre', to: 'DHT22 · dados', note: 'opcional', free: true },
            { pin: 'GPIO 21 / 22', to: 'Tela ou sensor I²C · SDA / SCL', note: 'opcional' },
        ],
        relayDefault: 'Módulo de relé comum (liga em nível baixo)',
        sensorPins: [4, 13, 14, 16, 17, 18, 19, 23, 25, 32, 33],
    },
    {
        id: 's3-headless', name: 'ESP32-S3', hint: 'ESP32-S3-DevKitC ou similar, sem tela.',
        wires: [
            { pin: 'Qualquer livre', to: 'Sensor DS18B20 · dados', note: 'resistor de 4,7 kΩ para o 3,3 V', free: true },
            { pin: 'GPIO 9', to: 'Relé de aquecer · IN' },
            { pin: 'GPIO 14', to: 'Relé de resfriar · IN' },
            { pin: 'Qualquer livre', to: 'DHT22 · dados', note: 'opcional', free: true },
            { pin: 'GPIO 4 / 5', to: 'Tela ou sensor I²C · SDA / SCL', note: 'opcional' },
        ],
        relayDefault: 'Módulo de relé comum (liga em nível baixo)',
        sensorPins: [1, 2, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 21, 38, 39, 40, 41, 42, 47],
    },
    {
        id: 'c3-headless', name: 'ESP32-C3 SuperMini', hint: 'Bem pequeno. Poucos pinos, mas suficiente.',
        wires: [
            { pin: 'Qualquer livre', to: 'Sensor DS18B20 · dados', note: 'resistor de 4,7 kΩ para o 3,3 V', free: true },
            { pin: 'GPIO 5', to: 'Relé de aquecer · IN' },
            { pin: 'GPIO 6', to: 'Relé de resfriar · IN' },
            { pin: 'Qualquer livre', to: 'DHT22 · dados', note: 'opcional', free: true },
            { pin: 'GPIO 7 / 10', to: 'Tela ou sensor I²C · SDA / SCL', note: 'opcional' },
        ],
        relayDefault: 'Módulo de relé comum (liga em nível baixo)',
        sensorPins: [0, 1, 3, 4, 20, 21],
    },
    {
        id: 's3-35', name: 'Breww com tela 3,5"', hint: 'A placa oficial com tela touch.',
        wires: [
            { pin: 'JST 4P · 3 ou 4', to: 'Sensor DS18B20 · dados', free: true },
            { pin: 'JST 8P · pino 1', to: 'Relé de aquecer' },
            { pin: 'JST 8P · pino 2', to: 'Relé de resfriar' },
            { pin: 'JST 4P · o outro', to: 'DHT22 · dados', note: 'opcional', free: true },
        ],
        relayDefault: 'Relés da placa oficial (nível alto)',
    },
];

const PARTS = [
    { icon: Cpu, title: 'Uma placa ESP32', text: 'DevKit, S3 ou C3. Qualquer uma das placas abaixo.' },
    { icon: Thermometer, title: 'Sensor DS18B20', text: 'A versão à prova d’água, com cabo. Mais um resistor de 4,7 kΩ.' },
    { icon: ToggleRight, title: 'Relés', text: 'Módulo de 2 canais (aquecer e resfriar) ou SSR.' },
    { icon: Plug, title: 'Fonte 5 V', text: 'Um carregador USB comum serve para a placa.' },
];
const EXTRAS = [
    { icon: Monitor, title: 'Tela OLED 0,96" ou LCD 20x4', text: 'I²C. Reconhecida sozinha ao ligar.' },
    { icon: Droplets, title: 'Umidade', text: 'SHT3x, AHT20, BME280 ou DHT22.' },
    { icon: CircleDot, title: 'Dois botões', text: 'Para ajustar o alvo e o menu na telinha.' },
    { icon: Gauge, title: 'iSpindel', text: 'Densímetro Wi-Fi para acompanhar a gravidade.' },
];

const supportsWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

const StepLabel: React.FC<{ n: string; children: React.ReactNode; dark?: boolean }> = ({ n, children, dark }) => (
    <p className={`flex items-center gap-3 text-sm font-medium ${dark ? 'text-[#898E99]' : 'text-[var(--muted)]'}`}>
        <span className={`font-mono ${dark ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{n}</span>{children}
    </p>
);

export const Installer: React.FC = () => {
    const [boardId, setBoardId] = useState(BOARDS[0].id);
    const [ready, setReady] = useState(false);
    const [version, setVersion] = useState<string | null>(null);
    const [manifestMissing, setManifestMissing] = useState(false);
    const board = BOARDS.find(b => b.id === boardId)!;
    const headless = board.id !== 's3-35';

    useEffect(() => { document.title = 'Monte o seu Breww — Instalador'; }, []);

    // Componente do ESP Web Tools so nesta pagina
    useEffect(() => {
        if (!supportsWebSerial) return;
        import('esp-web-tools').then(() => setReady(true)).catch(() => setReady(false));
    }, []);

    useEffect(() => {
        setVersion(null);
        setManifestMissing(false);
        fetch(`/firmware/manifest/${board.id}.json?t=${Date.now()}`)
            .then(r => (r.ok ? r.json() : Promise.reject()))
            .then(m => setVersion(m.version))
            .catch(() => setManifestMissing(true));
    }, [board.id]);

    return (
        <div className="brew-landing min-h-screen bg-[var(--bg)] text-[var(--ink)] [font-family:var(--font-body)] antialiased">
            <SiteHeader />
            <main>
                {/* Heroi */}
                <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 lg:pt-20">
                    <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-medium text-[var(--muted)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#2fbf55]" /> Firmware aberto · Grátis
                    </p>
                    <h1 className="max-w-4xl [font-family:var(--font-display)] text-[44px] font-light leading-[1.02] tracking-[-0.035em] sm:text-[64px]">
                        Monte o seu Breww. <span className="landing-mark">Sem compilar nada.</span>
                    </h1>
                    <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
                        Compre as peças, ligue os fios, grave o firmware pelo navegador e configure o Wi-Fi pelo celular. Em menos de meia hora ele aparece no app.
                    </p>
                    <ol className="mt-10 grid gap-3 text-sm sm:grid-cols-4">
                        {[['01', 'Peças', '#pecas'], ['02', 'Ligações', '#ligacoes'], ['03', 'Instalar', '#instalar'], ['04', 'Wi-Fi e app', '#app']].map(([n, t, href]) => (
                            <li key={n}>
                                <a href={href} className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/60 px-4 py-3 hover:bg-white">
                                    <span><span className="mr-2 font-mono text-[var(--muted)]">{n}</span>{t}</span>
                                    <ArrowRight size={16} className="text-[var(--muted)]" />
                                </a>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* 01 Pecas */}
                <section id="pecas" className="scroll-mt-20 border-t border-black/5 bg-white/50">
                    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
                        <StepLabel n="01">Lista de compras</StepLabel>
                        <h2 className="mt-2 [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] sm:text-5xl">O essencial cabe na palma da mão.</h2>
                        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {PARTS.map(({ icon: Icon, title, text }) => (
                                <article key={title} className="rounded-3xl border border-black/5 bg-white p-6">
                                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg)]"><Icon size={20} strokeWidth={1.75} /></span>
                                    <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                                    <p className="mt-1.5 leading-relaxed text-[var(--muted)]">{text}</p>
                                </article>
                            ))}
                        </div>
                        <p className="mt-12 text-sm font-medium text-[var(--muted)]">Opcionais, para quando quiser mais</p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {EXTRAS.map(({ icon: Icon, title, text }) => (
                                <div key={title} className="flex gap-3 rounded-2xl border border-black/5 bg-[var(--bg)] p-4">
                                    <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                                    <div><p className="font-medium">{title}</p><p className="text-sm text-[var(--muted)]">{text}</p></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 02 Ligacoes */}
                <section id="ligacoes" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
                    <StepLabel n="02">Escolha a placa e ligue</StepLabel>
                    <h2 className="mt-2 [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] sm:text-5xl">Cada fio no seu lugar.</h2>
                    <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Placa">
                        {BOARDS.map(b => (
                            <button
                                key={b.id}
                                role="radio"
                                aria-checked={b.id === boardId}
                                onClick={() => setBoardId(b.id)}
                                className={`rounded-2xl border p-4 text-left transition-colors ${b.id === boardId ? 'border-[var(--ink)] bg-white shadow-[0_12px_30px_-20px_rgba(11,13,18,0.4)]' : 'border-black/10 bg-white/40 hover:bg-white'}`}
                            >
                                <span className="flex items-center justify-between">
                                    <span className="font-semibold">{b.name}</span>
                                    {b.id === boardId && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ink)]"><Check size={13} className="text-white" /></span>}
                                </span>
                                <span className="mt-1 block text-sm text-[var(--muted)]">{b.hint}</span>
                            </button>
                        ))}
                    </div>

                    <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                        <div className="rounded-3xl bg-white p-6 sm:p-8">
                            <p className="text-sm font-medium text-[var(--muted)]">Mapa de ligações · {board.name}</p>
                            <ul className="mt-6 space-y-3">
                                {board.wires.map(w => (
                                    <li key={w.to} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className={`w-[8.5rem] shrink-0 rounded-full px-3 py-1.5 text-center text-sm ${w.free ? 'border border-dashed border-[var(--ink)]/40 text-[var(--ink)]' : 'bg-[var(--ink)] font-mono text-white'}`}>{w.pin}</span>
                                        <span aria-hidden className="hidden h-px flex-1 border-t border-dashed border-black/20 sm:block" />
                                        <span className="font-medium">{w.to}</span>
                                        {w.note && <span className={`rounded-full px-2.5 py-0.5 text-xs ${w.note === 'opcional' ? 'bg-[var(--bg)] text-[var(--muted)]' : 'bg-[var(--accent)] text-[var(--ink)]'}`}>{w.note}</span>}
                                    </li>
                                ))}
                            </ul>
                            {board.sensorPins && (
                                <div className="mt-6 rounded-2xl bg-[var(--bg)] p-4">
                                    <p className="text-sm font-medium">Pinos livres para os sensores</p>
                                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Pinos livres para os sensores">
                                        {board.sensorPins.map(n => (
                                            <li key={n} className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs">{n}</li>
                                        ))}
                                    </ul>
                                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                                        Ligue o DS18B20 e o DHT22 em qualquer um deles: a placa procura e acha sozinha. Os outros pinos são da própria placa (memória, boot, USB) ou dos relés e do I²C. Não ligue sensor neles.
                                    </p>
                                </div>
                            )}
                            <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">
                                Alimente os sensores no 3,3 V e todos os GND juntos. Dois DS18B20 podem dividir o mesmo pino.
                                {board.id === 's3-35' && ' Os fios de dados do DS18B20 e do DHT22 podem ir em qualquer ordem nos pinos 3 e 4 do JST 4P: a placa percebe e se ajusta sozinha.'}
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="rounded-3xl bg-[var(--card)] p-6 text-white">
                                <p className="text-sm text-[#898E99]">Tipo de relé padrão</p>
                                <p className="mt-2 text-lg font-medium">{board.relayDefault}</p>
                                <p className="mt-2 text-sm leading-relaxed text-[#a3a7b0]">Usa SSR ou outro tipo? Troque no app, em Hardware, depois de instalar.</p>
                            </div>
                            <div className="flex gap-3 rounded-3xl border border-[#FF5A6E]/30 bg-[#FF5A6E]/10 p-6 text-sm leading-relaxed text-[#7a1f2b]" role="note">
                                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#d63a4d]" />
                                <span>Os relés comandam aparelhos na tomada (110/220 V). Faça a parte elétrica com tudo desligado, use caixa fechada e, sem experiência, peça ajuda a um eletricista.</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 03 Instalar */}
                <section id="instalar" className="scroll-mt-16 bg-[var(--card)] text-white">
                    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
                        <div>
                            <StepLabel n="03" dark>Instalar</StepLabel>
                            <h2 className="mt-2 [font-family:var(--font-display)] text-4xl font-light leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                                Um clique e o firmware <span className="text-[var(--accent)]">está gravado.</span>
                            </h2>
                            <ul className="mt-8 space-y-3 text-[#c9ccd3]">
                                {['Chrome ou Edge, no computador', 'Cabo USB de dados (alguns só carregam)', 'Se a placa não aparecer, segure o BOOT ao conectar', ...(headless ? ['Ao terminar, o instalador já pede o Wi-Fi da sua casa'] : [])].map(t => (
                                    <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />{t}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
                            <p className="text-sm text-[#898E99]">Placa selecionada</p>
                            <p className="mt-1 text-2xl font-medium">{board.name}</p>
                            <p className="mt-1 text-sm text-[#898E99]">{version ? `Versão ${version}` : manifestMissing ? 'Instalador indisponível' : 'Carregando versão…'}</p>
                            <div className="mt-8">
                                {!supportsWebSerial ? (
                                    <p className="rounded-2xl bg-white/5 p-4 text-sm text-[#c9ccd3]">Este navegador não acessa o USB. Abra esta página no <b>Chrome</b> ou no <b>Edge</b> de um computador.</p>
                                ) : manifestMissing ? (
                                    <p className="rounded-2xl bg-white/5 p-4 text-sm text-[#c9ccd3]">O instalador desta placa ainda não foi publicado. Tente mais tarde.</p>
                                ) : ready ? (
                                    <esp-web-install-button key={board.id} manifest={`/firmware/manifest/${board.id}.json`}>
                                        <button slot="activate" className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-4 text-[15px] font-semibold text-[var(--ink)] hover:brightness-95">
                                            <Usb size={18} /> Instalar no {board.name}
                                        </button>
                                    </esp-web-install-button>
                                ) : (
                                    <p className="text-sm text-[#898E99]">Carregando o instalador…</p>
                                )}
                            </div>
                            <p className="mt-4 text-xs text-[#6B6F78]">A instalação apaga o que estiver gravado na placa.</p>
                        </div>
                    </div>
                </section>

                {/* 04 Wi-Fi e app */}
                <section id="app" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
                    <StepLabel n="04">Wi-Fi e app</StepLabel>
                    <h2 className="mt-2 [font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] sm:text-5xl">Do celular, em três toques.</h2>
                    {headless && (
                        <p className="mt-6 max-w-2xl text-lg text-[var(--muted)]">Configurou o Wi-Fi no instalador? Então pule direto para o app. Se pulou essa etapa, use a rede Breww:</p>
                    )}
                    {headless ? (
                        <ol className="mt-10 grid gap-4 md:grid-cols-3">
                            {[
                                { icon: Wifi, title: 'Conecte na rede Breww', text: 'No celular, entre na rede Breww-XXXX. A página abre sozinha: escolha o Wi-Fi da sua casa e digite a senha.' },
                                { icon: Smartphone, title: 'Abra o app', text: 'Volte para o Wi-Fi de casa e toque em Adicionar aparelho.' },
                                { icon: Check, title: 'Pronto', text: 'Escolha o aparelho em Buscar na rede (ou digite o código da página de Wi-Fi). Ele entra na hora.' },
                            ].map(({ icon: Icon, title, text }, i) => (
                                <li key={title} className="rounded-3xl border border-black/5 bg-white p-7">
                                    <div className="flex items-center justify-between">
                                        <Icon size={22} strokeWidth={1.75} />
                                        <span className="font-mono text-sm text-[var(--muted)]">{String(i + 1).padStart(2, '0')}</span>
                                    </div>
                                    <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
                                    <p className="mt-2 leading-relaxed text-[var(--muted)]">{text}</p>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="mt-6 max-w-2xl text-lg text-[var(--muted)]">Siga o assistente na tela do aparelho para escolher o Wi-Fi. Depois, no app, toque em Adicionar aparelho e leia o QR code da tela.</p>
                    )}
                    {headless && (
                        <p className="mt-6 text-sm text-[var(--muted)]">LED da placa: piscando devagar = sem Wi-Fi; aceso = conectado. Segurar o BOOT por 10 segundos apaga o Wi-Fi e abre a rede Breww de novo.</p>
                    )}
                    <div className="mt-12 flex flex-wrap items-center gap-4">
                        <Link to="/register" className="group inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-6 py-3.5 text-[15px] font-medium text-white hover:bg-black">
                            Criar conta grátis <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                        </Link>
                        <span className="text-sm text-[var(--muted)]">Você vai precisar de uma conta no app. Algo deu errado? Veja a <Link to="/ajuda" className="font-medium text-[var(--ink)] underline underline-offset-4">ajuda</Link>.</span>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
};

export default Installer;
