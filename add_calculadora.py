with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

old_calc = """<div class="app-container" id="app-calculadoras" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="1" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 100%; display: flex; height: 100%;">
            <!-- M6: CALCULADORAS -->
          <div class="view" style="width: 100%; padding: 0 40px; box-sizing: border-box; height: 100%;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60%; color: var(--text-secondary);">
              <svg viewBox="0 0 24 24" style="width:64px;height:64px;stroke:currentColor;fill:none;stroke-width:2;margin-bottom:24px;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line></svg>
              <div style="font-size: 20px; font-weight: 700; color: #FFF;">Calculadoras Cervejeiras</div>
              <div style="margin-top: 12px; font-size: 14px;">ABV, Correção de Densidade, Carbonatação, etc.</div>
            </div>
          </div>
          </div>
        </div>
        <div style="height: 60px; flex-shrink: 0;"></div>
      </div>"""

new_calc = """<div class="app-container" id="app-calculadoras" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="1" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 100%; display: flex; height: 100%;">
            <!-- M6: CALCULADORAS -->
            <div class="view" style="width: 100%; padding: 0 40px; box-sizing: border-box; height: 100%;">
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
        <div style="height: 60px; flex-shrink: 0;"></div>
      </div>"""

if old_calc in html:
    html = html.replace(old_calc, new_calc)
else:
    print("Not found")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
