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
