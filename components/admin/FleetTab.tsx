import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

// Frota (Fase 5.3): aparelhos por placa, versao de firmware e hardware detectado (telemetria board/mods)

type Row = { name: string; count: number; online: number };
type Fleet = { total: number; online: number; reporting: number; boards: Row[]; versions: Row[]; modules: Row[] };

const BOARD_NAME: Record<string, string> = {
    's3-35': 'Breww com tela 3,5"',
    'esp32-devkit': 'ESP32 DevKit',
    's3-headless': 'ESP32-S3 (sem tela)',
    'c3-headless': 'ESP32-C3 SuperMini',
};
const MODULE_NAME: Record<string, string> = {
    tela35: 'Tela touch 3,5"', oled: 'Tela OLED', lcd2004: 'LCD 20x4',
    dht22: 'Umidade DHT22', sht3x: 'Umidade SHT3x', aht20: 'Umidade AHT20', bme280: 'Umidade BME280',
};
const moduleLabel = (m: string) => MODULE_NAME[m] ?? (m.startsWith('ds18b20 x') ? `${m.slice(9)} sensor(es) de temperatura` : m);

function Bars({ title, rows, label, total, highlight }: { title: string; rows: Row[]; label: (n: string) => string; total: number; highlight?: string }) {
    return (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {rows.length === 0 ? <p className="mt-4 text-sm text-neutral-500">Nenhum dado ainda.</p> : (
                <ul className="mt-4 space-y-3">
                    {rows.map(r => (
                        <li key={r.name}>
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                                <span className="text-neutral-200">
                                    {label(r.name)}
                                    {highlight && r.name === highlight && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">atual</span>}
                                </span>
                                <span className="tabular-nums text-neutral-400">{r.count} <span className="text-neutral-600">· {r.online} online</span></span>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-neutral-800">
                                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${total ? Math.max(3, (r.count / total) * 100) : 0}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export const FleetTab = () => {
    const { token } = useAuth();
    const [fleet, setFleet] = useState<Fleet | null>(null);
    const [latest, setLatest] = useState<string | undefined>();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const load = () => {
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/admin/fleet`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                if (res.status === 401) { window.dispatchEvent(new CustomEvent('auth:unauthorized')); throw new Error('Sessão expirada'); }
                if (!res.ok) throw new Error('Falha ao carregar a frota');
                return res.json();
            })
            .then(setFleet)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
        fetch(`/firmware/version.json?t=${Date.now()}`).then(r => (r.ok ? r.json() : null)).then(v => setLatest(v?.version)).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [token]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Frota</h2>
                    <p className="text-sm text-neutral-400">Aparelhos por placa, versão de firmware e hardware detectado.</p>
                </div>
                <button type="button" onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-700 disabled:opacity-50">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar
                </button>
            </div>
            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
            {fleet && (
                <>
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[
                            { k: 'Aparelhos', v: fleet.total },
                            { k: 'Online (1 h)', v: fleet.online },
                            { k: 'Informando placa', v: `${fleet.reporting} de ${fleet.total}` },
                        ].map(c => (
                            <div key={c.k} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
                                <p className="text-sm text-neutral-400">{c.k}</p>
                                <p className="mt-1 text-3xl font-bold tabular-nums text-white">{c.v}</p>
                            </div>
                        ))}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                        <Bars title="Por placa" rows={fleet.boards} label={n => BOARD_NAME[n] ?? n} total={fleet.total} />
                        <Bars title="Por versão do firmware" rows={fleet.versions} label={n => n} total={fleet.total} highlight={latest} />
                        <Bars title="Hardware detectado" rows={fleet.modules} label={moduleLabel} total={fleet.total} />
                    </div>
                    <p className="text-xs text-neutral-500">Placa e hardware aparecem quando o aparelho manda telemetria com firmware 2.8.3 ou mais novo.</p>
                </>
            )}
        </div>
    );
};
