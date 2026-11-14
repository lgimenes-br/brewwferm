
import React from 'react';
import {
  AreaChart,
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

interface GravityChartProps {
  data: Reading[];
  og?: number;
  fg?: number;
  events?: FermentationEvent[];
  sensorSgName?: string;
}

export const GravityChart: React.FC<GravityChartProps> = React.memo(({ data, og, fg, events = [], sensorSgName = 'Gravidade (SG)' }) => {
  const rawId = React.useId();
  const gradId = `colorGravity-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const safeData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    const chartPoints = parseInt(localStorage.getItem('breww_chartPoints') || '50', 10);
    
    const mapped = data.map(d => {
      const rawVal = parseFloat(String(d.gravity));
      return {
        ...d,
        originalGravity: rawVal, // Keep original for tooltip
        gravity: isNaN(rawVal) ? NaN : Math.min(rawVal, 1.200), // Clamp visual value to max 1.200 to preserve scale
        timestamp: d.timestamp || (d as any).recorded_at
      };
    }).filter(d => !isNaN(d.gravity) && d.gravity > 0);

    return chartPoints > 0 ? mapped.slice(-chartPoints) : mapped;
  }, [data]);

  // Safe parsing of limits
  const safeOG = (og !== undefined && og !== null) ? parseFloat(String(og)) : undefined;
  const safeFG = (fg !== undefined && fg !== null) ? parseFloat(String(fg)) : undefined;

  // Extend domain to include targets if they exist
  // Initialize with [1.000, 1.100] as default range if no data
  let minDomain = safeData.length > 0 ? safeData.reduce((min, d) => (d.gravity < min ? d.gravity : min), safeData[0].gravity) : 1.000;
  let maxDomain = safeData.length > 0 ? safeData.reduce((max, d) => (d.gravity > max ? d.gravity : max), safeData[0].gravity) : 1.100;

  if (safeOG !== undefined && !isNaN(safeOG)) maxDomain = Math.max(maxDomain, safeOG);
  if (safeFG !== undefined && !isNaN(safeFG)) minDomain = Math.min(minDomain, safeFG);

  // Add padding
  const yDomainMin = isNaN(minDomain) ? 0 : Math.max(0, minDomain - 0.005);
  const yDomainMax = isNaN(maxDomain) ? 1.2 : maxDomain + 0.005;

  // Map events to chart data points, only if within visible range
  const eventMarks = getEventReferenceMarks(safeData, events);

  // Determine if we should render the chart components (if we have data OR reference lines)
  const shouldRenderChart = safeData.length > 0 || safeOG !== undefined || safeFG !== undefined;

  // Generate mock data for empty state to ensure properties (lines, axes) render correctly across a time range
  const mockData = [
    { timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), gravity: safeOG || 1.050 },
    { timestamp: new Date().toISOString(), gravity: safeOG || 1.050 }
  ];

  return (
    <div className="w-full flex flex-col app-card p-5 sm:p-6 overflow-hidden">
      <h3 className="text-[17px] font-normal text-[var(--ink)] mb-4 pl-1">Densidade</h3>
      {/* Fixed height container for Recharts */}
      <div className="w-full h-[340px] min-w-0 relative">
        {shouldRenderChart ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={safeData.length > 0 ? safeData : mockData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#71FC8F" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#71FC8F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} strokeWidth={0.5} opacity={0.5} />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                stroke="#6B6F78"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={10}
                hide={safeData.length === 0} // Hide X axis if mock data is used
              />
              <YAxis
                stroke="#6B6F78"
                domain={[yDomainMin, yDomainMax]}
                fontSize={11}
                tickFormatter={(val) => Number.isFinite(Number(val)) ? Number(val).toFixed(3) : ''}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              {safeData.length > 0 && (
                <Tooltip
                  contentStyle={{ backgroundColor: '#20252F', borderColor: 'rgba(255,255,255,0.10)', color: '#ECECF1', borderRadius: '16px', padding: '12px' }}
                  itemStyle={{ color: '#ECECF1', fontSize: '12px', paddingBottom: '4px' }}
                  labelStyle={{ color: '#898E99', fontSize: '10px', marginBottom: '8px', textTransform: '', letterSpacing: '0.05em' }}
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                  formatter={(value: any, _name: any, props: any) => {
                    const original = props?.payload?.originalGravity;
                    const displayVal = Number(original !== undefined ? original : value);
                    return [Number.isFinite(displayVal) ? displayVal.toFixed(3) : '--', 'SG'];
                  }}
                  cursor={{ stroke: 'rgba(255,255,255,0.35)', strokeWidth: 0.5, strokeDasharray: '4 4' }}
                />
              )}
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" />

              {/* Render Area first (transparent if mock data) so ReferenceLines are drawn ON TOP */}
              <Area
                type="monotone"
                dataKey="gravity"
                name={sensorSgName}
                stroke={safeData.length > 0 ? "#71FC8F" : "none"}
                fillOpacity={safeData.length > 0 ? 1 : 0}
                fill={`url(#${gradId})`}
                strokeWidth={1.5}
                activeDot={safeData.length > 0 ? { r: 4, strokeWidth: 0, fill: '#71FC8F' } : false}
              />

              {/* Reference Lines rendered LAST (on top) */}
              {safeOG !== undefined && !isNaN(safeOG) && safeOG > 0 && (
                <ReferenceLine
                  y={safeOG}
                  stroke="#6B6F78"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{ position: 'insideTopRight', value: `OG: ${safeOG.toFixed(3)}`, fill: '#898E99', fontSize: 10, fontWeight: 600 }}
                />
              )}
              {safeFG !== undefined && !isNaN(safeFG) && safeFG > 0 && (
                <ReferenceLine
                  y={safeFG}
                  stroke="rgba(236,236,241,0.45)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{ position: 'insideBottomRight', value: `FG alvo: ${safeFG.toFixed(3)}`, fill: '#ECECF1', fontSize: 10, fontWeight: 600 }}
                />
              )}

              {eventMarks.map(e => (
                <ReferenceLine
                  key={e.id}
                  x={e.markTime}
                  stroke="#6b6f78"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: e.type,
                    position: 'top',
                    fill: '#898E99',
                    fontSize: 10,
                    fontWeight: 'bold'
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--muted)]">
            <span className="text-[15px] text-[var(--muted)]">Sem leituras de densidade</span>
          </div>
        )}

        {/* Helper message overlay if we have OG/FG but no curve data */}
        {shouldRenderChart && safeData.length === 0 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
            <span className="text-[10px] text-[var(--muted)] bg-white px-3 py-1 rounded-full border border-black/[0.07] backdrop-blur-md">
              Aguardando leituras para gerar curva...
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
