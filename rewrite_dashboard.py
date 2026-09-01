import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start_idx = html.find('<div class="app-container" id="app-dashboard"')
if start_idx == -1: print("Dashboard not found"); exit(1)
end_idx = html.find('<div class="app-container" id="app-telemetria"', start_idx)

# To fix the overlapping dots globally, we should change .views-wrapper to have height: calc(100% - 40px)
# But wait, the pagination is absolute bottom 20px. 
# Let's just fix it by wrapping all views in an app so that the pagination has its own dedicated space.
# Actually, the simplest way is to add padding-bottom to `.views-track`? No.
# Just make .views-wrapper `height: calc(100% - 60px);`!

# Dashboard Pages:
# 1: Overview
# 2: Attenuation
# 3: Temp Chart
# 4: SG Chart
# 5: Combined Chart

dash_html = """
      <div class="app-container" id="app-dashboard" style="display: none; height: 100%; position: relative;">
        <div class="views-wrapper" data-pages="5" style="height: calc(100% - 50px); overflow: hidden;">
          <div class="views-track" style="width: 500%; display: flex; height: 100%; transition: transform 0.5s ease-out;">

          <!-- P1: OVERVIEW -->
          <div class="view" style="width: 20%; height: 100%; padding: 24px;">
            <div style="display: flex; gap: 24px; height: 100%;">
              <div class="card" style="flex: 1.2; display: flex; flex-direction: column;">
                <div class="card-header" style="margin-bottom: auto;"><div class="card-title">CONTROLE DE TEMPERATURA</div></div>
                <div class="arc-container" style="flex: 1; min-height: 0;">
                  <svg class="gauge-svg" viewBox="0 0 200 200"><circle class="gauge-bg" cx="100" cy="100" r="90"></circle><circle class="gauge-value" cx="100" cy="100" r="90"></circle></svg>
                  <div class="arc-center"><div class="arc-val" id="main-temp" style="font-size: 80px;">18.5</div><div class="arc-unit" style="font-size: 32px;">°C</div></div>
                  <div class="arc-limits" style="font-size: 16px;"><div class="limit-box"><div class="limit-lbl">MIN</div><div class="limit-val">-5.0</div></div><div class="limit-box" style="text-align: right;"><div class="limit-lbl">MAX</div><div class="limit-val">30.0</div></div></div>
                </div>
              </div>
              
              <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
                <div class="card" style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 24px;">
                  <div class="card-title" style="margin-bottom: 12px;">DENSIDADE ATUAL</div>
                  <div class="bot-card-content"><div class="icon-circle" style="color: #c084fc; background: #1b1424; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div><div class="bot-val-box"><div class="bot-val" id="main-sg" style="font-size: 40px;">1.024</div><div class="bot-unit">SG</div></div></div>
                </div>
                <div class="card" style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 24px;">
                  <div class="card-title" style="margin-bottom: 12px;">SETPOINT ALVO</div>
                  <div class="bot-card-content"><div class="icon-circle" style="width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg></div><div class="bot-val-box"><div class="bot-val" style="font-size: 40px;">18.0</div><div class="bot-unit">°C</div></div></div>
                </div>
                <div class="card" style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 24px;">
                  <div class="card-title" style="margin-bottom: 12px;">TEMPO RESTANTE</div>
                  <div class="bot-card-content"><div class="icon-circle" style="color: #f43f5e; background: #261318; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><div class="bot-val-box"><div class="bot-val" style="font-size: 40px;">4</div><div class="bot-unit">Dias</div></div></div>
                </div>
              </div>
            </div>
          </div>

          <!-- P2: ATTENUATION -->
          <div class="view" style="width: 20%; height: 100%; padding: 24px;">
            <div class="card" style="height: 100%; display: flex; align-items: center; padding: 40px; gap: 40px;">
              <div style="flex: 1; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
                  <div style="font-size: 28px; font-weight: 700;">Atenuação Aparente</div>
                  <div style="font-size: 56px; font-weight: 700;">0.0<span style="font-size: 28px; color: #888;">%</span></div>
                </div>
                <div style="height: 20px; background: #1a1a1a; border-radius: 10px; overflow: hidden; margin-bottom: 16px; border: 1px solid #333;">
                  <div style="height: 100%; width: 5%; background: #22c55e; border-radius: 10px;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; color: #888; font-size: 18px; font-weight: 700; letter-spacing: 2px;">
                  <div>OG: 1.050</div>
                  <div>FG ALVO: 1.010</div>
                </div>
              </div>
              <div style="width: 450px; background: #0f0f0f; border: 1px solid #222; border-radius: 16px; padding: 32px; display: flex; align-items: center; gap: 24px;">
                <div class="icon-circle" style="background: #1a1a1a; flex-shrink: 0; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#FFF;fill:none;stroke-width:2;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
                <div>
                  <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #888; margin-bottom: 8px;">EM ATIVIDADE</div>
                  <div style="font-size: 16px; color: #aaa; line-height: 1.5;">A fermentação segue ativa. Aguardando estabilização da densidade.</div>
                </div>
              </div>
            </div>
          </div>

          <!-- P3: TEMP CHART -->
          <div class="view" style="width: 20%; height: 100%; padding: 24px;">
            <div class="card" style="height: 100%; display: flex; flex-direction: column;">
                <div class="card-header">
                  <div class="card-title">TEMPERATURA (12H)</div>
                  <div class="chart-legend"><div class="legend-item"><div class="legend-dash"></div> TEMP</div></div>
                </div>
                <div class="chart-wrapper" style="flex: 1; margin-top: 16px;">
                  <svg class="trend-svg" viewBox="0 0 500 160" preserveAspectRatio="none" style="height: 100%; width: 100%;">
                    <line x1="0" y1="40" x2="500" y2="40" class="grid-line" /><line x1="0" y1="80" x2="500" y2="80" class="grid-line" /><line x1="0" y1="120" x2="500" y2="120" class="grid-line" />
                    <path class="trend-line" d="M0,80 L50,75 L100,78 L150,70 L200,65 L250,70 L300,80 L350,75 L400,60 L450,55 L500,50" />
                  </svg>
                </div>
            </div>
          </div>

          <!-- P4: SG CHART -->
          <div class="view" style="width: 20%; height: 100%; padding: 24px;">
            <div class="card" style="height: 100%; display: flex; flex-direction: column;">
                <div class="card-header">
                  <div class="card-title">ATENUAÇÃO / GRAVIDADE (12H)</div>
                  <div class="chart-legend"><div class="legend-item"><div class="legend-dash" style="background: #555;"></div> SG</div></div>
                </div>
                <div class="chart-wrapper" style="flex: 1; margin-top: 16px;">
                  <svg class="trend-svg" viewBox="0 0 500 160" preserveAspectRatio="none" style="height: 100%; width: 100%;">
                    <line x1="0" y1="40" x2="500" y2="40" class="grid-line" /><line x1="0" y1="80" x2="500" y2="80" class="grid-line" /><line x1="0" y1="120" x2="500" y2="120" class="grid-line" />
                    <path class="trend-line-sg" d="M0,20 L50,22 L100,25 L150,30 L200,35 L250,45 L300,55 L350,60 L400,75 L450,85 L500,100" />
                  </svg>
                </div>
            </div>
          </div>

          <!-- P5: COMBINED CHART -->
          <div class="view" style="width: 20%; height: 100%; padding: 24px;">
            <div class="card" style="height: 100%; display: flex; flex-direction: column;">
                <div class="card-header">
                  <div class="card-title">ANÁLISE COMBINADA (12H)</div>
                  <div class="chart-legend"><div class="legend-item"><div class="legend-dash"></div> TEMP</div><div class="legend-item"><div class="legend-dash" style="background: #555;"></div> SG</div></div>
                </div>
                <div class="chart-wrapper" style="flex: 1; margin-top: 16px;">
                  <svg class="trend-svg" viewBox="0 0 500 160" preserveAspectRatio="none" style="height: 100%; width: 100%;">
                    <line x1="0" y1="40" x2="500" y2="40" class="grid-line" /><line x1="0" y1="80" x2="500" y2="80" class="grid-line" /><line x1="0" y1="120" x2="500" y2="120" class="grid-line" />
                    <path class="trend-line-sg" d="M0,20 L50,22 L100,25 L150,30 L200,35 L250,45 L300,55 L350,60 L400,75 L450,85 L500,100" />
                    <path class="trend-line" d="M0,80 L50,75 L100,78 L150,70 L200,65 L250,70 L300,80 L350,75 L400,60 L450,55 L500,50" />
                  </svg>
                </div>
            </div>
          </div>

          </div>
        </div>
        <div class="pagination" style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px;">
          <div class="dot active"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>
      </div>
"""

html = html[:start_idx] + dash_html.strip() + '\n\n' + html[end_idx:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Dashboard rewritten!")
