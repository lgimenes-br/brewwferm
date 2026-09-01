import math

html_str = ""
with open("public/7inch-launcher.html", "r") as f:
    html_str = f.read()

start = html_str.find('<div class="app-container" id="app-calculadoras"')
end = html_str.find('</div>\n\n  </div>\n</div>\n\n  <script>')

old_html = html_str[start:end]

# Generate the 6 items for menu
menu_items = """
                <!-- BRIX (Page 1) -->
                <div class="app-card" onclick="setAppPage(1)" style="height: 180px;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Correção de Brix</div>
                </div>

                <!-- ABV (Page 2) -->
                <div class="app-card" onclick="setAppPage(2)" style="height: 180px;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Cálculo de ABV</div>
                </div>

                <!-- CARBONATAÇÃO (Page 3) -->
                <div class="app-card" onclick="setAppPage(3)" style="height: 180px;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="21.17" y1="8" x2="12" y2="8"></line><line x1="3.95" y1="6.06" x2="8.54" y2="14"></line><line x1="10.88" y1="21.94" x2="15.46" y2="14"></line></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Carbonatação</div>
                </div>

                <!-- TAXA DE LEVEDURA (Page 4) -->
                <div class="app-card" onclick="setAppPage(4)" style="height: 180px;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M10 2v7.31"></path><path d="M14 9.3V1.99"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.5 16.5h13"></path></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Taxa de Levedura</div>
                </div>

                <!-- DENSIDADE (Page 5) -->
                <div class="app-card" onclick="setAppPage(5)" style="height: 180px;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Ajuste de Densidade</div>
                </div>

                <!-- DENSIMETRO TEMP (Page 6) -->
                <div class="app-card" onclick="setAppPage(6)" style="height: 180px;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Correção de Temp.</div>
                </div>
"""

# HTML block generator
def make_calc(title, inputs, results):
    width = 100/7
    inputs_html = ""
    for k, v in inputs.items():
        inputs_html += f'''
                    <div class="input-group">
                      <div class="input-label">{k}</div>
                      <div class="input-box">{v}</div>
                    </div>'''
    
    results_html = ""
    for k, v in results.items():
        color = "#FFF"
        if "ABV" in k or "Células" in k or "Corrigida" in k:
            color = "#22c55e"
        if "Pressão" in k or "Água" in k:
            color = "#3b82f6"
        results_html += f'''
                    <div style="flex: 1; background: #0a0a0a; border: 1px solid #222; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center;">
                      <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 8px;">{k}</div>
                      <div style="font-size: 32px; font-weight: 700; color: {color};">{v}</div>
                    </div>'''

    return f'''
            <div class="view" style="width: {width}%; padding: 0 40px; box-sizing: border-box; height: 100%;">
              <div style="padding-bottom: 40px;">
                <div class="set-card">
                  <div class="input-row" style="margin-bottom: 24px; align-items: flex-end;">
                    {inputs_html}
                    <div class="btn-set primary">
                      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg> CALCULAR
                    </div>
                  </div>
                  
                  <div style="display: flex; gap: 24px;">
                    {results_html}
                  </div>
                </div>
              </div>
            </div>'''

calc1 = make_calc("Brix", {"OG (BRIX)": "12.0", "FG (BRIX)": "6.0"}, {"FG CORRIGIDA (SG)": "1.011", "ABV ESTIMADO": "5.4%"})
calc2 = make_calc("ABV", {"OG (SG)": "1.050", "FG (SG)": "1.010"}, {"ABV": "5.2%", "ATENUAÇÃO": "80%"})
calc3 = make_calc("Carbonatação", {"VOLUMES CO2": "2.5", "TEMP (°C)": "4.0"}, {"PRESSÃO ALVO (PSI)": "11.2", "AÇÚCAR (g/L)": "5.6"})
calc4 = make_calc("Levedura", {"LITROS": "20", "OG (SG)": "1.050", "TAXA": "0.75"}, {"CÉLULAS (Bilhões)": "180", "PACOTES (11g)": "2"})
calc5 = make_calc("Densidade", {"LITROS ATUAL": "20", "SG ATUAL": "1.040", "SG ALVO": "1.050"}, {"VOLUME FINAL (L)": "16.0", "FERVER/ÁGUA": "-4.0 L"})
calc6 = make_calc("Temp", {"SG LIDA": "1.045", "TEMP AMOSTRA": "30°C", "TEMP CALIB.": "20°C"}, {"SG CORRIGIDA": "1.048"})

new_html = f'''<div class="app-container" id="app-calculadoras" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="7" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 700%; display: flex; height: 100%; transition: transform 0.5s ease-out;">
            
            <!-- MENU (Page 0) -->
            <div class="view" style="width: {100/7}%; padding: 0 40px; box-sizing: border-box; height: 100%;">
              <div style="padding-bottom: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: start;">
{menu_items}
              </div>
            </div>

{calc1}
{calc2}
{calc3}
{calc4}
{calc5}
{calc6}
          </div>
        </div>
        
        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <div class="dot active"></div>
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>'''

if old_html in html_str:
    html_str = html_str.replace(old_html, new_html)
else:
    print("Not found")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html_str)
