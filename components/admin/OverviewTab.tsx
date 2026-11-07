import React, { useState, useEffect } from 'react';
import { Users, Activity, Zap, DollarSign } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

export const OverviewTab: React.FC = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState<any>({ total_users: 0, total_devices: 0, active_batches: 0, online_devices: 0 });
    const [analytics, setAnalytics] = useState<any>({ growth: [], firmwares: [], mau: 0, zombies: 0 });
    const [trends, setTrends] = useState<any>({ styles: [], total_batches: 0 });
    const [community, setCommunity] = useState<any[]>([]);
    const [financials, setFinancials] = useState<any>({ free: 0, premium: 0, mrr: 0 });
    const [batchStats, setBatchStats] = useState<any>({ total: 0, success: 0, abandoned: 0 });
    const [mapData, setMapData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };
                const baseUrl = API_URL;
                const signal = controller.signal;

                const [resStats, resAnalytics, resTrends, resMap, resFin, resBatch, resComm] = await Promise.all([
                    fetch(`${baseUrl}/admin/stats`, { headers, signal }),
                    fetch(`${baseUrl}/admin/analytics`, { headers, signal }),
                    fetch(`${baseUrl}/admin/trends`, { headers, signal }),
                    fetch(`${baseUrl}/admin/map`, { headers, signal }),
                    fetch(`${baseUrl}/admin/financials`, { headers, signal }),
                    fetch(`${baseUrl}/admin/batch-stats`, { headers, signal }),
                    fetch(`${baseUrl}/admin/community-trends`, { headers, signal })
                ]);
                if (signal.aborted) return;
                if (resStats.status === 401 && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                    return;
                }

                if (resStats.ok) setStats(await resStats.json());
                if (resAnalytics.ok) setAnalytics(await resAnalytics.json());
                if (resTrends.ok) setTrends(await resTrends.json());
                if (resMap.ok) {
                    const mData = await resMap.json();
                    setMapData(Array.isArray(mData) ? mData : []);
                }
                if (resFin.ok) setFinancials(await resFin.json());
                if (resBatch.ok) setBatchStats(await resBatch.json());
                if (resComm.ok) {
                    const cData = await resComm.json();
                    setCommunity(Array.isArray(cData) ? cData : []);
                }
            } catch (e: any) {
                if (e?.name !== 'AbortError') {
                    console.error(e);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };
        fetchData();
        return () => controller.abort();
    }, [token]);

    if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white mb-6">Métricas e Inteligência de Negócio</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                    <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400 mb-3"><Users size={24} /></div>
                    <div className="text-3xl font-black text-white">{stats.total_users}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1">Total de Usuários</div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3 z-10"><Activity size={24} /></div>
                    <div className="text-3xl font-black text-white z-10">{analytics.mau || 0}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1 z-10">Usuários Ativos Mensais (MAU)</div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
                    <div className="p-3 bg-amber-500/10 rounded-full text-amber-400 mb-3 z-10"><DollarSign size={24} /></div>
                    <div className="text-3xl font-black text-white z-10">R$ {Number(financials?.mrr || 0).toFixed(2)}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1 z-10">MRR (Premium)</div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl"></div>
                    <div className="p-3 bg-red-500/10 rounded-full text-red-400 mb-3 z-10"><Zap size={24} /></div>
                    <div className="text-3xl font-black text-white z-10">{analytics.zombies || 0}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold mt-1 z-10">Dispositivos Zumbis (&gt;30 dias)</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex justify-between items-center">
                    <div>
                        <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">Funil de Assinatura</div>
                        <div className="text-xs text-neutral-500">Usuários Premium vs Gratuitos</div>
                    </div>
                    <div className="flex items-end gap-3 text-right">
                        <div>
                            <div className="text-2xl font-bold text-white">{financials.premium}</div>
                            <div className="text-xs text-amber-500 uppercase tracking-widest font-bold">Premium</div>
                        </div>
                        <div className="text-2xl font-bold text-neutral-700">/</div>
                        <div>
                            <div className="text-2xl font-bold text-neutral-400">{financials.free}</div>
                            <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Free</div>
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex justify-between items-center">
                    <div>
                        <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">Taxa de Sucesso (Lotes)</div>
                        <div className="text-xs text-neutral-500">Completos vs Abortados/Testes</div>
                    </div>
                    <div className="flex items-end gap-3 text-right">
                        <div>
                            <div className="text-2xl font-bold text-emerald-400">{batchStats.success}</div>
                            <div className="text-xs text-emerald-500/50 uppercase tracking-widest font-bold">Concluídos</div>
                        </div>
                        <div className="text-2xl font-bold text-neutral-700">/</div>
                        <div>
                            <div className="text-2xl font-bold text-red-400/50">{batchStats.abandoned}</div>
                            <div className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Abortados</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Crescimento de Usuários</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.growth || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                                <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                                <YAxis stroke="#737373" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Estilos de Cerveja Favoritos</h3>
                    <div className="h-64 w-full flex justify-center">
                        {(trends.styles && trends.styles.length > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={trends.styles} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="count">
                                        {trends.styles.map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center text-neutral-500">Sem dados suficientes</div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Tendências da Comunidade e Estilos Populares</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-neutral-800">
                                    <th className="py-3 px-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Estilo</th>
                                    <th className="py-3 px-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Quantidade</th>
                                    <th className="py-3 px-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Duração Média</th>
                                    <th className="py-3 px-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">ABV Médio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {community.length > 0 ? community.map((item, i) => (
                                    <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                            {item.name}
                                        </td>
                                        <td className="py-3 px-4 text-neutral-300">{item.count} lotes</td>
                                        <td className="py-3 px-4 text-neutral-400">{Math.round(item.avg_days || 0)} dias</td>
                                        <td className="py-3 px-4 text-amber-400 font-mono">{item.abv}%</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-center text-neutral-500 text-sm">Nenhum dado disponível.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Mapa Global de Dispositivos</h3>
                    <div className="w-full aspect-[2/1] bg-neutral-950 rounded-lg overflow-hidden border border-neutral-800">
                        <ComposableMap projectionConfig={{ scale: 140 }} width={800} height={400} style={{ width: '100%', height: '100%' }}>
                            <Geographies geography={geoUrl}>
                                {({ geographies }) => geographies.map(geo => (
                                    <Geography key={geo.rsmKey} geography={geo} fill="#171717" stroke="#262626" strokeWidth={0.5} />
                                ))}
                            </Geographies>
                            {mapData.map(({ name, lat, lon }, i) => {
                                const numLon = Number(lon);
                                const numLat = Number(lat);
                                if (isNaN(numLon) || isNaN(numLat)) return null;
                                return (
                                    <Marker key={`${name || 'loc'}-${i}`} coordinates={[numLon, numLat]}>
                                        <circle r={4} fill="#10b981" className="animate-pulse" />
                                        <circle r={2} fill="#059669" />
                                    </Marker>
                                );
                            })}
                        </ComposableMap>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Versões de Firmware</h3>
                    <div className="space-y-4 mt-4">
                        {(analytics.firmwares && analytics.firmwares.length > 0) ? analytics.firmwares.map((fw: any, i: number) => (
                            <div key={i} className="flex flex-col gap-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-mono text-emerald-400">{fw.name}</span>
                                    <span className="text-neutral-400">{fw.count} disp.</span>
                                </div>
                                <div className="w-full bg-neutral-800 rounded-full h-2">
                                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stats.total_devices > 0 ? Math.min((fw.count / stats.total_devices) * 100, 100) : 0}%` }}></div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center text-neutral-500 text-sm py-4">Nenhuma versão reportada via MQTT ainda.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
