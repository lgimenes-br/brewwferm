import React, { useEffect, useState } from 'react';
import { Usb, Cpu, Wifi, Smartphone, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

// Instalador do firmware pelo navegador (Fase 3, item 1). Usa o ESP Web Tools (Web Serial):
// o servidor gera o manifest de cada placa em /firmware/manifest/<placa>.json.

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            'esp-web-install-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { manifest?: string };
        }
    }
}

type Board = {
    id: string;
    name: string;
    hint: string;
    pins: { label: string; pin: string }[];
    relayNote: string;
};

// Pinos iguais aos de boards/*.h do firmware
const BOARDS: Board[] = [
    {
        id: 'esp32-devkit',
        name: 'ESP32 DevKit',
        hint: 'O mais barato e fácil de achar (ESP32-WROOM-32 / DevKit V1).',
        pins: [
            { label: 'Sensor DS18B20 (dados)', pin: 'GPIO 23' },
            { label: 'DHT22 (opcional)', pin: 'GPIO 19' },
            { label: 'Relé de aquecer', pin: 'GPIO 26' },
            { label: 'Relé de resfriar', pin: 'GPIO 27' },
            { label: 'Tela I²C (opcional) SDA / SCL', pin: 'GPIO 21 / 22' }
        ],
        relayNote: 'Módulo de relé comum (liga em nível baixo) é o padrão.'
    },
    {
        id: 's3-headless',
        name: 'ESP32-S3 (sem tela)',
        hint: 'ESP32-S3-DevKitC ou similar.',
        pins: [
            { label: 'Sensor DS18B20 (dados)', pin: 'GPIO 17' },
            { label: 'DHT22 (opcional)', pin: 'GPIO 18' },
            { label: 'Relé de aquecer', pin: 'GPIO 9' },
            { label: 'Relé de resfriar', pin: 'GPIO 14' },
            { label: 'Tela I²C (opcional) SDA / SCL', pin: 'GPIO 4 / 5' }
        ],
        relayNote: 'Módulo de relé comum (liga em nível baixo) é o padrão.'
    },
    {
        id: 'c3-headless',
        name: 'ESP32-C3 SuperMini',
        hint: 'Bem pequeno. Poucos pinos, mas suficiente.',
        pins: [
            { label: 'Sensor DS18B20 (dados)', pin: 'GPIO 3' },
            { label: 'DHT22 (opcional)', pin: 'GPIO 4' },
            { label: 'Relé de aquecer', pin: 'GPIO 5' },
            { label: 'Relé de resfriar', pin: 'GPIO 6' },
            { label: 'Tela I²C (opcional) SDA / SCL', pin: 'GPIO 7 / 10' }
        ],
        relayNote: 'Módulo de relé comum (liga em nível baixo) é o padrão.'
    },
    {
        id: 's3-35',
        name: 'Breww com tela 3,5"',
        hint: 'A placa oficial com tela touch (ESP32-S3 + AXS15231B).',
        pins: [
            { label: 'Sensor DS18B20 (dados)', pin: 'GPIO 17' },
            { label: 'DHT22 (opcional)', pin: 'GPIO 18' },
            { label: 'Relé de aquecer', pin: 'GPIO 9' },
            { label: 'Relé de resfriar', pin: 'GPIO 14' }
        ],
        relayNote: 'Relés da placa oficial (ligam em nível alto).'
    }
];

const supportsWebSerial = typeof navigator !== 'undefined' && 'serial' in navigator;

