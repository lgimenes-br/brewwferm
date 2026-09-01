import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start = html.find('id="app-config"')
end = html.find('id="app-calculadoras"')
config_html = html[start:end]

# 1. Change all generic `.btn-set` to `.btn-set primary` (except those that already have a secondary class)
# We will explicitly replace the known buttons
config_html = config_html.replace('<div class="btn-set">SALVAR NOME SG</div>', '<div class="btn-set primary">SALVAR NOME SG</div>')
config_html = config_html.replace('<div class="btn-set" style="flex: 1;">AQUECER</div>', '<div class="btn-set primary" style="flex: 1;">AQUECER</div>')
config_html = config_html.replace('<div class="btn-set" style="flex: 1;">REFRIGERAR</div>', '<div class="btn-set primary" style="flex: 1;">REFRIGERAR</div>')
config_html = config_html.replace('<div class="btn-set" style="flex: 1;">REINICIAR</div>', '<div class="btn-set primary" style="flex: 1;">REINICIAR</div>')
config_html = config_html.replace('<div class="btn-set" style="flex: 1;">LIMPAR LOGS</div>', '<div class="btn-set primary" style="flex: 1;">LIMPAR LOGS</div>')

# 2. Remove the page title
config_html = config_html.replace('<div class="page-top"><div><div class="page-title" style="margin: 0;">Configurações Avançadas</div></div></div>', '')

# 3. Remove the weird paddings and scroll spacers
config_html = config_html.replace('<div style="padding-bottom: 160px;">', '<div style="padding-bottom: 40px;">') # keep a small bottom padding so the last card doesn't perfectly stick to the footer
config_html = config_html.replace('<!-- Spacer to force scroll -->\n            <div style="height: 100px; width: 100%; flex-shrink: 0;"></div>', '')

html = html[:start] + config_html + html[end:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
