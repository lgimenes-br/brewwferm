import React, { useState, useEffect } from 'react';
import { Users, HardDrive, TestTube, Edit2, Trash2, Plus, X, Search, ChevronDown, ChevronRight, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard = () => {
    const { token, logout, user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'users' | 'ingredients'>('users');

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-black text-neutral-300">
            {/* Top Bar exclusively for Admin */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-neutral-900/80">
                <div className="max-w-7xl mx-auto px-4 md:px-10 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-baseline">
                            <span className="text-2xl font-black text-white tracking-tighter">BREW</span>
                            <div className="relative">
                                <span className="text-2xl font-black text-white tracking-tighter">W</span>
                                <div className="absolute top-0 -right-1 w-1.5 h-1 bg-white rounded-tr-sm"></div>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest border border-indigo-500/30">
                            Admin
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium hidden md:block">{user?.name}</span>
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                        >
                            <LogOut size={16} /> <span className="hidden md:inline">Sair</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-10 py-8 animate-in fade-in duration-500">
                <div className="flex flex-col gap-2 mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ShieldAlert className="text-indigo-500" size={32} />
                        Centro de Controle
                    </h1>
                    <p className="text-neutral-400">Gerencie contas, equipamentos e o banco de ingredientes do sistema.</p>
                </div>

                {/* Tabs */}
                <div className="flex space-x-2 border-b border-neutral-800 mb-6 overflow-x-auto pb-2">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-all whitespace-nowrap ${
                            activeTab === 'users' ? 'bg-neutral-800 text-white shadow-[inset_0_2px_0_0_#6366f1]' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
                        }`}
                    >
                        <Users size={16} /> Contas e Dispositivos
                    </button>
                    <button
                        onClick={() => setActiveTab('ingredients')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-all whitespace-nowrap ${
                            activeTab === 'ingredients' ? 'bg-neutral-800 text-white shadow-[inset_0_2px_0_0_#6366f1]' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
                        }`}
                    >
                        <TestTube size={16} /> Banco de Ingredientes
                    </button>
                </div>

                {/* Tab Content */}
                <div className="bg-neutral-900/30 backdrop-blur-sm rounded-xl border border-neutral-800 p-6 shadow-2xl">
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'ingredients' && <IngredientsTab />}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// USERS & DEVICES TAB (ACCORDION)
// ==========================================

const UsersTab = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

    // Modals
    const [userModal, setUserModal] = useState<{isOpen: boolean, data: any}>({ isOpen: false, data: null });
    const [deviceModal, setDeviceModal] = useState<{isOpen: boolean, data: any, userId: number | null}>({ isOpen: false, data: null, userId: null });

    const loadUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setUsers(await res.json());
            }
        } catch (e) {
            toast.error('Erro ao carregar usuários');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, [token]);

    const toggleExpand = (id: number) => {
        setExpandedUserId(prev => prev === id ? null : id);
    };

    const deleteUser = async (id: number) => {
        if (!window.confirm('ATENÇÃO: Deletar este usuário apagará TODOS os dispositivos, lotes e leituras dele. Continuar?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Usuário apagado com sucesso');
                loadUsers();
            } else throw new Error();
        } catch (e) { toast.error('Falha ao deletar usuário'); }
    };

    const deleteDevice = async (id: number) => {
        if (!window.confirm('Remover este dispositivo?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success('Dispositivo removido');
                setExpandedUserId(prev => prev); // re-trigger if needed, but we will rely on reload
                loadUsers();
            } else throw new Error();
        } catch (e) { toast.error('Falha ao remover dispositivo'); }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Gerenciamento de Contas</h2>
                <button 
                    onClick={() => setUserModal({ isOpen: true, data: null })}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20"
                >
                    <Plus size={16} /> Nova Conta
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-black/20">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-900">
                            <tr className="text-neutral-400">
                                <th className="py-4 px-4 font-medium w-10"></th>
                                <th className="py-4 px-4 font-medium">Nome</th>
                                <th className="py-4 px-4 font-medium">Email</th>
                                <th className="py-4 px-4 font-medium">Role</th>
                                <th className="py-4 px-4 font-medium text-center">Dispositivos</th>
                                <th className="py-4 px-4 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {users.map(user => (
                                <React.Fragment key={user.id}>
                                    <tr className={`hover:bg-neutral-800/30 transition-colors ${expandedUserId === user.id ? 'bg-neutral-800/20' : ''}`}>
                                        <td className="py-3 px-4">
                                            <button 
                                                onClick={() => toggleExpand(user.id)}
                                                className="p-1 hover:bg-neutral-700 rounded text-neutral-400"
                                            >
                                                {expandedUserId === user.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </button>
                                        </td>
                                        <td className="py-3 px-4 font-medium text-neutral-200">{user.name}</td>
                                        <td className="py-3 px-4 text-neutral-400">{user.email}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-neutral-800 text-xs font-bold text-neutral-300">
                                                {user.device_count || 0}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setUserModal({ isOpen: true, data: user })} className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => deleteUser(user.id)} className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                    
                                    {/* Inline Devices Accordion */}
                                    {expandedUserId === user.id && (
                                        <tr>
                                            <td colSpan={6} className="p-0 border-b border-neutral-800">
                                                <div className="bg-black/40 px-4 md:px-10 py-6 border-l-2 border-indigo-500 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2 uppercase tracking-widest">
                                                            <HardDrive size={14} className="text-indigo-500" />
                                                            Dispositivos Vinculados
                                                        </h3>
                                                        <button 
                                                            onClick={() => setDeviceModal({ isOpen: true, data: null, userId: user.id })}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md text-xs font-medium transition-colors border border-neutral-700"
                                                        >
                                                            <Plus size={14} /> Adicionar
                                                        </button>
                                                    </div>
                                                    
                                                    <UserDevicesList userId={user.id} onEdit={(dev) => setDeviceModal({ isOpen: true, data: dev, userId: user.id })} onDelete={deleteDevice} />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {users.length === 0 && !loading && (
                                <tr><td colSpan={6} className="py-8 text-center text-neutral-500">Nenhum usuário encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
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
        </div>
    );
};

// Component to load devices for a specific user
const UserDevicesList = ({ userId, onEdit, onDelete }: { userId: number, onEdit: (dev: any) => void, onDelete: (id: number) => void }) => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch all devices from admin endpoint and filter by user_id
        // (Assuming the backend endpoint returns user_id or we filter by user)
        // Actually, the current API GET /api/admin/devices returns d.* or similar?
        // In server.js it returns: d.id, d.serial_code, d.device_name, d.last_seen, u.name...
        // Wait, it doesn't return user_id. We need to fetch devices for this specific user.
        // Let's use the normal GET /api/devices which returns devices for the logged-in user, BUT admin needs ALL.
        // Let's modify the filtering client side if user_id is missing, but wait, the API was already updated implicitly? No.
        // Let's just fetch from /api/admin/devices and we will use a quick fix: we'll match by email or modify server.js to include user_id.
        // Since I'm writing this, I know server.js needs user_id in the query. I will update server.js.
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => { 
            // In case user_id is returned by the API
            setDevices(data.filter((d: any) => d.user_id === userId)); 
            setLoading(false);
        });
    }, [token, userId]);

    return loading ? (
        <div className="text-xs text-neutral-500 py-2">Carregando...</div>
    ) : devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {devices.map(dev => (
                <div key={dev.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex justify-between items-center group hover:border-neutral-700 transition-colors">
                    <div>
                        <div className="font-mono text-emerald-400 text-sm">{dev.serial_code}</div>
                        <div className="text-xs text-neutral-500">{dev.device_name || 'Sem nome'}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(dev)} className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-amber-400/10 rounded"><Edit2 size={14} /></button>
                        <button onClick={() => onDelete(dev.id)} className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded"><Trash2 size={14} /></button>
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <div className="text-sm text-neutral-500 py-4 border border-dashed border-neutral-800 rounded-lg text-center bg-black/20">
            Nenhum equipamento vinculado a esta conta.
        </div>
    );
};


// ==========================================
// MODALS
// ==========================================

const UserFormModal = ({ data, onClose, onSuccess }: { data: any, onClose: () => void, onSuccess: () => void }) => {
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        name: data?.name || '',
        email: data?.email || '',
        password: '',
        role: data?.role || 'user'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = data 
                ? `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users/${data.id}`
                : `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users`;
            
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
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">{data ? 'Editar Conta' : 'Nova Conta'}</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome</label>
                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Email</label>
                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">{data ? 'Nova Senha (opcional)' : 'Senha'}</label>
                        <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!data} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nível de Acesso</label>
                        <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 appearance-none">
                            <option value="user">Usuário Comum</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = data 
                ? `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices/${data.id}`
                : `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices`;
            
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
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">{data ? 'Editar Dispositivo' : 'Vincular Dispositivo'}</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Serial (Código Único)</label>
                        <input type="text" value={formData.serial_code} onChange={e => setFormData({...formData, serial_code: e.target.value})} required className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono uppercase" placeholder="BREWW-XXXXX" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Apelido (Opcional)</label>
                        <input type="text" value={formData.device_name} onChange={e => setFormData({...formData, device_name: e.target.value})} className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="Ex: Geladeira 1" />
                    </div>
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                        <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// ==========================================
// INGREDIENTS TAB (KEEPING EXISTING LOGIC)
// ==========================================

const IngredientsTab = () => {
    const { token } = useAuth();
    const [subTab, setSubTab] = useState<'fermentables' | 'hops' | 'yeasts' | 'miscs'>('fermentables');
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Search & Edit state
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItem, setEditingItem] = useState<any | null>(null);

    const loadIngredients = () => {
        setLoading(true);
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/ingredients/${subTab}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => { setIngredients(data); setLoading(false); })
        .catch(err => { toast.error('Erro ao carregar'); setLoading(false); });
    };

    useEffect(() => { loadIngredients(); }, [subTab, token]);

    const handleSave = async (id: number | null, name: string, namePt: string) => {
        try {
            const method = id ? 'PUT' : 'POST';
            const url = id 
                ? `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/ingredients/${subTab}/${id}`
                : `${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/ingredients/${subTab}`;
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name, name_pt: namePt })
            });

            if (!res.ok) throw new Error('Falha ao salvar');
            toast.success('Ingrediente salvo!');
            setEditingItem(null);
            loadIngredients();
        } catch (err) {
            toast.error('Erro ao salvar');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Excluir este ingrediente?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/ingredients/${subTab}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha');
            toast.success('Ingrediente excluído!');
            loadIngredients();
        } catch (err) { toast.error('Erro ao excluir'); }
    };

    const filtered = ingredients.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.name_pt && i.name_pt.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex space-x-1 bg-black/50 p-1 rounded-lg border border-neutral-800 w-full md:w-auto overflow-x-auto">
                    {[
                        { id: 'fermentables', label: 'Fermentáveis' },
                        { id: 'hops', label: 'Lúpulos' },
                        { id: 'yeasts', label: 'Leveduras' },
                        { id: 'miscs', label: 'Outros' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setSubTab(tab.id as any); setSearchTerm(''); }}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                                subTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                            <Search size={14} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-neutral-800 text-neutral-300 rounded-lg py-2 pl-9 pr-4 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
                        />
                    </div>
                    <button 
                        onClick={() => setEditingItem({ id: null, name: '', name_pt: '' })}
                        className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shrink-0 shadow-lg shadow-indigo-900/20"
                        title="Adicionar Novo"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
                <div className="border border-neutral-800 rounded-xl overflow-hidden bg-black/20">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-900">
                            <tr className="text-neutral-400">
                                <th className="py-4 px-4 font-medium">Nome Original</th>
                                <th className="py-4 px-4 font-medium">Nome (PT-BR)</th>
                                <th className="py-4 px-4 font-medium text-right w-24">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50 text-neutral-300">
                            {filtered.map(item => (
                                <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                                    <td className="py-3 px-4">{item.name}</td>
                                    <td className="py-3 px-4 text-indigo-400 font-medium">{item.name_pt || '-'}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => setEditingItem(item)} className="p-1.5 text-neutral-500 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"><Edit2 size={14} /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={3} className="py-8 text-center text-neutral-500">Nenhum ingrediente encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {editingItem && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">{editingItem.id ? 'Editar Ingrediente' : 'Novo Ingrediente'}</h3>
                            <button onClick={() => setEditingItem(null)} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome Original (Inglês)</label>
                                <input 
                                    type="text" 
                                    value={editingItem.name} 
                                    onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                                    className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome PT-BR</label>
                                <input 
                                    type="text" 
                                    value={editingItem.name_pt || ''} 
                                    onChange={e => setEditingItem({...editingItem, name_pt: e.target.value})}
                                    className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" 
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button onClick={() => setEditingItem(null)} className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                                <button 
                                    onClick={() => handleSave(editingItem.id, editingItem.name, editingItem.name_pt)} 
                                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
