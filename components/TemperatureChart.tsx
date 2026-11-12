
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Reading, FermentationEvent, getEventReferenceMarks } from '../types';

interface TemperatureChartProps {
  data: Reading[];
  events?: FermentationEvent[];
  sensor1Name?: string;
  sensor2Name?: string;
}

/** Pontos do grafico: temperaturas numericas e um campo extra_<nome> por sensor extra (funcao pura, testavel). */
export const prepareTemperatureData = (data: any[] | null | undefined, maxPoints = 50): any[] => {
    if (!data || !Array.isArray(data)) return [];
    
    
    const mapped = data.map(d => {
      // Map extra sensors
      let extras: Record<string, number> = {};
      if ((d as any).extra_sensors) {
          let parsed = (d as any).extra_sensors;
          if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch (e) { parsed = []; }
          }
          if (Array.isArray(parsed)) {
              parsed.forEach((ex: any) => {
                  if (ex && ex.n && ex.t !== undefined) {
                      const val = parseFloat(ex.t);
                      if (!isNaN(val)) extras[`extra_${ex.n}`] = val;
                  }
              });
          }
      }

      const rawBeer = (d as any).beerTemp ?? (d as any).temp_ferm;
      const rawTarget = (d as any).targetTemp ?? (d as any).target_temp;
      const rawFridge = (d as any).fridgeTemp ?? (d as any).temp_amb;
      const parsedBeer = rawBeer !== null && rawBeer !== undefined ? parseFloat(String(rawBeer)) : NaN;
      const parsedTarget = rawTarget !== null && rawTarget !== undefined ? parseFloat(String(rawTarget)) : NaN;
      const parsedFridge = rawFridge !== null && rawFridge !== undefined ? parseFloat(String(rawFridge)) : NaN;

      // o campo bruto extra_sensors (ex.: {hum: 61}) nao vira linha: so os extras numericos acima
      const { extra_sensors: _rawExtras, ...rest } = d as any;
      return {
        ...rest,
        timestamp: d.timestamp || (d as any).recorded_at,
        beerTemp: parsedBeer,
        targetTemp: !isNaN(parsedTarget) ? parsedTarget : null,
        fridgeTemp: !isNaN(parsedFridge) ? parsedFridge : null,
        ...extras
      };
    }).filter(d => !isNaN(d.beerTemp));

      return mapped.slice(-maxPoints);
};

/** Linhas extras: so campos extra_<nome> numericos (nunca o campo bruto extra_sensors). */
export const extraSensorKeys = (points: any[]): string[] => {
    const keys = new Set<string>();
    points.forEach(d => Object.keys(d).forEach(k => { if (k.startsWith('extra_') && k !== 'extra_sensors' && typeof d[k] === 'number') keys.add(k); }));
    return Array.from(keys);
};

export const TemperatureChart: React.FC<TemperatureChartProps> = React.memo(({ data, events = [], sensor1Name = 'Cerveja', sensor2Name = 'Geladeira' }) => {
  // Safe parsing of data points
  const safeData = React.useMemo(() => {
    const chartPoints = parseInt(localStorage.getItem('breww_chartPoints') || '50', 10);
    return prepareTemperatureData(data, !isNaN(chartPoints) && chartPoints > 0 ? chartPoints : 50);
  }, [data]);

    // Extract unique extra sensor keys to render dynamic lines
    const extraKeys = React.useMemo(() => extraSensorKeys(safeData), [safeData]);
    
    // Generate distinct colors for extra lines
    const getExtraColor = (index: number) => {
        const colors = ['#f59e0b', '#3b82f6', '#ec4899', '#178a3f', '#14b8a6', '#f43f5e'];
        return colors[index % colors.length];
    };

  return (
    <div className="w-full h-full flex flex-col bg-white p-8 rounded-3xl border border-black/[0.07] backdrop-blur-sm overflow-hidden">
      <h3 className="text-[var(--muted)] font-bold mb-6 text-xs pl-2">Histórico de Temperatura</h3>
      
      {safeData.length === 0 ? (
        <div className="w-full flex-1 min-h-[350px] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--bg)] flex items-center justify-center mb-4 border border-black/10">
                <div className="w-8 h-8 rounded-full border-2 border-black/25 border-t-neutral-400 animate-spin" />
            </div>
            <h4 className="text-[var(--ink)] font-medium mb-1">Aguardando dados...</h4>
            <p className="text-[var(--muted)] text-sm max-w-[250px]">O equipamento já foi instruído. A telemetria aparecerá aqui em alguns segundos.</p>
        </div>
      ) : (
      <div className="w-full flex-1 min-h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d6d8dc" vertical={false} strokeWidth={0.5} opacity={0.5} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
              stroke="#9a9ea6"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="#9a9ea6"
              domain={['auto', 'auto']}
              fontSize={11}
              unit="°C"
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderColor: '#d6d8dc', color: '#0B0D12', borderRadius: '16px', padding: '12px' }}
              itemStyle={{ color: '#2b2f37', fontSize: '12px', paddingBottom: '4px' }}
              labelStyle={{ color: '#6b6f78', fontSize: '10px', marginBottom: '8px', textTransform: '', letterSpacing: '0.05em' }}
              labelFormatter={(label) => new Date(label).toLocaleString()}
              cursor={{ stroke: '#9a9ea6', strokeWidth: 0.5, strokeDasharray: '4 4' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" />

            <Line
              type="monotone"
              dataKey="beerTemp"
              name={sensor1Name}
              stroke="#0B0D12"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#0B0D12' }}
            />
            <Line
              type="monotone"
              dataKey="targetTemp"
              name="Set Point"
              stroke="#22c55e"
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              activeDot={false}
            />
            {extraKeys.map((key, i) => (
                <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key.replace('extra_', '')}
                    stroke={getExtraColor(i)}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: getExtraColor(i) }}
                />
            ))}
            <Line
              type="monotone"
              dataKey="fridgeTemp"
              name={sensor2Name}
              stroke="#3b82f6"
              strokeWidth={1}
              dot={false}
              opacity={0.5}
            />

            {/* Event markers as vertical reference lines */}
            {getEventReferenceMarks(safeData, events).map(event => (
              <ReferenceLine
                key={event.id}
                x={event.markTime}
                stroke="#6b6f78"
                strokeDasharray="4 4"
                strokeWidth={1}
                label={{
                  value: event.type,
                  position: 'top',
                  fill: '#6b6f78',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}
    </div>
  );
});
