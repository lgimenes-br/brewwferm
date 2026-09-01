with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

old_block = """                  <div class="set-title">CORREÇÃO DE REFRATÔMETRO (BRIX)</div>
                  <div class="set-desc">Converta leituras de Brix do refratômetro para gravidade específica (SG) considerando a presença de álcool durante e após a fermentação.</div>
                  
                  <div class="input-row" style="margin-bottom: 24px; align-items: flex-end;">"""

new_block = """                  <div class="input-row" style="margin-bottom: 24px; align-items: flex-end;">"""

if old_block in html:
    html = html.replace(old_block, new_block)
else:
    print("Not found")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
