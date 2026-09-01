with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Remove page-top from historico
html = html.replace('<div class="page-top"><div><div class="page-title" style="margin: 0;">Lotes Finalizados</div></div></div>\n            ', '')

# Remove page-top from calculadoras
html = html.replace('<div class="page-top"><div><div class="page-title" style="margin: 0;">Calculadoras</div></div></div>\n            ', '')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
