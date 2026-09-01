import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start_idx = html.find('<!-- M2: TELEMETRIA P1 -->')
end_idx = html.find('          </div>\n        </div>\n        <div class="pagination"', start_idx)

# Define the new P1 and P2 without the titles, and using flex to stretch height
new_p1 = """
          <!-- M2: TELEMETRIA P1 -->
          <div class="view" style="width: 50%; padding-bottom: 60px;">
            <div style="display: flex; flex-direction: column; height: 100%; gap: 24px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1;">
                <div class="card" style="padding: 32px; display: flex; flex-direction: column; justify-content: center;">
                  <div class="card-title">TEMP MOSTO</div><div class="tl-desc">S1 - Poço Térmico</div>
                  <div style="font-size: 72px; font-weight: 700; color: var(--text-primary); margin-top: auto;"><span id="telemetria-temp">18.5</span><span style="font-size: 24px; color: var(--text-secondary);">°C</span></div>
                </div>
                <div class="card" style="padding: 32px; display: flex; flex-direction: column; justify-content: center;">
                  <div class="card-title">GRAVIDADE (SG)</div><div class="tl-desc">iSpindel</div>
                  <div style="font-size: 72px; font-weight: 700; color: #22c55e; margin-top: auto;"><span id="telemetria-sg">1.024</span></div>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; flex: 1;">
                <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center;"><div class="tl-name" style="font-size: 16px;">Bateria iSpindel</div><div class="tl-value" style="font-size: 32px; margin-top: auto;">4.1V</div></div>
                <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center;"><div class="tl-name" style="font-size: 16px;">Ângulo iSpindel</div><div class="tl-value" style="font-size: 32px; margin-top: auto;">42.5°</div></div>
                <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center;"><div class="tl-name" style="font-size: 16px;">Temp iSpindel</div><div class="tl-value" style="font-size: 32px; margin-top: auto;">18.2°C</div></div>
                <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center;"><div class="tl-name" style="font-size: 16px;">Sinal Wi-Fi</div><div class="tl-value" style="font-size: 32px; margin-top: auto;">-68 dBm</div></div>
              </div>
            </div>
          </div>
"""

new_p2 = """
          <!-- M2: TELEMETRIA P2 -->
          <div class="view" style="width: 50%; padding-bottom: 60px;">
            <div style="display: flex; flex-direction: column; height: 100%; gap: 24px;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1;">
                <div class="card" style="padding: 32px; display: flex; flex-direction: column; justify-content: center; border-color: #4c1d28; background: #1a0f12;">
                  <div class="card-title" style="color: #f43f5e;">RELÉ AQUECIMENTO</div><div class="tl-desc">Resistência</div>
                  <div style="font-size: 48px; font-weight: 700; color: #f43f5e; margin-top: auto;">DESLIGADO</div>
                </div>
                <div class="card" style="padding: 32px; display: flex; flex-direction: column; justify-content: center; border-color: #1e3a8a; background: #0f172a;">
                  <div class="card-title" style="color: #3b82f6;">RELÉ FRIO</div><div class="tl-desc">Compressor</div>
                  <div style="font-size: 48px; font-weight: 700; color: #3b82f6; margin-top: auto;">LIGADO</div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; flex: 1;">
                <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center;"><div class="tl-name" style="font-size: 16px;">Sinal PWM</div><div class="tl-value" style="font-size: 32px; margin-top: auto;">0%</div></div>
                <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center;"><div class="tl-name" style="font-size: 16px;">Uptime</div><div class="tl-value" style="font-size: 32px; margin-top: auto;">12h 45m</div></div>
                <div class="card" style="padding: 24px; display: flex; flex-direction: column; justify-content: center;"><div class="tl-name" style="font-size: 16px;">Carga CPU</div><div class="tl-value" style="font-size: 32px; margin-top: auto;">14%</div></div>
              </div>
            </div>
          </div>
"""

new_content = new_p1 + new_p2
html = html[:start_idx] + new_content.strip() + '\n' + html[end_idx:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)

print("Telemetry fixed!")
