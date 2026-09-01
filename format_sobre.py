import re

html_str = ""
with open("public/7inch-launcher.html", "r") as f:
    html_str = f.read()

start = html_str.find('<div class="app-container" id="app-sobre"')
end = html_str.find('</div>\n\n  </div>\n</div>\n\n  <script>')

old_html = html_str[start:end]

new_html = """<div class="app-container" id="app-sobre" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="1" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 100%; display: flex; height: 100%;">
            <div class="view" style="width: 100%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              
              <!-- TOP ACTIONS -->
              <div style="display: flex; justify-content: flex-end; gap: 16px; margin-bottom: 24px;">
                <div class="btn-set primary" style="padding: 12px 24px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> TESTAR CONEXÃO
                </div>
                <div class="btn-set primary" style="padding: 12px 24px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> CONFIGURAR WIFI
                </div>
              </div>

              <!-- 3x2 GRID -->
              <div style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 24px; padding-bottom: 40px;">
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">FIRMWARE</div>
                  <div style="font-size: 24px; font-weight: 700; color: #FFF;">v2.0.07</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">HARDWARE</div>
                  <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">ESP32-P4</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">UPTIME</div>
                  <div style="font-size: 24px; font-weight: 700; color: #22c55e;">14d 02h</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">REDE (SSID)</div>
                  <div style="font-size: 20px; font-weight: 700; color: #FFF; text-align: center;">Breww_5G</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">IP LOCAL</div>
                  <div style="font-size: 20px; font-weight: 700; color: #FFF;">192.168.1.105</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background: #111; padding: 24px;">
                  <div style="font-size: 12px; font-weight: 700; color: #666; letter-spacing: 2px; margin-bottom: 12px; text-align: center;">SINAL WIFI</div>
                  <div style="font-size: 24px; font-weight: 700; color: #10b981;">-45dBm</div>
                </div>
              </div>

            </div>
          </div>
        </div>
        <div style="height: 60px; flex-shrink: 0;"></div>
      </div>"""

if old_html in html_str:
    html_str = html_str.replace(old_html, new_html)
else:
    print("Not found")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html_str)
