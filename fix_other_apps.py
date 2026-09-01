import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Fix Historico
h_start = html.find('<div class="app-container" id="app-historico"')
h_end = html.find('<div class="app-container" id="app-config"')
h_html = html[h_start:h_end]
h_html = h_html.replace('style="height: 100%; overflow: hidden;"', 'style="flex: 1; min-height: 0; overflow: hidden;"')
h_html = h_html.replace('      </div>\n\n      <div class="app-container"', '        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"><div class="dot active"></div></div>\n      </div>\n\n      <div class="app-container"')
html = html[:h_start] + h_html + html[h_end:]

# Fix Config
c_start = html.find('<div class="app-container" id="app-config"')
c_end = html.find('<div class="app-container" id="app-calculadoras"')
c_html = html[c_start:c_end]
c_html = c_html.replace('style="height: 100%; overflow: hidden;"', 'style="flex: 1; min-height: 0; overflow: hidden;"')
c_html = c_html.replace('      </div>\n\n      <div class="app-container"', '        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"><div class="dot active"></div></div>\n      </div>\n\n      <div class="app-container"')
html = html[:c_start] + c_html + html[c_end:]

# Fix Calculadoras
calc_start = html.find('<div class="app-container" id="app-calculadoras"')
calc_end = html.find('<!-- WIZARD LOGIC -->')
if calc_end == -1: calc_end = html.find('<script>')
calc_html = html[calc_start:calc_end]
calc_html = calc_html.replace('style="height: 100%; overflow: hidden;"', 'style="flex: 1; min-height: 0; overflow: hidden;"')
# It ends with </div>\n</div>\n\n  <script>
calc_html = re.sub(r'(\s*</div>\n\s*</div>\n\s*)$', r'\n        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"><div class="dot active"></div></div>\n\1', calc_html)

html = html[:calc_start] + calc_html + html[calc_end:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
