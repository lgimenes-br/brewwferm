with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start = html.find('<div class="app-container" id="app-calculadoras"')
end = html.find('</div>\n\n  </div>\n</div>\n\n  <script>')

old_html = html[start:end]

new_html = """<div class="app-container" id="app-calculadoras" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="2" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 200%; display: flex; height: 100%; transition: transform 0.5s ease-out;">
            
            <!-- CALCULADORAS: PAGE 1 (MENU) -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%;">
              <div style="padding-bottom: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: start;">
                
                <!-- BRIX -->
                <div class="app-card" onclick="setAppPage(1)" style="height: 180px;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Correção de Brix</div>
                </div>

                <!-- ABV (Em breve) -->
                <div class="app-card" style="height: 180px; opacity: 0.4; cursor: default;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Cálculo de ABV</div>
                  <div style="font-size: 10px; color: #888; font-weight: 700; margin-top: 4px; letter-spacing: 1px;">EM BREVE</div>
                </div>

                <!-- CARBONATAÇÃO (Em breve) -->
                <div class="app-card" style="height: 180px; opacity: 0.4; cursor: default;">
                  <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="21.17" y1="8" x2="12" y2="8"></line><line x1="3.95" y1="6.06" x2="8.54" y2="14"></line><line x1="10.88" y1="21.94" x2="15.46" y2="14"></line></svg>
                  <div style="font-size: 14px; font-weight: 700; color: #FFF; text-align: center; margin-top: 16px;">Carbonatação</div>
                  <div style="font-size: 10px; color: #888; font-weight: 700; margin-top: 4px; letter-spacing: 1px;">EM BREVE</div>
                </div>
              </div>
            </div>

            <!-- CALCULADORAS: PAGE 2 (BRIX) -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%;">
              <div style="padding-bottom: 40px;">
                <div class="set-card">
                  <div class="set-title">CORREÇÃO DE REFRATÔMETRO (BRIX)</div>
                  <div class="set-desc">Converta leituras de Brix do refratômetro para gravidade específica (SG) considerando a presença de álcool durante e após a fermentação.</div>
                  
                  <div class="input-row" style="margin-bottom: 24px; align-items: flex-end;">
                    <div class="input-group">
                      <div class="input-label">OG (BRIX)</div>
                      <div class="input-box">12.0</div>
                    </div>
                    <div class="input-group">
                      <div class="input-label">FG ATUAL (BRIX)</div>
                      <div class="input-box">6.0</div>
                    </div>
                    <div class="btn-set primary">
                      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg> CALCULAR
                    </div>
                  </div>
                  
                  <div style="display: flex; gap: 24px;">
                    <div style="flex: 1; background: #0a0a0a; border: 1px solid #222; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center;">
                      <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 8px;">FG CORRIGIDA (SG)</div>
                      <div style="font-size: 32px; font-weight: 700; color: #FFF;">1.011</div>
                    </div>
                    <div style="flex: 1; background: #0a0a0a; border: 1px solid #222; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center;">
                      <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 8px;">ABV ESTIMADO</div>
                      <div style="font-size: 32px; font-weight: 700; color: #22c55e;">5.4%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <div class="dot active"></div>
          <div class="dot"></div>
        </div>
      </div>"""

if old_html in html:
    html = html.replace(old_html, new_html)
else:
    print("Could not find the block to replace!")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
