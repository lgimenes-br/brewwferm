import re

html_str = ""
with open("public/7inch-launcher.html", "r") as f:
    html_str = f.read()

# 1. Update the Main Menu Icon (from Calculadoras to Sobre)
old_menu_icon = """<div class="app-card" onclick="openApp(5)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line></svg></div>
          <div class="app-name">Calculadoras</div>
        </div>"""

new_menu_icon = """<div class="app-card" onclick="openApp(5)">
          <div class="app-icon"><svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></div>
          <div class="app-name">Sobre</div>
        </div>"""

html_str = html_str.replace(old_menu_icon, new_menu_icon)

# 2. Replace app-calculadoras block with app-sobre block
start_app = html_str.find('<div class="app-container" id="app-calculadoras"')
end_app = html_str.find('</div>\n\n  </div>\n</div>\n\n  <script>')

sobre_html = """<div class="app-container" id="app-sobre" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="1" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 100%; display: flex; height: 100%;">
            <div class="view" style="width: 100%; padding: 0 40px; box-sizing: border-box; height: 100%; overflow-y: auto;">
              <div style="padding-bottom: 40px;">
                
                <div class="set-card">
                  <div class="set-title">INFORMAÇÕES DO SISTEMA</div>
                  <div style="display: flex; gap: 24px;">
                    <div style="flex: 1; background: #0a0a0a; border: 1px solid #222; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center;">
                      <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 8px;">VERSÃO DO FIRMWARE</div>
                      <div style="font-size: 24px; font-weight: 700; color: #FFF;">v2.0.07 BETA</div>
                    </div>
                    <div style="flex: 1; background: #0a0a0a; border: 1px solid #222; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center;">
                      <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 8px;">HARDWARE BOARD</div>
                      <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">ESP32-P4</div>
                    </div>
                    <div style="flex: 1; background: #0a0a0a; border: 1px solid #222; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center;">
                      <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 8px;">TEMPO LIGADO</div>
                      <div style="font-size: 24px; font-weight: 700; color: #22c55e;">14d 02h</div>
                    </div>
                  </div>
                </div>

                <div class="set-card">
                  <div class="set-title">CONEXÃO WIFI</div>
                  <div class="input-row" style="margin-bottom: 24px; align-items: flex-end;">
                    <div class="input-group">
                      <div class="input-label">SSID (REDE ATUAL)</div>
                      <div class="input-box">Breww_Network_5G</div>
                    </div>
                    <div class="input-group">
                      <div class="input-label">ENDEREÇO IP (LOCAL)</div>
                      <div class="input-box">192.168.1.105</div>
                    </div>
                    <div class="input-group">
                      <div class="input-label">QUALIDADE DO SINAL</div>
                      <div class="input-box" style="color: #10b981; font-weight: 700;">Excelente (-45dBm)</div>
                    </div>
                  </div>
                  <div class="input-row" style="margin-bottom: 0;">
                    <div class="btn-set primary" style="flex: 1;">
                      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> TESTAR CONEXÃO
                    </div>
                    <div class="btn-set primary" style="flex: 1;">
                      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> CONFIGURAR WIFI
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
        <div style="height: 60px; flex-shrink: 0;"></div>
      </div>"""

html_str = html_str[:start_app] + sobre_html + html_str[end_app:]

# 3. Restore simple goHome() function
old_gohome_complex = """    function goHome() {
      // Intercept if inside a calculator detail
      if (activeAppId === 'app-calculadoras') {
        const calcMenu = document.getElementById('calc-menu');
        if (calcMenu && calcMenu.style.display === 'none') {
          const calcs = ['calc-brix', 'calc-abv', 'calc-carb', 'calc-yeast', 'calc-dens', 'calc-temp'];
          calcs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          calcMenu.style.display = 'grid';
          return; // Stop execution
        }
      }

      document.getElementById('main-ui').style.display = 'none';
      document.getElementById('launcher-ui').style.display = 'flex';
    }"""

new_gohome_simple = """    function goHome() {
      document.getElementById('main-ui').style.display = 'none';
      document.getElementById('launcher-ui').style.display = 'flex';
    }"""

if old_gohome_complex in html_str:
    html_str = html_str.replace(old_gohome_complex, new_gohome_simple)

# 4. Replace 'app-calculadoras' with 'app-sobre' in appIds array
html_str = html_str.replace("'app-calculadoras'", "'app-sobre'")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html_str)
