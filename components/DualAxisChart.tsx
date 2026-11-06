import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Reading, FermentationEvent, getEventReferenceMarks } from '../types';

interface DualAxisChartProps {
  data: Reading[];
  og?: number;
  fg?: number;
  events?: FermentationEvent[];
  sensor1Name?: string;
  sensorSgName?: string;
}

export const DualAxisChart: React.FC<DualAxisChartProps> = React.memo(({ data, og, fg, events = [], sensor1Name = 'Temperatura', sensorSgName = 'Gravidade (SG)' }) => {
  const rawUid = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradId = `colorGravityDual-${rawUid}`;
  const safeData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    const chartPoints = parseInt(localStorage.getItem('breww_chartPoints') || '50', 10);
    
    const mapped = data.map(d => {
      const rawGravity = parseFloat(String(d.gravity));
      const rawTempVal = (d as any).beerTemp ?? (d as any).temp_ferm;
      const rawTemp = rawTempVal !== null && rawTempVal !== undefined ? parseFloat(String(rawTempVal)) : NaN;
      const hasValidGravity = !isNaN(rawGravity) && rawGravity > 0;
      return {
        ...d,
        originalGravity: hasValidGravity ? rawGravity : undefined,
        gravity: hasValidGravity ? Math.min(rawGravity, 1.200) : null,
        beerTemp: isNaN(rawTemp) ? NaN : rawTemp,
        timestamp: d.timestamp || (d as any).recorded_at
      };
    }).filter(d => !isNaN(d.beerTemp));

    return chartPoints > 0 ? mapped.slice(-chartPoints) : mapped;
  }, [data]);

  const safeOG = (og !== undefined && og !== null) ? parseFloat(String(og)) : undefined;
  const safeFG = (fg !== undefined && fg !== null) ? parseFloat(String(fg)) : undefined;

  const validGravities = safeData.map(d => d.gravity).filter((g): g is number => g !== null && !isNaN(g));
  let minGravity = validGravities.length > 0 ? validGravities.reduce((a, b) => (b < a ? b : a), validGravities[0]) : 1.000;
  let maxGravity = validGravities.length > 0 ? validGravities.reduce((a, b) => (b > a ? b : a), validGravities[0]) : 1.100;

  if (safeOG !== undefined && !isNaN(safeOG)) maxGravity = Math.max(maxGravity, safeOG);
  if (safeFG !== undefined && !isNaN(safeFG)) minGravity = Math.min(minGravity, safeFG);

  const yGravityMin = isNaN(minGravity) ? 0 : Math.max(0, minGravity - 0.005);
  const yGravityMax = isNaN(maxGravity) ? 1.2 : maxGravity + 0.005;

  const shouldRenderChart = safeData.length > 0;

  const mockData = [
    { timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), gravity: safeOG || 1.050, beerTemp: 20 },
    { timestamp: new Date().toISOString(), gravity: safeOG || 1.050, beerTemp: 20 }
  ];

  return (
    <div className="w-full h-full flex flex-col bg-neutral-900/30 p-8 rounded-3xl border border-neutral-800 backdrop-blur-sm overflow-hidden">
      <h3 className="text-neutral-500 font-bold mb-6 text-xs uppercase tracking-widest pl-2">Análise Combinada (Temp vs Gravidade)</h3>
      <div className="w-full flex-1 min-h-[350px] relative">
        {shouldRenderChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={safeData.length > 0 ? safeData : mockData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#404040" vertical={false} strokeWidth={0.5} opacity={0.5} />
              
              <XAxis
                dataKey="timestamp"
                tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                stroke="#525252"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={10}
                hide={safeData.length === 0}
              />
              
              <YAxis
                yAxisId="left"
                stroke="#ffffff" // white for temp
                domain={['auto', 'auto']}
                fontSize={11}
                tickFormatter={(val) => Number.isFinite(Number(val)) ? Number(val).toFixed(1) + '°' : ''}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#8b5cf6" // purpleish for gravity
                domain={[yGravityMin, yGravityMax]}
                fontSize={11}
                tickFormatter={(val) => Number.isFinite(Number(val)) ? Number(val).toFixed(3) : ''}
                tickLine={false}
                axisLine={false}
                dx={10}
              />

              {safeData.length > 0 && (
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', color: '#f5f5f5', borderRadius: '16px', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', paddingBottom: '4px' }}
                  labelStyle={{ color: '#a3a3a3', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                  formatter={(value: any, name: any, props: any) => {
                    if (name === sensorSgName) {
                      const original = props?.payload?.originalGravity;
                      const displayVal = Number(original !== undefined ? original : value);
                      return [Number.isFinite(displayVal) ? displayVal.toFixed(3) : '--', 'SG'];
                    }
                    const numTemp = Number(value);
                    return [Number.isFinite(numTemp) ? numTemp.toFixed(1) : '--', '°C'];
                  }}
                  cursor={{ stroke: '#525252', strokeWidth: 0.5, strokeDasharray: '4 4' }}
                />
              )}
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" />

              {/* Gravity Area */}
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="gravity"
                name={sensorSgName}
                connectNulls
                stroke={safeData.length > 0 ? "#8b5cf6" : "none"}
                fillOpacity={safeData.length > 0 ? 1 : 0}
                fill={`url(#${gradId})`}
                strokeWidth={1.5}
                activeDot={safeData.length > 0 ? { r: 4, strokeWidth: 0, fill: '#8b5cf6' } : false}
              />

              {/* Temperature Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="beerTemp"
                name={sensor1Name}
                stroke="#ffffff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#ffffff' }}
              />

              {/* Event markers as vertical reference lines */}
              {getEventReferenceMarks(safeData, events).map(event => (
                <ReferenceLine
                  key={event.id}
                  yAxisId="left"
                  x={event.markTime}
                  stroke="#a855f7"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: event.type,
                    position: 'top',
                    fill: '#a855f7',
                    fontSize: 10,
                    fontWeight: 'bold'
                  }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
            Aguardando primeiras leituras do iSpindel...
          </div>
        )}
      </div>
    </div>
  );
});
