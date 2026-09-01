with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

old_block = """            <!-- M3: HISTÓRICO - PAGE 2 (DETALHES) -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div style="font-size: 20px; font-weight: 700; color: #FFF; letter-spacing: 1px;">Detalhes do Lote</div>
                <div class="btn-set primary" onclick="setAppPage(0)" style="padding: 12px 24px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> VOLTAR
                </div>
              </div>

              <div style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 24px; padding-bottom: 24px;">"""

new_block = """            <!-- M3: HISTÓRICO - PAGE 2 (DETALHES) -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 24px; padding-bottom: 24px;">"""

if old_block in html:
    html = html.replace(old_block, new_block)
else:
    print("Not found")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
