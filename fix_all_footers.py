import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# 1. Remove the stray global pagination at the very end
stray_pag = r'      </div>\n        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"><div class="dot active"></div></div>\n      </div>\n\n  </div>\n</div>'
fixed_pag = r'        <div style="height: 60px; flex-shrink: 0;"></div>\n      </div>\n      </div>\n\n  </div>\n</div>'
if re.search(stray_pag, html):
    html = re.sub(stray_pag, fixed_pag, html)

# 2. Let's make sure Historico has a spacer
start_h = html.find('id="app-historico"')
end_h = html.find('id="app-config"')
if start_h != -1:
    h_block = html[start_h:end_h]
    if 'height: 60px' not in h_block:
        h_block = h_block.replace('      </div>\n\n      <div class="app-container"', '        <div style="height: 60px; flex-shrink: 0;"></div>\n      </div>\n\n      <div class="app-container"')
        html = html[:start_h] + h_block + html[end_h:]

# 3. Let's make sure Config has a spacer
start_c = html.find('id="app-config"')
end_c = html.find('id="app-calculadoras"')
if start_c != -1:
    c_block = html[start_c:end_c]
    if 'height: 60px' not in c_block:
        c_block = c_block.replace('      </div>\n\n      <div class="app-container"', '        <div style="height: 60px; flex-shrink: 0;"></div>\n      </div>\n\n      <div class="app-container"')
        html = html[:start_c] + c_block + html[end_c:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
