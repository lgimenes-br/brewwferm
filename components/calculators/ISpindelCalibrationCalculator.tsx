import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { normalizeGravity } from '../../types';

interface CalibrationPoint {
    id: string;
    angle: string;
    gravity: string;
}

// Solve linear system A * x = b using Gaussian elimination with partial pivoting
const solveLinearSystem = (A: number[][], b: number[]): number[] | null => {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) {
                maxRow = row;
            }
        }
        if (Math.abs(M[maxRow][col]) < 1e-12) return null;
        [M[col], M[maxRow]] = [M[maxRow], M[col]];

        for (let row = col + 1; row < n; row++) {
            const factor = M[row][col] / M[col][col];
            for (let k = col; k <= n; k++) {
                M[row][k] -= factor * M[col][k];
            }
        }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = M[i][n];
        for (let j = i + 1; j < n; j++) {
            sum -= M[i][j] * x[j];
        }
        x[i] = sum / M[i][i];
    }
    return x;
};

const fitPolynomial = (points: { x: number; y: number }[], degree: 2 | 3) => {
    const m = degree + 1;
    if (points.length < m) return null;

    const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
    const B: number[] = new Array(m).fill(0);

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
            A[i][j] = points.reduce((acc, p) => acc + Math.pow(p.x, i + j), 0);
        }
        B[i] = points.reduce((acc, p) => acc + p.y * Math.pow(p.x, i), 0);
    }

    // coeffs[0] = c0, coeffs[1] = c1*x, coeffs[2] = c2*x^2, coeffs[3] = c3*x^3
    const coeffs = solveLinearSystem(A, B);
    if (!coeffs) return null;

    const evaluate = (x: number) => coeffs.reduce((sum, c, idx) => sum + c * Math.pow(x, idx), 0);
    const meanY = points.reduce((s, p) => s + p.y, 0) / points.length;
    const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
    const ssRes = points.reduce((s, p) => s + Math.pow(p.y - evaluate(p.x), 2), 0);
    const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;

    // Format expression for iSpindel firmware: e.g. c2*tilt^2 + c1*tilt + c0
    const terms: string[] = [];
    for (let p: number = degree; p >= 0; p--) {
        const val = coeffs[p];
        const absStr = Math.abs(val).toFixed(p === 3 ? 9 : p === 2 ? 7 : p === 1 ? 6 : 5);
        const sign = val < 0 ? '-' : (terms.length > 0 ? '+' : '');
        if (p === 0) {
            terms.push(`${sign} ${absStr}`.trim());
        } else if (p === 1) {
            terms.push(`${sign} ${absStr}*tilt`.trim());
        } else {
            terms.push(`${sign} ${absStr}*tilt^${p}`.trim());
        }
    }

    return {
        coeffs,
        r2,
        formula: terms.join(' '),
        evaluate
    };
};

