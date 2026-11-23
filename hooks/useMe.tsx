import { useEffect, useState } from 'react';
import { API_URL } from '../config';

// Perfil do usuario logado (nome e foto do Google, se entrou com o Google). Mesmo /api/me do app.
// Um pedido por sessao: o cabecalho e o painel usam o mesmo resultado.
export interface Me { name: string; email: string; avatarUrl: string | null }

let cache: { token: string; me: Me } | null = null;
let pending: { token: string; p: Promise<Me | null> } | null = null;

const load = (token: string): Promise<Me | null> => {
  if (pending?.token === token) return pending.p;
  const p = fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => (r.ok ? r.json() : null))
    .then((d): Me | null => (d && typeof d.name === 'string'
      ? { name: d.name, email: String(d.email || ''), avatarUrl: typeof d.avatarUrl === 'string' && d.avatarUrl.startsWith('https://') ? d.avatarUrl : null }
      : null))
    .catch(() => null);
  pending = { token, p };
  p.then(me => { if (me) cache = { token, me }; if (pending?.p === p) pending = null; });
  return p;
};

export const useMe = (token: string | null): Me | null => {
  const [me, setMe] = useState<Me | null>(() => (token && cache?.token === token ? cache.me : null));
  useEffect(() => {
    if (!token) { setMe(null); return; }
    if (cache?.token === token) { setMe(cache.me); return; }
    let alive = true;
    load(token).then(m => { if (alive && m) setMe(m); });
    return () => { alive = false; };
  }, [token]);
  return me;
};

// "Usuário" e o nome generico de quando o servidor nao mandou nome: nao vira "Cheers, Usuário!"
export const firstName = (name?: string | null) => {
  const f = (name || '').trim().split(/\s+/)[0] || '';
  return f === 'Usuário' ? '' : f;
};

export const initials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
};
