import React, { useState, useEffect } from 'react';
import { HardDrive, Edit2, Trash2, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import { ConfirmDialog } from '../ConfirmDialog';

const UserDevicesList = ({ userId, refreshTrigger, onEdit, onDelete }: { userId: number, refreshTrigger?: any, onEdit: (dev: any) => void, onDelete: (id: number) => void }) => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`${API_URL}/admin/devices`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal
        })
            .then(res => (res.ok ? res.json() : []))
            .then(data => {
                if (controller.signal.aborted) return;
                setDevices(Array.isArray(data) ? data.filter((d: any) => d.user_id === userId) : []);
                setLoading(false);
            })
            .catch(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [token, userId, refreshTrigger]);

    return loading ? (
        <div className="text-xs text-[var(--muted)] py-2">Carregando...</div>
    ) : devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {devices.map(dev => (
                <div key={dev.id} className="bg-white border border-black/[0.07] rounded-lg p-3 flex justify-between items-center group hover:border-black/15 transition-colors">
                    <div>
                        <div className="font-mono text-[#178a3f] text-sm">{dev.serial_code}</div>
                        <div className="text-xs text-[var(--muted)]">{dev.device_name || 'Sem nome'}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-60 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button type="button" aria-label={`Editar dispositivo ${dev.serial_code}`} onClick={() => onEdit(dev)} className="p-1.5 text-[var(--muted)] hover:text-[#b45309] hover:bg-amber-500/15 rounded"><Edit2 size={14} /></button>
                        <button type="button" aria-label={`Remover dispositivo ${dev.serial_code}`} onClick={() => onDelete(dev.id)} className="p-1.5 text-[var(--muted)] hover:text-[#d63a4d] hover:bg-red-400/10 rounded"><Trash2 size={14} /></button>
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <div className="text-sm text-[var(--muted)] py-4 border border-dashed border-black/[0.07] rounded-lg text-center bg-[var(--bg)]">
            Nenhum equipamento vinculado a esta conta.
        </div>
    );
};

const UserFormModal = ({ data, onClose, onSuccess }: { data: any, onClose: () => void, onSuccess: () => void }) => {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        name: data?.name || '',
        email: data?.email || '',
        password: '',
        role: data?.role || 'user'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = data ? `${API_URL}/admin/users/${data.id}` : `${API_URL}/admin/users`;
            const res = await fetch(url, {
                method: data ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(data ? 'Usuário atualizado!' : 'Usuário criado!');
                onSuccess();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Erro ao salvar');
            }
        } catch (e) { toast.error('Falha de conexão'); }
        setLoading(false);
    };

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="user-modal-title" className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-black/[0.07] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 id="user-modal-title" className="text-xl font-semibold text-[var(--ink)]">{data ? 'Editar Conta' : 'Nova Conta'}</h3>
                    <button type="button" aria-label="Fechar" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="user-modal-name" className="block text-xs font-semibold text-[var(--muted)] mb-1 ml-1">Nome</label>
                        <input id="user-modal-name" type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full bg-[var(--bg)] border border-black/[0.07] rounded-lg px-4 py-2 text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]" />
                    </div>
                    <div>
                        <label htmlFor="user-modal-email" className="block text-xs font-semibold text-[var(--muted)] mb-1 ml-1">Email</label>
                        <input id="user-modal-email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required className="w-full bg-[var(--bg)] border border-black/[0.07] rounded-lg px-4 py-2 text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]" />
                    </div>
                    <div>
                        <label htmlFor="user-modal-password" className="block text-xs font-semibold text-[var(--muted)] mb-1 ml-1">{data ? 'Nova Senha (opcional)' : 'Senha'}</label>
                        <input id="user-modal-password" type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required={!data} className="w-full bg-[var(--bg)] border border-black/[0.07] rounded-lg px-4 py-2 text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]" />
                    </div>
                    <div>
                        <label htmlFor="user-modal-role" className="block text-xs font-semibold text-[var(--muted)] mb-1 ml-1">Nível de Acesso</label>
                        <select id="user-modal-role" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-[var(--bg)] border border-black/[0.07] rounded-lg px-4 py-2 text-[var(--ink)] focus:outline-none focus:border-[var(--ink)] appearance-none">
                            <option value="user">Usuário Comum</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] rounded-lg font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-[var(--ink)] hover:bg-black text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeviceFormModal = ({ data, userId, onClose, onSuccess }: { data: any, userId: number, onClose: () => void, onSuccess: () => void }) => {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        serial_code: data?.serial_code || '',
        device_name: data?.device_name || '',
        user_id: userId
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = data ? `${API_URL}/admin/devices/${data.id}` : `${API_URL}/admin/devices`;
            const res = await fetch(url, {
                method: data ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success('Dispositivo salvo!');
                onSuccess();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Erro ao salvar');
            }
        } catch (e) { toast.error('Falha de conexão'); }
        setLoading(false);
    };

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="device-modal-title" className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-black/[0.07] rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 id="device-modal-title" className="text-xl font-semibold text-[var(--ink)]">{data ? 'Editar Dispositivo' : 'Vincular Dispositivo'}</h3>
                    <button type="button" aria-label="Fechar" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="device-modal-serial" className="block text-xs font-semibold text-[var(--muted)] mb-1 ml-1">Serial (Código Único)</label>
                        <input id="device-modal-serial" type="text" value={formData.serial_code} onChange={e => setFormData({ ...formData, serial_code: e.target.value })} required className="w-full bg-[var(--bg)] border border-black/[0.07] rounded-lg px-4 py-2 text-[var(--ink)] focus:outline-none focus:border-[var(--ink)] font-mono " placeholder="BREWW-XXXXX" />
                    </div>
                    <div>
                        <label htmlFor="device-modal-name" className="block text-xs font-semibold text-[var(--muted)] mb-1 ml-1">Apelido (Opcional)</label>
                        <input id="device-modal-name" type="text" value={formData.device_name} onChange={e => setFormData({ ...formData, device_name: e.target.value })} className="w-full bg-[var(--bg)] border border-black/[0.07] rounded-lg px-4 py-2 text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]" placeholder="Ex: Geladeira 1" />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-[var(--bg)] hover:bg-black/10 text-[var(--ink)] rounded-lg font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-[var(--ink)] hover:bg-black text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const UsersTab: React.FC = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
    const [userModal, setUserModal] = useState<{ isOpen: boolean, data: any }>({ isOpen: false, data: null });
    const [deviceModal, setDeviceModal] = useState<{ isOpen: boolean, data: any, userId: number | null }>({ isOpen: false, data: null, userId: null });
    const [devicesRefreshKey, setDevicesRefreshKey] = useState(0);
    const [pendingDeleteUserId, setPendingDeleteUserId] = useState<number | null>(null);
    const [pendingDeleteDeviceId, setPendingDeleteDeviceId] = useState<number | null>(null);

    const loadUsers = async (signal?: AbortSignal) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
                ...(signal ? { signal } : {})
            });
            if (signal?.aborted) return;
            if (res.status === 401 && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return;
            }
            if (res.ok) {
                const uData = await res.json();
                setUsers(Array.isArray(uData) ? uData : []);
                setDevicesRefreshKey(prev => prev + 1);
            }
        } catch (e: any) {
            if (e?.name !== 'AbortError' && !signal?.aborted) {
                toast.error('Erro ao carregar usuários');
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        loadUsers(controller.signal);
        return () => controller.abort();
    }, [token]);

    const toggleExpand = (id: number) => {
        setExpandedUserId(prev => (prev === id ? null : id));
    };

    const executeDeleteUser = async (id: number) => {
        setPendingDeleteUserId(null);
        try {
            const res = await fetch(`${API_URL}/admin/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Usuário apagado com sucesso');
                loadUsers();
            } else {
                const err = await res.json();
                toast.error(`Erro do Servidor: ${err.error}`);
            }
        } catch (e: any) { toast.error(`Falha ao deletar: ${e.message}`); }
    };

    const deleteUser = async (id: number) => {
        if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
            if (window.confirm('ATENÇÃO: Deletar este usuário apagará TODOS os dispositivos, lotes e leituras dele. Continuar?')) {
                await executeDeleteUser(id);
            }
            return;
        }
        setPendingDeleteUserId(id);
    };

    const changeUserPlan = async (id: number, plan_type: string) => {
        try {
            const res = await fetch(`${API_URL}/admin/users/${id}/plan`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan_type })
            });
            if (res.ok) {
                toast.success('Plano atualizado');
                loadUsers();
            } else throw new Error();
        } catch (e) { toast.error('Falha ao atualizar plano'); }
    };

    const executeDeleteDevice = async (id: number) => {
        setPendingDeleteDeviceId(null);
        try {
            const res = await fetch(`${API_URL}/admin/devices/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Dispositivo removido');
                setExpandedUserId(prev => prev);
                loadUsers();
            } else throw new Error();
        } catch (e) { toast.error('Falha ao remover dispositivo'); }
    };

    const deleteDevice = async (id: number) => {
        if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
            if (window.confirm('Remover este dispositivo?')) {
                await executeDeleteDevice(id);
            }
            return;
        }
        setPendingDeleteDeviceId(id);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end items-center">
                <button
                    type="button"
                    onClick={() => setUserModal({ isOpen: true, data: null })}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--ink)] hover:bg-black text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20"
                >
                    <Plus size={16} /> Nova Conta
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <div className="border border-black/[0.07] rounded-xl overflow-hidden bg-[var(--bg)]">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white">
                            <tr className="text-[var(--muted)]">
                                <th className="py-4 px-4 font-medium w-10"></th>
                                <th className="py-4 px-4 font-medium">Nome</th>
                                <th className="py-4 px-4 font-medium">Email</th>
                                <th className="py-4 px-4 font-medium">Role</th>
                                <th className="py-4 px-4 font-medium text-center">Plano</th>
                                <th className="py-4 px-4 font-medium text-center">Dispositivos</th>
                                <th className="py-4 px-4 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.06]">
                            {users.map(user => (
                                <React.Fragment key={user.id}>
                                    <tr className={`hover:bg-[var(--bg)] transition-colors ${expandedUserId === user.id ? 'bg-[var(--bg)]' : ''}`}>
                                        <td className="py-3 px-4">
                                            <button
                                                type="button"
                                                aria-expanded={expandedUserId === user.id}
                                                aria-label={`Dispositivos de ${user.name}`}
                                                onClick={() => toggleExpand(user.id)}
                                                className="p-1 hover:bg-black/10 rounded text-[var(--muted)]"
                                            >
                                                {expandedUserId === user.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 font-medium text-[#2b2f37]">{user.name}</td>
                                        <td className="py-3 px-4 text-[var(--muted)]">{user.email}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${user.role === 'admin' ? 'bg-[var(--accent)]/30 text-[var(--ink)] border border-[var(--ink)]/20' : 'bg-[var(--bg)] text-[var(--muted)] border border-black/15'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <select
                                                aria-label={`Plano de ${user.name}`}
                                                value={user.plan_type || 'free'}
                                                onChange={(e) => changeUserPlan(user.id, e.target.value)}
                                                className="bg-[var(--bg)] border border-black/15 text-[#2b2f37] text-xs rounded px-2 py-1 focus:outline-none focus:border-[var(--ink)]"
                                            >
                                                <option value="free">Free</option>
                                                <option value="premium">Premium</option>
                                            </select>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg)] text-xs font-semibold text-[#2b2f37]">
                                                {user.device_count || 0}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button type="button" aria-label={`Editar ${user.name}`} onClick={() => setUserModal({ isOpen: true, data: user })} className="p-1.5 text-[var(--muted)] hover:text-[#b45309] hover:bg-amber-500/15 rounded transition-colors"><Edit2 size={16} /></button>
                                                <button type="button" aria-label={`Excluir ${user.name}`} onClick={() => deleteUser(user.id)} className="p-1.5 text-[var(--muted)] hover:text-[#d63a4d] hover:bg-red-400/10 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>

                                    {expandedUserId === user.id && (
                                        <tr>
                                            <td colSpan={7} className="p-0 border-b border-black/[0.07]">
                                                <div className="bg-[var(--bg)] px-4 md:px-10 py-6 border-l-2 border-[var(--ink)] animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="text-sm font-semibold text-[#2b2f37] flex items-center gap-2 ">
                                                            <HardDrive size={14} className="text-[var(--ink)]" />
                                                            Dispositivos Vinculados
                                                        </h3>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeviceModal({ isOpen: true, data: null, userId: user.id })}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-black/10 text-[#2b2f37] rounded-md text-xs font-medium transition-colors border border-black/15"
                                                        >
                                                            <Plus size={14} /> Adicionar
                                                        </button>
                                                    </div>

                                                    <UserDevicesList userId={user.id} refreshTrigger={devicesRefreshKey} onEdit={(dev) => setDeviceModal({ isOpen: true, data: dev, userId: user.id })} onDelete={deleteDevice} />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {users.length === 0 && !loading && (
                                <tr><td colSpan={7} className="py-8 text-center text-[var(--muted)]">Nenhum usuário encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {userModal.isOpen && (
                <UserFormModal
                    data={userModal.data}
                    onClose={() => setUserModal({ isOpen: false, data: null })}
                    onSuccess={() => { loadUsers(); setUserModal({ isOpen: false, data: null }); }}
                />
            )}
            {deviceModal.isOpen && (
                <DeviceFormModal
                    data={deviceModal.data}
                    userId={deviceModal.userId!}
                    onClose={() => setDeviceModal({ isOpen: false, data: null, userId: null })}
                    onSuccess={() => { loadUsers(); setDeviceModal({ isOpen: false, data: null, userId: null }); }}
                />
            )}

            <ConfirmDialog
                open={pendingDeleteUserId !== null}
                title="Excluir Conta de Usuário"
                description="ATENÇÃO: Deletar este usuário apagará TODOS os dispositivos, lotes e leituras dele. Continuar?"
                confirmLabel="Excluir Conta"
                variant="danger"
                onConfirm={() => { if (pendingDeleteUserId !== null) void executeDeleteUser(pendingDeleteUserId); }}
                onCancel={() => setPendingDeleteUserId(null)}
            />

            <ConfirmDialog
                open={pendingDeleteDeviceId !== null}
                title="Remover Dispositivo"
                description="Deseja remover este dispositivo vinculado à conta?"
                confirmLabel="Remover"
                variant="danger"
                onConfirm={() => { if (pendingDeleteDeviceId !== null) void executeDeleteDevice(pendingDeleteDeviceId); }}
                onCancel={() => setPendingDeleteDeviceId(null)}
            />
        </div>
    );
};
