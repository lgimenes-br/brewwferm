with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# 1. PAGE 2 BUTTONS
old_btns = """              <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; background: #1a1a1a; color: #FFF; border: 1px solid #333;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  PAUSAR
                </button>
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; background: #1a1a1a; color: #FFF; border: 1px solid #333;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                  ANTERIOR
                </button>
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; background: #1a1a1a; color: #FFF; border: 1px solid #333;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                  PRÓXIMA
                </button>
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; border: 1px solid #ff4444; color: #ff4444; background: #3a1111;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:#ff4444;stroke-width:0;"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                  FINALIZAR
                </button>
              </div>"""

new_btns = """              <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
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
html = html.replace(old_btns, new_btns)

# 2. PAGE 3 (Diario de Bordo) TOP
old_top = """              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div style="font-size: 14px; font-weight: 700; color: #888; letter-spacing: 3px; display: flex; align-items: center; gap: 12px;">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M3 15v4c0 1.1.9 2 2 2h14"></path></svg>
                  DIÁRIO DE BORDO
                </div>
                <button style="background: #222; border: 1px solid #333; border-radius: 20px; color: #FFF; font-weight: 700; font-size: 12px; letter-spacing: 2px; padding: 8px 20px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> ADICIONAR
                </button>
              </div>"""

new_top = """              <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 24px;">
                <div class="btn-set primary" style="padding: 12px 24px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> ADICIONAR
                </div>
              </div>"""
html = html.replace(old_top, new_top)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
