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
import { Reading, FermentationEvent } from '../types';

interface DualAxisChartProps {
  data: Reading[];
  og?: number;
  fg?: number;
  events?: FermentationEvent[];
}

export const DualAxisChart: React.FC<DualAxisChartProps> = React.memo(({ data, og, fg, events = [] }) => {
  const safeData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    const chartPoints = parseInt(localStorage.getItem('breww_chartPoints') || '50', 10);
    
    const mapped = data.map(d => {
      const rawGravity = parseFloat(String(d.gravity));
      const rawTemp = parseFloat(String((d as any).beerTemp ?? 0));
      return {
        ...d,
        originalGravity: rawGravity,
        gravity: isNaN(rawGravity) ? NaN : Math.min(rawGravity, 1.200),
        beerTemp: isNaN(rawTemp) ? NaN : rawTemp,
        timestamp: d.timestamp
      };
    }).filter(d => !isNaN(d.gravity) && !isNaN(d.beerTemp));

    return chartPoints > 0 ? mapped.slice(-chartPoints) : mapped;
  }, [data]);

  const safeOG = (og !== undefined && og !== null) ? parseFloat(String(og)) : undefined;
  const safeFG = (fg !== undefined && fg !== null) ? parseFloat(String(fg)) : undefined;

  let minGravity = safeData.length > 0 ? Math.min(...safeData.map(d => d.gravity)) : 1.000;
  let maxGravity = safeData.length > 0 ? Math.max(...safeData.map(d => d.gravity)) : 1.100;

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
    <div className="w-full bg-neutral-900/30 p-8 rounded-3xl border border-neutral-800 backdrop-blur-sm overflow-hidden">
      <h3 className="text-neutral-500 font-bold mb-6 text-xs uppercase tracking-widest pl-2">Análise Combinada (Temp vs Gravidade)</h3>
      <div className="w-full h-[350px] relative">
        {shouldRenderChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={safeData.length > 0 ? safeData : mockData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGravityDual" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={(val) => val.toFixed(1) + '°'}
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
                tickFormatter={(val) => val.toFixed(3)}
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
                  formatter={(value: number, name: string, props: any) => {
                    if (name === "Gravidade (SG)") {
                      const original = props?.payload?.originalGravity;
                      const displayVal = original !== undefined ? original : value;
                      return [displayVal.toFixed(3), 'SG'];
                    }
                    return [value.toFixed(1), '°C'];
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
                name="Gravidade (SG)"
                stroke={safeData.length > 0 ? "#8b5cf6" : "none"}
                fillOpacity={safeData.length > 0 ? 1 : 0}
                fill="url(#colorGravityDual)"
                strokeWidth={1.5}
                activeDot={safeData.length > 0 ? { r: 4, strokeWidth: 0, fill: '#8b5cf6' } : false}
              />

              {/* Temperature Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="beerTemp"
                name="Temperatura"
                stroke="#ffffff"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: '#ffffff' }}
              />

              {/* Event markers as vertical reference lines */}
              {(() => {
                if (safeData.length < 2) return null;
                const minTime = new Date(safeData[0].timestamp).getTime();
                const maxTime = new Date(safeData[safeData.length - 1].timestamp).getTime();
                return events
                  .filter(event => {
                    const t = new Date(event.timestamp).getTime();
                    return t >= minTime && t <= maxTime;
                  })
                  .map(event => {
                    const eventTime = new Date(event.timestamp).getTime();
                    const closest = safeData.reduce((prev, curr) =>
                      Math.abs(new Date(curr.timestamp).getTime() - eventTime) <
                      Math.abs(new Date(prev.timestamp).getTime() - eventTime) ? curr : prev
                    );
                    return (
                      <ReferenceLine
                        key={event.id}
                        yAxisId="left"
                        x={closest.timestamp}
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
                    );
                  });
              })()}
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
