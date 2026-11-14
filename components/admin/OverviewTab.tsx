import React, { useState, useEffect } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Um verde (o mais comum) e tons de cinza, como os graficos do app
const COLORS = ['#71FC8F', '#A3A7B0', '#6B6F78', '#4A4F59', '#D5D7DD'];

const Kpi: React.FC<{ label: string; value: string; suffix?: string; hint: string; tone?: 'ok' | 'warn' }> = ({ label, value, suffix, hint, tone }) => (
    <div className="app-card p-5">
        <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            {tone && <span className={`h-2 w-2 rounded-full ${tone === 'ok' ? 'bg-[var(--accent)]' : 'bg-[var(--danger)]'}`} aria-label={tone === 'ok' ? 'normal' : 'atenção'} />}
        </div>
        <p className="mt-3 flex items-baseline gap-2">
            <span className="[font-family:var(--font-display)] text-4xl font-light tracking-[-0.03em] tabular-nums">{value}</span>
            {suffix && <span className="text-sm text-[var(--muted)]">{suffix}</span>}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
);

export const OverviewTab: React.FC = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState<any>({ total_users: 0, total_devices: 0, active_batches: 0, online_devices: 0 });
    const [analytics, setAnalytics] = useState<any>({ growth: [], firmwares: [], mau: 0, zombies: 0 });
    const [trends, setTrends] = useState<any>({ styles: [], total_batches: 0 });
    const [community, setCommunity] = useState<any[]>([]);
    const [financials, setFinancials] = useState<any>({ free: 0, premium: 0, mrr: 0 });
    const [batchStats, setBatchStats] = useState<any>({ total: 0, success: 0, abandoned: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };
                const baseUrl = API_URL;
                const signal = controller.signal;

                const [resStats, resAnalytics, resTrends, resFin, resBatch, resComm] = await Promise.all([
                    fetch(`${baseUrl}/admin/stats`, { headers, signal }),
                    fetch(`${baseUrl}/admin/analytics`, { headers, signal }),
                    fetch(`${baseUrl}/admin/trends`, { headers, signal }),
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

    if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" role="status" aria-label="Carregando"></div></div>;

    return (
        <div className="space-y-6">

            {/* Precisa de atencao: o que pede uma acao, com o atalho para a secao certa */}
            {(() => {
                const latest = analytics.firmwares?.[0];
                const outdated = latest ? Math.max(0, (stats.total_devices || 0) - (latest.count || 0)) : 0;
                const items = [
                    (analytics.zombies || 0) > 0 && { to: '/admin/frota', text: `${analytics.zombies} ${analytics.zombies === 1 ? 'aparelho sem contato' : 'aparelhos sem contato'} há mais de 30 dias` },
                    outdated > 0 && { to: '/admin/frota', text: `${outdated} ${outdated === 1 ? 'aparelho fora' : 'aparelhos fora'} da versão ${latest.name}` },
                    stats.total_devices > 0 && stats.online_devices === 0 && { to: '/admin/telemetria', text: 'Nenhum aparelho online na última hora' },
                ].filter(Boolean) as { to: string; text: string }[];
                return (
                    <section className="app-card p-2" aria-labelledby="atencao-titulo">
                        <h2 id="atencao-titulo" className="px-3.5 pt-3 pb-2 text-[15px] text-[var(--muted)]">Precisa de atenção</h2>
                        {items.length === 0 ? (
                            <p className="flex items-center gap-3 px-3.5 pb-3 text-[15px] text-[var(--ink)]"><span aria-hidden className="h-2 w-2 rounded-full bg-[var(--accent)]" />Tudo em ordem.</p>
                        ) : (
                            <ul>
                                {items.map(it => (
                                    <li key={it.text}>
                                        <Link to={it.to} className="flex items-center gap-3 rounded-[18px] px-3.5 h-12 text-[15px] text-[var(--ink)] hover:bg-white/[0.05] transition-colors">
                                            <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--danger)] shrink-0" />
                                            <span className="flex-1 min-w-0 truncate">{it.text}</span>
                                            <ChevronRight size={16} className="text-[var(--tertiary)]" aria-hidden />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })()}

            {/* Numeros da plataforma */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <Kpi label="Aparelhos online" value={`${stats.online_devices}`} suffix={`de ${stats.total_devices}`} hint="com contato na última hora" tone={stats.total_devices && stats.online_devices === 0 ? 'warn' : 'ok'} />
                <Kpi label="Usuários ativos" value={`${analytics.mau || 0}`} suffix={`de ${stats.total_users}`} hint="com aparelho ativo em 30 dias" />
                <Kpi label="Lotes ativos" value={`${stats.active_batches}`} hint="fermentando agora" />
                <Kpi label="Aparelhos parados" value={`${analytics.zombies || 0}`} hint="sem contato há mais de 30 dias" tone={(analytics.zombies || 0) > 0 ? 'warn' : undefined} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="app-card p-5 flex justify-between items-center">
                    <div>
                        <div className="text-sm font-medium text-[var(--ink)] mb-1">Assinaturas</div>
                        <div className="text-xs text-[var(--muted)]">Premium e gratuitos · MRR estimado R$ {Number(financials?.mrr || 0).toFixed(2)}</div>
                    </div>
                    <div className="flex items-end gap-3 text-right">
                        <div>
                            <div className="text-2xl font-medium text-[var(--ink)]">{financials.premium}</div>
                            <div className="text-xs text-[var(--ink)] font-medium">Premium</div>
                        </div>
                        <div className="text-2xl font-medium text-black/35">/</div>
                        <div>
                            <div className="text-2xl font-medium text-[var(--muted)]">{financials.free}</div>
                            <div className="text-xs text-[var(--muted)] font-medium">Grátis</div>
                        </div>
                    </div>
                </div>

                <div className="app-card p-5 flex justify-between items-center">
                    <div>
                        <div className="text-sm font-medium text-[var(--ink)] mb-1">Lotes finalizados</div>
                        <div className="text-xs text-[var(--muted)]">Concluídos e abortados (inclui testes)</div>
                    </div>
                    <div className="flex items-end gap-3 text-right">
                        <div>
                            <div className="text-2xl font-medium text-[var(--accent)]">{batchStats.success}</div>
                            <div className="text-xs text-[var(--accent)]/70 font-medium">Concluídos</div>
                        </div>
                        <div className="text-2xl font-medium text-black/35">/</div>
                        <div>
                            <div className="text-2xl font-medium text-[#d63a4d]/60">{batchStats.abandoned}</div>
                            <div className="text-xs text-[var(--muted)] font-medium">Abortados</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="app-card p-5">
                    <h3 className="text-sm font-medium text-[var(--muted)] mb-6">Crescimento de usuários</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.growth || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis dataKey="month" stroke="#6B6F78" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6B6F78" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                                <Tooltip contentStyle={{ backgroundColor: '#20252F', color: '#ECECF1', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', boxShadow: '0 12px 30px -18px rgba(11,13,18,0.35)' }} labelStyle={{ color: '#898E99' }} itemStyle={{ color: '#ECECF1' }} />
                                <Line type="monotone" dataKey="users" name="Usuários" stroke="#71FC8F" strokeWidth={2} dot={{ r: 3.5, fill: '#71FC8F' }} activeDot={{ r: 6, fill: '#71FC8F', stroke: '#04070B', strokeWidth: 2 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="app-card p-5">
                    <h3 className="text-sm font-medium text-[var(--muted)] mb-6">Estilos mais feitos</h3>
                    <div className="h-64 w-full flex justify-center">
                        {(trends.styles && trends.styles.length > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={trends.styles} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="count">
                                        {trends.styles.map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#20252F', color: '#ECECF1', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', boxShadow: '0 12px 30px -18px rgba(11,13,18,0.35)' }} labelStyle={{ color: '#898E99' }} itemStyle={{ color: '#ECECF1' }} />
                                    <Legend iconType="circle" iconSize={8} formatter={(v: string) => <span style={{ color: '#2b2f37', fontSize: 13 }}>{v}</span>} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center text-[var(--muted)]">Sem dados suficientes</div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 app-card p-5">
                    <h3 className="text-sm font-medium text-[var(--muted)] mb-6">Estilos da comunidade</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-black/[0.07]">
                                    <th className="py-3 px-4 text-xs font-medium text-[var(--muted)] ">Estilo</th>
                                    <th className="py-3 px-4 text-right text-xs font-medium text-[var(--muted)]">Quantidade</th>
                                    <th className="py-3 px-4 text-right text-xs font-medium text-[var(--muted)]">Duração média</th>
                                    <th className="py-3 px-4 text-right text-xs font-medium text-[var(--muted)]">Álcool médio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {community.length > 0 ? community.map((item, i) => (
                                    <tr key={i} className="border-b border-black/[0.07] hover:bg-[var(--bg)]">
                                        <td className="py-3 px-4 font-medium text-[var(--ink)] flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                                            {item.name}
                                        </td>
                                        <td className="py-3 px-4 text-right tabular-nums text-[#2b2f37]">{item.count} {item.count === 1 ? 'lote' : 'lotes'}</td>
                                        <td className="py-3 px-4 text-right tabular-nums text-[var(--muted)]">{Math.round(item.avg_days || 0)} dias</td>
                                        <td className="py-3 px-4 text-right tabular-nums">{item.abv && item.abv !== '-' ? `${item.abv}%` : '—'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-center text-[var(--muted)] text-sm">Nenhum dado disponível.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="app-card p-5">
                    <h3 className="text-sm font-medium text-[var(--muted)] mb-6">Versões de firmware</h3>
                    <div className="space-y-4 mt-4">
                        {(analytics.firmwares && analytics.firmwares.length > 0) ? analytics.firmwares.map((fw: any, i: number) => (
                            <div key={i} className="flex flex-col gap-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-mono text-[var(--accent)]">{fw.name}</span>
                                    <span className="text-[var(--muted)]">{fw.count} disp.</span>
                                </div>
                                <div className="w-full bg-[var(--bg)] rounded-full h-2">
                                    <div className="bg-[var(--accent)] h-2 rounded-full" style={{ width: `${stats.total_devices > 0 ? Math.min((fw.count / stats.total_devices) * 100, 100) : 0}%` }}></div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center text-[var(--muted)] text-sm py-4">Nenhuma versão reportada via MQTT ainda.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
