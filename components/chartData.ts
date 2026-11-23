// Preparo dos dados dos graficos (funcoes puras, testaveis).

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
          // Formato atual do servidor: { s3, s4, hum, ctl } (sensores 3 e 4 do firmware 2.11+)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              (['s3', 's4'] as const).forEach(k => {
                  const val = parseFloat(parsed[k]);
                  if (!isNaN(val)) extras[`extra_${k}`] = val;
              });
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

      const raw1 = (d as any).sensor1Temp ?? (d as any).temp_s1;
      const rawTarget = (d as any).targetTemp ?? (d as any).target_temp;
      const raw2 = (d as any).sensor2Temp ?? (d as any).temp_s2;
      const parsed1 = raw1 !== null && raw1 !== undefined ? parseFloat(String(raw1)) : NaN;
      const parsedTarget = rawTarget !== null && rawTarget !== undefined ? parseFloat(String(rawTarget)) : NaN;
      const parsed2 = raw2 !== null && raw2 !== undefined ? parseFloat(String(raw2)) : NaN;

      // o campo bruto extra_sensors (ex.: {hum: 61}) nao vira linha: so os extras numericos acima
      const { extra_sensors: _rawExtras, ...rest } = d as any;
      return {
        ...rest,
        timestamp: d.timestamp || (d as any).recorded_at,
        sensor1Temp: parsed1,
        targetTemp: !isNaN(parsedTarget) ? parsedTarget : null,
        sensor2Temp: !isNaN(parsed2) ? parsed2 : null,
        ...extras
      };
    // Leitura com algum sensor vale (o Sensor 1 nao e obrigatorio: na geladeira pode controlar o 2)
    }).filter(d => !isNaN(d.sensor1Temp) || d.sensor2Temp !== null || Object.keys(d).some(k => k.startsWith('extra_')));

      return mapped.slice(-maxPoints);
};

/** Linhas extras: so campos extra_<nome> numericos (nunca o campo bruto extra_sensors). */
export const extraSensorKeys = (points: any[]): string[] => {
    const keys = new Set<string>();
    points.forEach(d => Object.keys(d).forEach(k => { if (k.startsWith('extra_') && k !== 'extra_sensors' && typeof d[k] === 'number') keys.add(k); }));
    return Array.from(keys);
};
