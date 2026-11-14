import React from 'react';

// Blocos da area logada com a mesma identidade do app Breww (breww-app/src/components/ui.tsx):
// cartoes Grafite com borda fina, numeros grandes e leves com o decimal em cinza, chips em pilula
// com ponto e um unico verde de destaque. As telas logadas usam estes em vez de estilos avulsos.

/** "visto agora", "visto há 3 min", "visto há 2 h", "visto há 4 dias" (igual ao app) */
export const formatAgo = (iso?: string | number, now = Date.now()) => {
    const ms = typeof iso === 'number' ? iso : iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(ms) || ms <= 0) return 'sem contato registrado';
    const s = Math.max(0, Math.round((now - ms) / 1000));
    if (s < 60) return 'visto agora';
    const m = Math.round(s / 60);
    if (m < 60) return `visto há ${m} min`;
    const h = Math.round(m / 60);
    if (h < 48) return `visto há ${h} h`;
    return `visto há ${Math.round(h / 24)} dias`;
};

/**
 * Temperatura no estilo do app: parte inteira grande e leve, decimal menor em cinza e a unidade
 * pequena no alto. Sem leitura mostra "--" (nunca 0 inventado).
 */
export function TempDisplay({ value, size = 64, unit = '°C', dim, label }: { value?: number | null; size?: number; unit?: string; dim?: boolean; label?: string }) {
    const has = typeof value === 'number' && Number.isFinite(value);
    const [int, dec] = has ? value!.toFixed(1).split('.') : ['--', ''];
    return (
        <span
            className="inline-flex items-start tabular"
            style={{ opacity: dim ? 0.5 : 1 }}
            role="img"
            aria-label={label ?? (has ? `${value!.toFixed(1)} graus` : 'sem leitura')}
        >
            <span aria-hidden style={{ fontSize: size, lineHeight: 1.04, fontWeight: 300, letterSpacing: `${-size * 0.04}px`, color: 'var(--ink)' }}>{int}</span>
            {dec && <span aria-hidden style={{ fontSize: size * 0.55, fontWeight: 300, marginLeft: 4, marginTop: size * 0.06, color: 'var(--tertiary)' }}>{dec}</span>}
            <span aria-hidden style={{ fontSize: Math.max(11, size * 0.17), fontWeight: 500, marginLeft: 6, marginTop: size * 0.12, color: 'var(--muted)' }}>{unit}</span>
        </span>
    );
}

/** Valor menor com unidade sobrescrita (Alvo, densidade) */
export function SmallValue({ value, unit, size = 20 }: { value: string; unit?: string; size?: number }) {
    return (
        <span className="inline-flex items-start tabular" style={{ color: 'var(--ink)' }}>
            <span style={{ fontSize: size, fontWeight: 400, lineHeight: 1.1 }}>{value}</span>
            {unit && value !== '--' && <span style={{ fontSize: Math.max(10, size * 0.5), marginLeft: 3, marginTop: 1, color: 'var(--muted)' }}>{unit}</span>}
        </span>
    );
}

/** Chip em pilula: ponto colorido ou icone + texto curto */
export function Chip({ children, dot, icon, title }: { children: React.ReactNode; dot?: 'on' | 'off' | 'warn'; icon?: React.ReactNode; title?: string }) {
    const dotColor = dot === 'on' ? 'var(--accent)' : dot === 'warn' ? 'var(--danger)' : 'var(--tertiary)';
    return (
        <span title={title} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full border border-[var(--line)] text-[14px] text-[var(--ink)] whitespace-nowrap shrink-0">
            {dot && <span aria-hidden className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor }} />}
            {icon && <span aria-hidden className="text-[var(--muted)] inline-flex">{icon}</span>}
            {children}
        </span>
    );
}

/** Bloco de valor (FG, densidade, sensores): rotulo, numero e legenda */
export function StatTile({ label, value, unit, caption, icon, warn }: { label: string; value: string; unit?: string; caption?: string; icon?: React.ReactNode; warn?: boolean }) {
    return (
        <div className="app-card p-4 flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 text-[13px] text-[var(--muted)] min-w-0">
                {icon && <span aria-hidden className={warn ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}>{icon}</span>}
                <span className="truncate">{label}</span>
            </div>
            <SmallValue value={value} unit={unit} size={26} />
            {caption && <span className={`text-[12px] truncate ${warn ? 'text-[var(--danger)]' : 'text-[var(--tertiary)]'}`}>{caption}</span>}
        </div>
    );
}

/** Titulo de pagina no estilo do app (largeTitle leve) com acoes a direita */
export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
    return (
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="min-w-0">
                <h1 className="text-[40px] sm:text-[52px] leading-[1.04] font-light tracking-[-0.03em] text-[var(--ink)]">{title}</h1>
                {subtitle && <p className="mt-2 text-[16px] text-[var(--muted)]">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </header>
    );
}

/** Rotulo de secao (como os "Dados", "Ferramentas" do app) */
export function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 px-1.5 mb-2.5">
            <h2 className="text-[15px] text-[var(--muted)] font-normal">{children}</h2>
            {action}
        </div>
    );
}