export const ISpindelCalibrationCalculator: React.FC = () => {
    const [degree, setDegree] = useState<2 | 3>(2);
    const [testTilt, setTestTilt] = useState<string>('42.0');
    const [points, setPoints] = useState<CalibrationPoint[]>([
        { id: 'p1', angle: '25.0', gravity: '1.000' },
        { id: 'p2', angle: '38.5', gravity: '1.030' },
        { id: 'p3', angle: '50.2', gravity: '1.055' },
        { id: 'p4', angle: '60.0', gravity: '1.078' }
    ]);

    const validPoints = useMemo(() => {
        return points
            .map(p => {
                const x = parseFloat(String(p.angle).replace(',', '.'));
                const rawY = parseFloat(String(p.gravity).replace(',', '.'));
                const y = normalizeGravity(rawY, 0);
                return { x, y };
            })
            .filter(p => !isNaN(p.x) && p.x > 0 && p.x < 90 && !isNaN(p.y) && p.y >= 0.980 && p.y <= 1.200);
    }, [points]);

    const fitResult = useMemo(() => {
        return fitPolynomial(validPoints, degree);
    }, [validPoints, degree]);

    const simulatedSg = useMemo(() => {
        const tiltVal = parseFloat(String(testTilt).replace(',', '.'));
        if (!fitResult || isNaN(tiltVal)) return null;
        return fitResult.evaluate(tiltVal);
    }, [fitResult, testTilt]);

    const handleAddPoint = () => {
        setPoints(prev => [
            ...prev,
            { id: `pt_${Date.now()}_${prev.length}`, angle: '45.0', gravity: '1.040' }
        ]);
    };

    const handleUpdatePoint = (id: string, field: 'angle' | 'gravity', value: string) => {
        setPoints(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleRemovePoint = (id: string) => {
        if (points.length <= 3) return;
        setPoints(prev => prev.filter(p => p.id !== id));
    };

    const handleCopyFormula = () => {
        if (!fitResult?.formula) return;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(fitResult.formula).catch(() => {});
        }
        toast.success('Polinômio copiado para a área de transferência!');
    };

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left Column: Calibration Points Table */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Pontos de Medição (Ângulo vs SG)</h4>
                            <p className="text-[11px] text-neutral-500 mt-0.5">Insira ao menos {degree + 1} leituras de inclinação em graus e suas densidades reais.</p>
                        </div>
                        <div className="flex bg-neutral-800 p-1 rounded-lg border border-neutral-700">
                            <button
                                type="button"
                                onClick={() => setDegree(2)}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${degree === 2 ? 'bg-cyan-500 text-black' : 'text-neutral-400 hover:text-white'}`}
                            >
                                Polinômio 2º Grau
                            </button>
                            <button
                                type="button"
                                onClick={() => setDegree(3)}
                                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${degree === 3 ? 'bg-cyan-500 text-black' : 'text-neutral-400 hover:text-white'}`}
                            >
                                Polinômio 3º Grau
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        {points.map((pt, idx) => (
                            <div key={pt.id} className="flex items-center gap-3 bg-neutral-800/40 border border-neutral-800 rounded-xl p-3">
                                <span className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 text-xs font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                </span>
                                <div className="flex-1">
                                    <label htmlFor={`ispindel-angle-${pt.id}`} className="block text-[9px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Ângulo (Tilt °)</label>
                                    <input
                                        id={`ispindel-angle-${pt.id}`}
                                        type="number"
                                        step="0.1"
                                        value={pt.angle}
                                        onChange={(e) => handleUpdatePoint(pt.id, 'angle', e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor={`ispindel-grav-${pt.id}`} className="block text-[9px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Densidade (SG)</label>
                                    <input
                                        id={`ispindel-grav-${pt.id}`}
                                        type="number"
                                        step="0.001"
                                        value={pt.gravity}
                                        onChange={(e) => handleUpdatePoint(pt.id, 'gravity', e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                                {points.length > 3 && (
                                    <button
                                        type="button"
                                        aria-label={`Remover ponto ${idx + 1}`}
                                        onClick={() => handleRemovePoint(pt.id)}
                                        className="mt-4 p-2 text-neutral-500 hover:text-red-400 transition-colors"
                                        title="Remover ponto"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleAddPoint}
                        className="w-full py-2.5 bg-neutral-800/60 hover:bg-neutral-800 border border-dashed border-neutral-700 rounded-xl text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center justify-center gap-2 transition-colors"
                    >
                        <Plus size={14} /> Adicionar Ponto de Calibração
                    </button>
                </div>

                {/* Right Column: Generated Formula & Simulator */}
                <div className="bg-neutral-950 rounded-2xl p-6 border border-neutral-800/50 flex flex-col justify-between space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Fórmula Polinomial p/ iSpindel</span>
                            {fitResult && (
                                <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                    <CheckCircle2 size={12} /> R² = {(fitResult.r2 * 100).toFixed(2)}%
                                </span>
                            )}
                        </div>

                        {fitResult ? (
                            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
                                <code className="block text-cyan-400 font-mono text-sm break-all select-all">
                                    {fitResult.formula}
                                </code>
                                <button
                                    type="button"
                                    onClick={handleCopyFormula}
                                    className="w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Copy size={14} /> Copiar Polinômio
                                </button>
                            </div>
                        ) : (
                            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-center text-neutral-500 text-xs">
                                Insira ao menos {degree + 1} pontos distintos e válidos para gerar o polinômio de {degree}º grau.
                            </div>
                        )}
                    </div>

                    {/* Interactive Angle Simulator */}
                    <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4 space-y-3">
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                            Simulador de Inclinação (Teste a Fórmula)
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-center">
                            <div>
                                <label htmlFor="ispindel-test-tilt" className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Ângulo de Teste (°)</label>
                                <input
                                    id="ispindel-test-tilt"
                                    type="number"
                                    step="0.5"
                                    value={testTilt}
                                    onChange={(e) => setTestTilt(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-none focus:border-cyan-500"
                                />
                            </div>
                            <div className="text-center">
                                <span className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">SG Estimada</span>
                                <span className="text-2xl font-black text-cyan-400 font-mono">
                                    {simulatedSg !== null && isFinite(simulatedSg) ? simulatedSg.toFixed(3) : '--'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-[10px] text-neutral-500 text-center">
                        Cole a fórmula acima no campo <strong>Polynomial</strong> do portal de configuração do seu iSpindel para converter automaticamente o ângulo em Specific Gravity (SG).
                    </p>
                </div>
            </div>
        </div>
    );
};
