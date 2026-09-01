import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Replace the buttons container and buttons to be more compact
old_btns = """              <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
                <div class="btn-set primary" style="flex: 1; flex-direction: column; gap: 12px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  PAUSAR
                </div>
                <div class="btn-set primary" style="flex: 1; flex-direction: column; gap: 12px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                  ANTERIOR
                </div>
                <div class="btn-set primary" style="flex: 1; flex-direction: column; gap: 12px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                  PRÓXIMA
                </div>
                <div class="btn-set danger" style="flex: 1; flex-direction: column; gap: 12px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:28px;height:28px;stroke:currentColor;fill:#f43f5e;stroke-width:0;"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                  FINALIZAR
                </div>
              </div>"""

new_btns = """              <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; padding-bottom: 24px;">
                <div class="btn-set primary" style="flex: 1; flex-direction: column; gap: 8px; font-size: 12px; padding: 12px 0;">
                  <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  PAUSAR
                </div>
                <div class="btn-set primary" style="flex: 1; flex-direction: column; gap: 8px; font-size: 12px; padding: 12px 0;">
                  <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                  ANTERIOR
                </div>
                <div class="btn-set primary" style="flex: 1; flex-direction: column; gap: 8px; font-size: 12px; padding: 12px 0;">
                  <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                  PRÓXIMA
                </div>
                <div class="btn-set danger" style="flex: 1; flex-direction: column; gap: 8px; font-size: 12px; padding: 12px 0;">
                  <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:#f43f5e;stroke-width:0;"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                  FINALIZAR
                </div>
              </div>"""

if old_btns in html:
    html = html.replace(old_btns, new_btns)
else:
    print("Could not find the block!")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
