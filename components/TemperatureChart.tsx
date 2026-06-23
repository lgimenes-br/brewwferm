
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
import { Reading, FermentationEvent } from '../types';
import { EventLog } from './EventLog';

interface TemperatureChartProps {
  data: Reading[];
  events?: FermentationEvent[];
  onAddEvent?: (event: Omit<FermentationEvent, 'id'>) => void;
  onRemoveEvent?: (id: string) => void;
}

export const TemperatureChart: React.FC<TemperatureChartProps> = React.memo(({ data, events = [], onAddEvent, onRemoveEvent }) => {
  // Safe parsing of data points
  const safeData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    
    const chartPoints = parseInt(localStorage.getItem('breww_chartPoints') || '50', 10);
    
    const mapped = data.map(d => {
      // Handle potential different naming conventions or string formats
      // Providing fallbacks and ensuring numbers
      return {
        ...d,
        timestamp: d.timestamp,
        // Map 'temperature' to 'beerTemp' if beerTemp is missing, handling strings
        beerTemp: parseFloat(String((d as any).beerTemp ?? 0)),
        targetTemp: parseFloat(String((d as any).targetTemp ?? 0)),
        fridgeTemp: parseFloat(String((d as any).fridgeTemp ?? (d as any).currentFridgeTemp ?? 0)),
      };
    }).filter(d => !isNaN(d.beerTemp));

    return chartPoints > 0 ? mapped.slice(-chartPoints) : mapped;
  }, [data]);

  return (
    <div className="w-full bg-neutral-900/30 p-8 rounded-3xl border border-neutral-800 backdrop-blur-sm overflow-hidden">
      <h3 className="text-neutral-500 font-bold mb-6 text-xs uppercase tracking-widest pl-2">Histórico de Temperatura</h3>
      {/* Fixed height container for Recharts */}
      <div className="w-full h-[350px] overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#404040" vertical={false} strokeWidth={0.5} opacity={0.5} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
              stroke="#525252"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="#525252"
              domain={['auto', 'auto']}
              fontSize={11}
              unit="°"
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', color: '#f5f5f5', borderRadius: '16px', padding: '12px' }}
              itemStyle={{ color: '#d4d4d4', fontSize: '12px', paddingBottom: '4px' }}
              labelStyle={{ color: '#a3a3a3', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              labelFormatter={(label) => new Date(label).toLocaleString()}
              cursor={{ stroke: '#525252', strokeWidth: 0.5, strokeDasharray: '4 4' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" />

            <Line
              type="monotone"
              dataKey="beerTemp"
              name="Cerveja"
              stroke="#ffffff"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#ffffff' }}
            />
            <Line
              type="monotone"
              dataKey="targetTemp"
              name="Set Point"
              stroke="#22c55e"
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="fridgeTemp"
              name="Geladeira"
              stroke="#3b82f6"
              strokeWidth={1}
              dot={false}
              opacity={0.5}
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
