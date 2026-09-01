with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start_idx = html.find('<!-- P2: ATTENUATION -->')
end_idx = html.find('<!-- P3: TEMP CHART -->', start_idx)

new_p2 = """
          <!-- P2: ATTENUATION -->
          <div class="view" style="width: 20%; height: 100%; padding: 24px; display: flex; align-items: center; justify-content: center;">
            <div class="card" style="width: 90%; max-width: 800px; padding: 48px; position: relative; overflow: visible; background: #111; border: 1px solid #222;">
              
              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div style="font-size: 28px; font-weight: 700;">Atenuação Aparente</div>
                <div style="font-size: 48px; font-weight: 700;">0.0<span style="font-size: 24px; color: #888;">%</span></div>
              </div>
              
              <div style="height: 16px; background: #1a1a1a; border-radius: 8px; position: relative; border: 1px solid #333; margin-bottom: 16px;">
                <div style="width: 24px; height: 24px; background: #22c55e; border-radius: 50%; position: absolute; top: 50%; transform: translate(-50%, -50%); left: 0%;"></div>
              </div>
              
              <div style="display: flex; justify-content: space-between; color: #555; font-size: 16px; font-weight: 700; letter-spacing: 2px;">
                <div>OG: 1.050</div>
                <div>FG ALVO: 1.010</div>
              </div>

              <!-- Floating status card -->
              <div style="position: absolute; bottom: -40px; right: 40px; width: 450px; background: #0a0a0a; border: 1px solid #222; border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 24px; z-index: 10; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div class="icon-circle" style="background: #151515; flex-shrink: 0; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#888;fill:none;stroke-width:2;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
                <div>
                  <div style="font-size: 16px; font-weight: 700; letter-spacing: 2px; color: #888; margin-bottom: 8px;">EM ATIVIDADE</div>
                  <div style="font-size: 14px; color: #aaa; line-height: 1.5;">A fermentação segue ativa. Aguardando estabilização da densidade.</div>
                </div>
              </div>
            </div>
          </div>
"""

html = html[:start_idx] + new_p2.strip() + '\n\n' + html[end_idx:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Attenuation screen redesigned!")
