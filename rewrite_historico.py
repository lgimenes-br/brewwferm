with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start = html.find('<div class="app-container" id="app-historico"')
end = html.find('<div class="app-container" id="app-config"')

old_hist = html[start:end]

new_hist = """<div class="app-container" id="app-historico" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="2" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 200%; display: flex; height: 100%; transition: transform 0.5s ease-out;">
            <!-- M3: HISTÓRICO - PAGE 1 -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%;">
              <div style="padding-bottom: 40px;">
                <div style="display: flex; justify-content: flex-end; gap: 16px; margin-bottom: 24px;">
                  <div class="btn-set primary" style="padding: 12px 24px; font-size: 14px;">
                    <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> EXPORTAR LOGS
                  </div>
                  <div class="btn-set danger" style="padding: 12px 24px; font-size: 14px;">
                    <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> LIMPAR LOGS
                  </div>
                </div>
                <div class="card" style="padding: 0; overflow: hidden;">
                  <table class="history-table">
                    <tr><th>Data</th><th>Receita</th><th>OG</th><th>FG</th><th>Duração</th></tr>
                    <tr onclick="setAppPage(1)" style="cursor: pointer;"><td>12/08/2026</td><td>Pilsen Tcheca</td><td>1.048</td><td>1.011</td><td>32 Dias</td></tr>
                    <tr onclick="setAppPage(1)" style="cursor: pointer;"><td>05/07/2026</td><td>APA Citra</td><td>1.054</td><td>1.012</td><td>14 Dias</td></tr>
                    <tr onclick="setAppPage(1)" style="cursor: pointer;"><td>18/06/2026</td><td>Oatmeal Stout</td><td>1.060</td><td>1.018</td><td>21 Dias</td></tr>
                    <tr onclick="setAppPage(1)" style="cursor: pointer;"><td>02/05/2026</td><td>Witbier</td><td>1.045</td><td>1.010</td><td>12 Dias</td></tr>
                  </table>
                </div>
              </div>
            </div>

            <!-- M3: HISTÓRICO - PAGE 2 (DETALHES) -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div style="font-size: 20px; font-weight: 700; color: #FFF; letter-spacing: 1px;">Detalhes do Lote</div>
                <div class="btn-set primary" onclick="setAppPage(0)" style="padding: 12px 24px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> VOLTAR
                </div>
              </div>

              <div style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 24px; padding-bottom: 24px;">
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px;">DURAÇÃO</div>
                  <div style="font-size: 32px; font-weight: 700; color: #f97316;">36d 20h</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px;">ABV EST.</div>
                  <div style="font-size: 32px; font-weight: 700; color: #22c55e;">5.3%</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px;">OG INICIAL</div>
                  <div style="font-size: 32px; font-weight: 700; color: #FFF;">1.050</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px;">FG FINAL</div>
                  <div style="font-size: 32px; font-weight: 700; color: #FFF;">1.010</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px;">MÁX TEMP</div>
                  <div style="font-size: 32px; font-weight: 700; color: #ef4444;">23.5°C</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px;">MÍN TEMP</div>
                  <div style="font-size: 32px; font-weight: 700; color: #3b82f6;">16.5°C</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <div class="dot active"></div>
          <div class="dot"></div>
        </div>
      </div>\n\n      """

html = html[:start] + new_hist + html[end:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
