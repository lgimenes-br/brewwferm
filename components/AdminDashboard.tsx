import React, { useState, useEffect } from 'react';
import { Users, HardDrive, TestTube, Edit2, Trash2, Plus, X, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import toast from 'react-hot-toast';

export const AdminDashboard = () => {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'devices' | 'ingredients'>('users');

    return (
        <div className="max-w-7xl mx-auto px-4 md:px-10 pb-20 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    Painel de Administração
                </h1>
                <p className="text-neutral-400">Gerencie usuários, dispositivos e o banco de ingredientes da plataforma.</p>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 border-b border-neutral-800 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t-md font-medium text-sm transition-all whitespace-nowrap ${
                        activeTab === 'users' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <Users size={16} /> Usuários
                </button>
                <button
                    onClick={() => setActiveTab('devices')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t-md font-medium text-sm transition-all whitespace-nowrap ${
                        activeTab === 'devices' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <HardDrive size={16} /> Dispositivos
                </button>
                <button
                    onClick={() => setActiveTab('ingredients')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-t-md font-medium text-sm transition-all whitespace-nowrap ${
                        activeTab === 'ingredients' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <TestTube size={16} /> Ingredientes
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-neutral-900/50 rounded-xl border border-neutral-800 p-6">
                {activeTab === 'users' && <UsersTab />}
                {activeTab === 'devices' && <DevicesTab />}
                {activeTab === 'ingredients' && <IngredientsTab />}
            </div>
        </div>
    );
};

// ==========================================
// TABS COMPONENTS
// ==========================================

const UsersTab = () => {
    const { token } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/users`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => { setUsers(data); setLoading(false); })
        .catch(err => { toast.error('Erro ao carregar usuários'); setLoading(false); });
    }, [token]);

    if (loading) return <div className="text-neutral-400">Carregando usuários...</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="text-neutral-500 border-b border-neutral-800">
                        <th className="pb-3 font-medium">ID</th>
                        <th className="pb-3 font-medium">Nome</th>
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Role</th>
                        <th className="pb-3 font-medium">Dispositivos</th>
                    </tr>
                </thead>
                <tbody className="text-neutral-300">
                    {users.map(user => (
                        <tr key={user.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                            <td className="py-3 font-mono">{user.id}</td>
                            <td className="py-3">{user.name}</td>
                            <td className="py-3">{user.email}</td>
                            <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs ${user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-neutral-800 text-neutral-400'}`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="py-3 font-mono">{user.device_count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const DevicesTab = () => {
    const { token } = useAuth();
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/devices`, {
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => { setDevices(data); setLoading(false); })
        .catch(err => { toast.error('Erro ao carregar dispositivos'); setLoading(false); });
    }, [token]);

    if (loading) return <div className="text-neutral-400">Carregando dispositivos...</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="text-neutral-500 border-b border-neutral-800">
                        <th className="pb-3 font-medium">Serial</th>
                        <th className="pb-3 font-medium">Dono</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Firmware</th>
                        <th className="pb-3 font-medium">Última Atividade</th>
                    </tr>
                </thead>
                <tbody className="text-neutral-300">
                    {devices.map(dev => (
                        <tr key={dev.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                            <td className="py-3 font-mono text-emerald-500">{dev.serial_code}</td>
                            <td className="py-3">
                                <div>{dev.owner_name}</div>
                                <div className="text-xs text-neutral-500">{dev.owner_email}</div>
                            </td>
                            <td className="py-3">
                                <span className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 text-xs uppercase tracking-wider">
                                    {dev.stat_op || 'INATIVO'}
                                </span>
                            </td>
                            <td className="py-3 font-mono">{dev.version || '-'}</td>
                            <td className="py-3 text-neutral-400">
                                {dev.last_update ? new Date(dev.last_update).toLocaleString('pt-BR') : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

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
        if (!confirm('Tem certeza que deseja deletar este ingrediente?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin + '/api'}/admin/ingredients/${subTab}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha ao deletar');
            toast.success('Deletado com sucesso');
            loadIngredients();
        } catch (err) {
            toast.error('Erro ao deletar');
        }
    };

    const filtered = ingredients.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (i.name_pt && i.name_pt.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div>
            {/* Sub Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
                {['fermentables', 'hops', 'yeasts', 'miscs'].map(t => (
                    <button
                        key={t}
                        onClick={() => setSubTab(t as any)}
                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                            subTab === t ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/50' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                        }`}
                    >
                        {t === 'fermentables' ? 'Maltes' : t === 'hops' ? 'Lúpulos' : t === 'yeasts' ? 'Leveduras' : 'Diversos'}
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-center mb-6">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Buscar ingrediente..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-md py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                </div>
                <button 
                    onClick={() => setEditingItem({ name: '', name_pt: '' })}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> Novo
                </button>
            </div>

            {loading ? (
                <div className="text-neutral-400">Carregando...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="text-neutral-500 border-b border-neutral-800">
                                <th className="pb-3 font-medium">Nome (Inglês / Original)</th>
                                <th className="pb-3 font-medium">Nome Traduzido (PT-BR)</th>
                                <th className="pb-3 font-medium text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-neutral-300">
                            {filtered.map(ing => (
                                <tr key={ing.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                                    <td className="py-3 font-medium">{ing.name}</td>
                                    <td className="py-3 text-emerald-400">{ing.name_pt || <span className="text-neutral-600 italic">Não traduzido</span>}</td>
                                    <td className="py-3 flex justify-end gap-2">
                                        <button 
                                            onClick={() => setEditingItem(ing)}
                                            className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(ing.id)}
                                            className="p-1.5 text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 rounded transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-neutral-500">Nenhum ingrediente encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Edição */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">
                                {editingItem.id ? 'Editar Ingrediente' : 'Novo Ingrediente'}
                            </h3>
                            <button onClick={() => setEditingItem(null)} className="text-neutral-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                                    Nome Original (Inglês)
                                </label>
                                <input 
                                    type="text" 
                                    value={editingItem.name}
                                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                                    Nome em Português
                                </label>
                                <input 
                                    type="text" 
                                    value={editingItem.name_pt || ''}
                                    onChange={(e) => setEditingItem({...editingItem, name_pt: e.target.value})}
                                    className="w-full bg-neutral-950 border border-emerald-900/50 rounded-md p-3 text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors"
                                    placeholder="Ex: Malte Pilsen"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setEditingItem(null)}
                                className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleSave(editingItem.id, editingItem.name, editingItem.name_pt)}
                                disabled={!editingItem.name}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md font-bold transition-colors"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