export const Installer: React.FC = () => {
    const [boardId, setBoardId] = useState(BOARDS[0].id);
    const [ready, setReady] = useState(false);
    const [version, setVersion] = useState<string | null>(null);
    const [manifestMissing, setManifestMissing] = useState(false);
    const board = BOARDS.find(b => b.id === boardId)!;
    const headless = board.id !== 's3-35';

    // Carrega o componente do ESP Web Tools so nesta pagina
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
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
                <header className="space-y-2">
                    <h1 className="text-3xl font-black">Instale o Breww no seu ESP32</h1>
                    <p className="text-neutral-400">
                        Grave o firmware direto pelo navegador, sem instalar nada no computador. Depois é só configurar o Wi-Fi pelo celular e
                        vincular ao app.
                    </p>
                </header>

                {/* 1. Placa */}
                <section className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Cpu size={20} className="text-amber-500" /> 1. Escolha a placa</h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {BOARDS.map(b => (
                            <button
                                key={b.id}
                                onClick={() => setBoardId(b.id)}
                                className={`text-left rounded-2xl p-4 border transition-colors ${b.id === boardId ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 hover:border-neutral-600'}`}
                            >
                                <div className="font-semibold">{b.name}</div>
                                <div className="text-sm text-neutral-400">{b.hint}</div>
                            </button>
                        ))}
                    </div>
                </section>

                {/* 2. Ligacoes */}
                <section className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Zap size={20} className="text-amber-500" /> 2. Ligações</h2>
                    <table className="w-full text-sm">
                        <tbody>
                            {board.pins.map(p => (
                                <tr key={p.label} className="border-b border-neutral-800 last:border-0">
                                    <td className="py-2 text-neutral-300">{p.label}</td>
                                    <td className="py-2 text-right font-mono text-amber-400">{p.pin}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <ul className="text-sm text-neutral-400 space-y-1 list-disc pl-5">
                        <li>DS18B20: resistor de 4,7 kΩ entre o fio de dados e o 3,3 V. Dois sensores podem dividir o mesmo pino.</li>
                        <li>{board.relayNote} Se usar SSR, troque o tipo de relé depois da instalação.</li>
                    </ul>
                    <div className="flex gap-3 rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-200">
                        <AlertTriangle size={20} className="shrink-0 text-red-400" />
                        <span>
                            Os relés comandam aparelhos ligados na tomada (110/220 V). Faça a ligação elétrica com o equipamento desligado, use caixa
                            fechada e, se não tiver experiência, peça ajuda a um eletricista.
                        </span>
                    </div>
                </section>

                {/* 3. Instalar */}
                <section className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Usb size={20} className="text-amber-500" /> 3. Instale</h2>
                    <p className="text-sm text-neutral-400">
                        Ligue a placa no computador com um cabo USB <b>de dados</b> (alguns cabos só carregam) e clique em Instalar. Funciona no
                        Chrome ou no Edge, no computador.
                        {version && <> Versão <span className="font-mono text-neutral-200">{version}</span>.</>}
                    </p>
                    {!supportsWebSerial ? (
                        <div className="rounded-2xl bg-neutral-800/60 p-4 text-sm text-neutral-300">
                            Este navegador não consegue acessar o USB. Abra esta página no <b>Chrome</b> ou no <b>Edge</b> de um computador.
                        </div>
                    ) : manifestMissing ? (
                        <div className="rounded-2xl bg-neutral-800/60 p-4 text-sm text-neutral-300">
                            O instalador desta placa ainda não foi publicado. Tente novamente mais tarde.
                        </div>
                    ) : ready ? (
                        <esp-web-install-button key={board.id} manifest={`/firmware/manifest/${board.id}.json`}>
                            <button slot="activate" className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400">
                                Instalar no {board.name}
                            </button>
                        </esp-web-install-button>
                    ) : (
                        <div className="text-sm text-neutral-500">Carregando o instalador...</div>
                    )}
                    <p className="text-xs text-neutral-500">
                        A instalação apaga o que estiver gravado na placa. Se ela não for reconhecida, segure o botão BOOT enquanto conecta o cabo.
                    </p>
                </section>

                {/* 4. Depois */}
                <section className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Wifi size={20} className="text-amber-500" /> 4. Wi-Fi e app</h2>
                    {headless ? (
                        <ol className="space-y-3 text-sm text-neutral-300">
                            <li className="flex gap-3"><Wifi size={18} className="shrink-0 text-amber-500" /> No celular, conecte na rede <b>Breww-XXXX</b>. A página de configuração abre sozinha: escolha o Wi-Fi da sua casa e digite a senha.</li>
                            <li className="flex gap-3"><Smartphone size={18} className="shrink-0 text-amber-500" /> Volte para o Wi-Fi de casa, abra o app Breww e toque em <b>Adicionar aparelho</b>.</li>
                            <li className="flex gap-3"><CheckCircle2 size={18} className="shrink-0 text-amber-500" /> Quando o pedido chegar, <b>segure o botão BOOT da placa por 3 segundos</b> para confirmar.</li>
                        </ol>
                    ) : (
                        <p className="text-sm text-neutral-300">Siga o assistente na tela do aparelho para escolher o Wi-Fi e vincular ao app.</p>
                    )}
                    {headless && (
                        <p className="text-xs text-neutral-500">
                            LED da placa: piscando devagar = sem Wi-Fi; aceso = conectado. Segurar o BOOT por 10 segundos apaga o Wi-Fi e abre a
                            rede Breww-XXXX de novo.
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Installer;
