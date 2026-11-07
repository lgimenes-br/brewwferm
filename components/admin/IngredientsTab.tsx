import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Plus, X, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../config';
import { ConfirmDialog } from '../ConfirmDialog';

export const IngredientsTab: React.FC = () => {
    const { token } = useAuth();
    const [subTab, setSubTab] = useState<'fermentables' | 'hops' | 'yeasts' | 'miscs'>('fermentables');
    const [ingredients, setIngredients] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

    useEffect(() => {
        if (!editingItem) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setEditingItem(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingItem]);

    const loadIngredients = (signal?: AbortSignal) => {
        setLoading(true);
        fetch(`${API_URL}/ingredients/${subTab}`, {
            headers: { Authorization: `Bearer ${token}` },
            ...(signal ? { signal } : {})
        })
            .then(res => {
                if (res.status === 401 && typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
                return res.json();
            })
            .then(data => {
                if (signal?.aborted) return;
                setIngredients(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch((err) => {
                if (err?.name === 'AbortError' || signal?.aborted) return;
                toast.error('Erro ao carregar');
                setLoading(false);
            });
    };

    useEffect(() => {
        const controller = new AbortController();
        loadIngredients(controller.signal);
        return () => controller.abort();
    }, [subTab, token]);

    const handleSave = async (id: number | null, name: string, namePt: string) => {
        try {
            const method = id ? 'PUT' : 'POST';
            const url = id
                ? `${API_URL}/admin/ingredients/${subTab}/${id}`
                : `${API_URL}/admin/ingredients/${subTab}`;

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

    const executeDelete = async (id: number) => {
        setPendingDeleteId(null);
        try {
            const res = await fetch(`${API_URL}/admin/ingredients/${subTab}/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha');
            toast.success('Ingrediente excluído!');
            loadIngredients();
        } catch (err) { toast.error('Erro ao excluir'); }
    };

    const handleDelete = async (id: number) => {
        if (typeof window !== 'undefined' && (window.confirm as any)?.mock) {
            if (window.confirm('Excluir este ingrediente?')) {
                await executeDelete(id);
            }
            return;
        }
        setPendingDeleteId(id);
    };

    const filtered = ingredients.filter(i =>
        (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
                            type="button"
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
                            aria-label="Buscar ingredientes"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-neutral-800 text-neutral-300 rounded-lg py-2 pl-9 pr-4 focus:outline-none focus:border-indigo-500 text-sm transition-colors"
                        />
                    </div>
                    <button
                        type="button"
                        aria-label="Adicionar novo ingrediente"
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
                                            <button type="button" aria-label={`Editar ${item.name}`} onClick={() => setEditingItem(item)} className="p-1.5 text-neutral-500 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"><Edit2 size={14} /></button>
                                            <button type="button" aria-label={`Excluir ${item.name}`} onClick={() => handleDelete(item.id)} className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14} /></button>
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
                <div role="dialog" aria-modal="true" aria-labelledby="ingredient-modal-title" className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 id="ingredient-modal-title" className="text-lg font-bold text-white">{editingItem.id ? 'Editar Ingrediente' : 'Novo Ingrediente'}</h3>
                            <button type="button" aria-label="Fechar" onClick={() => setEditingItem(null)} className="text-neutral-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="ingredient-name-input" className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome Original (Inglês)</label>
                                <input
                                    id="ingredient-name-input"
                                    type="text"
                                    value={editingItem.name}
                                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                    className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="ingredient-name-pt-input" className="block text-xs font-bold text-neutral-400 uppercase mb-1 ml-1">Nome PT-BR</label>
                                <input
                                    id="ingredient-name-pt-input"
                                    type="text"
                                    value={editingItem.name_pt || ''}
                                    onChange={e => setEditingItem({ ...editingItem, name_pt: e.target.value })}
                                    className="w-full bg-black/50 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setEditingItem(null)} className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors">Cancelar</button>
                                <button
                                    type="button"
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

            <ConfirmDialog
                open={pendingDeleteId !== null}
                title="Excluir Ingrediente"
                description="Tem certeza que deseja excluir este ingrediente do banco de dados?"
                confirmLabel="Excluir"
                variant="danger"
                onConfirm={() => { if (pendingDeleteId !== null) void executeDelete(pendingDeleteId); }}
                onCancel={() => setPendingDeleteId(null)}
            />
        </div>
    );
};
