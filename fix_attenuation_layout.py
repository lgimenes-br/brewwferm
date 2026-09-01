with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

old_p2 = '''          <!-- P2: ATTENUATION -->
          <div class="view" style="width: 20%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0;">
            <div class="card" style="width: 100%; max-width: 900px; padding: 48px; padding-bottom: 72px; position: relative; background: #111; border: 1px solid #222; border-radius: 24px; z-index: 1;">
              
              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
                <div style="font-size: 28px; font-weight: 700; color: #FFF;">Atenuação Aparente</div>
                <div style="font-size: 56px; font-weight: 700; color: #FFF;">0.0<span style="font-size: 28px; color: #888;">%</span></div>
              </div>
              
              <div style="height: 16px; background: #1a1a1a; border-radius: 8px; position: relative; border: 1px solid #333; margin-bottom: 16px;">
                <div style="width: 24px; height: 24px; background: #22c55e; border-radius: 50%; position: absolute; top: 50%; transform: translate(-50%, -50%); left: 0%;"></div>
              </div>
              
              <div style="display: flex; justify-content: space-between; color: #666; font-size: 16px; font-weight: 700; letter-spacing: 2px;">
                <div>OG: 1.050</div>
                <div>FG ALVO: 1.010</div>
              </div>
            </div>

            <!-- Status card -->
            <div style="width: 500px; background: #0a0a0a; border: 1px solid #222; border-radius: 16px; padding: 24px; display: flex; align-items: center; gap: 24px; z-index: 2; margin-top: -40px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <div class="icon-circle" style="background: #151515; flex-shrink: 0; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#888;fill:none;stroke-width:2;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
              <div>
                <div style="font-size: 16px; font-weight: 700; letter-spacing: 2px; color: #888; margin-bottom: 8px;">EM ATIVIDADE</div>
                <div style="font-size: 14px; color: #aaa; line-height: 1.5;">A fermentação segue ativa. Aguardando estabilização da densidade.</div>
              </div>
            </div>
          </div>'''

new_p2 = '''          <!-- P2: ATTENUATION -->
          <div class="view" style="width: 20%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 24px;">
            <div class="card" style="padding: 48px; background: #111; border: 1px solid #222; border-radius: 24px;">
              
              <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
                <div style="font-size: 28px; font-weight: 700; color: #FFF;">Atenuação Aparente</div>
                <div style="font-size: 56px; font-weight: 700; color: #FFF;">0.0<span style="font-size: 28px; color: #888;">%</span></div>
              </div>
              
              <div style="height: 16px; background: #1a1a1a; border-radius: 8px; position: relative; border: 1px solid #333; margin-bottom: 16px;">
                <div style="width: 24px; height: 24px; background: #22c55e; border-radius: 50%; position: absolute; top: 50%; transform: translate(-50%, -50%); left: 0%;"></div>
              </div>
              
              <div style="display: flex; justify-content: space-between; color: #666; font-size: 16px; font-weight: 700; letter-spacing: 2px;">
                <div>OG: 1.050</div>
                <div>FG ALVO: 1.010</div>
              </div>
            </div>

            <!-- Status card -->
            <div class="card" style="padding: 32px 48px; display: flex; flex-direction: row; align-items: center; gap: 32px; background: #0a0a0a; border: 1px solid #222; border-radius: 24px;">
              <div class="icon-circle" style="background: #151515; flex-shrink: 0; width: 64px; height: 64px;"><svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#888;fill:none;stroke-width:2;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
              <div>
                <div style="font-size: 16px; font-weight: 700; letter-spacing: 2px; color: #888; margin-bottom: 8px;">EM ATIVIDADE</div>
                <div style="font-size: 14px; color: #aaa; line-height: 1.5;">A fermentação segue ativa. Aguardando estabilização da densidade.</div>
              </div>
            </div>
          </div>'''

html = html.replace(old_p2, new_p2)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
