import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start_idx = html.find('<!-- M1: DASHBOARD -->')
end_idx = html.find('</div>\n      </div>\n\n      <div class="app-container" id="app-telemetria"', start_idx)

new_dash_html = """
          <!-- M1: DASHBOARD P1 -->
          <div class="view" style="width: 50%; padding-bottom: 60px;">
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
                  <div class="bot-card-content"><div class="icon-circle" style="color: #c084fc; background: #1b1424; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div><div class="bot-val-box"><div class="bot-val" id="main-sg" style="font-size: 40px;">1.024</div><div class="bot-unit">SG</div></div></div>
                </div>
                <div class="card" style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 24px;">
                  <div class="card-title" style="margin-bottom: 12px;">SETPOINT ALVO</div>
                  <div class="bot-card-content"><div class="icon-circle" style="width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg></div><div class="bot-val-box"><div class="bot-val" style="font-size: 40px;">18.0</div><div class="bot-unit">°C</div></div></div>
                </div>
                <div class="card" style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 24px;">
                  <div class="card-title" style="margin-bottom: 12px;">TEMPO RESTANTE</div>
                  <div class="bot-card-content"><div class="icon-circle" style="color: #f43f5e; background: #261318; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><div class="bot-val-box"><div class="bot-val" style="font-size: 40px;">4</div><div class="bot-unit">Dias</div></div></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- M1: DASHBOARD P2 -->
          <div class="view" style="width: 50%; padding-bottom: 60px;">
            <div class="card" style="height: 100%; display: flex; flex-direction: column;">
                <div class="card-header">
                  <div class="card-title">ANÁLISE DE TENDÊNCIA 12H</div>
                  <div class="chart-legend"><div class="legend-item"><div class="legend-dash"></div> TEMP</div><div class="legend-item"><div class="legend-dash" style="background: #555;"></div> SG</div></div>
                </div>
                <div class="chart-wrapper" style="flex: 1; margin-top: 16px;">
                  <svg class="trend-svg" viewBox="0 0 500 160" preserveAspectRatio="none" style="height: 100%; width: 100%;">
                    <line x1="0" y1="40" x2="500" y2="40" class="grid-line" /><line x1="0" y1="80" x2="500" y2="80" class="grid-line" /><line x1="0" y1="120" x2="500" y2="120" class="grid-line" />
                    <path id="trend-sg" class="trend-line-sg" d="" /><path id="trend-temp" class="trend-line" d="" />
                  </svg>
                </div>
            </div>
          </div>
"""

# I need to update the wrapper's data-pages to 2, and views-track width to 200%.
# Also add pagination dots.
dashboard_wrapper_start = html.rfind('<div class="app-container" id="app-dashboard"', 0, start_idx)
dashboard_wrapper_end = html.find('<div class="views-track"', dashboard_wrapper_start)

# Replace data-pages="1" with data-pages="2"
html = html[:dashboard_wrapper_start] + html[dashboard_wrapper_start:dashboard_wrapper_end].replace('data-pages="1"', 'data-pages="2"') + html[dashboard_wrapper_end:]

# Replace width: 100% with width: 200% for the views-track
track_idx = html.find('<div class="views-track"', dashboard_wrapper_start)
track_end = html.find('>', track_idx)
new_track = html[track_idx:track_end].replace('width: 100%;', 'width: 200%;')
html = html[:track_idx] + new_track + html[track_end:]

# Now replace the inner views
start_idx = html.find('<!-- M1: DASHBOARD -->')
end_idx = html.find('          </div>\n        </div>\n      </div>\n\n      <div class="app-container" id="app-telemetria"', start_idx)
if end_idx == -1: print("End index not found!"); exit(1)

html = html[:start_idx] + new_dash_html.strip() + '\n          </div>\n        </div>\n        <div class="pagination" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px;"><div class="dot active"></div><div class="dot"></div></div>\n      </div>\n\n      <div class="app-container" id="app-telemetria"' + html[end_idx+95:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Dashboard split into 2 screens!")
