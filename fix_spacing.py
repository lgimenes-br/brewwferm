with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Fix Telemetria spacing
telemetria_wrapper = '<div class="app-container" id="app-telemetria" style="display: none; height: 100%; position: relative;">\n        <div class="views-wrapper" data-pages="2" style="height: 100%; overflow: hidden;">'
telemetria_wrapper_new = '<div class="app-container" id="app-telemetria" style="display: none; height: 100%; position: relative;">\n        <div class="views-wrapper" data-pages="2" style="height: calc(100% - 50px); overflow: hidden;">'
html = html.replace(telemetria_wrapper, telemetria_wrapper_new)

# Remove padding-bottom: 60px from Telemetria views
p1_start = html.find('<!-- M2: TELEMETRIA P1 -->')
p1_end = html.find('<!-- M2: TELEMETRIA P2 -->', p1_start)
html = html[:p1_start] + html[p1_start:p1_end].replace('padding-bottom: 60px;', 'padding-bottom: 0px;') + html[p1_end:]

p2_start = html.find('<!-- M2: TELEMETRIA P2 -->')
p2_end = html.find('</div>\n        </div>\n        <div class="pagination"', p2_start)
html = html[:p2_start] + html[p2_start:p2_end].replace('padding-bottom: 60px;', 'padding-bottom: 0px;') + html[p2_end:]

# Set pagination position to 16px to match Dashboard
html = html.replace('<div class="pagination" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px;">', '<div class="pagination" style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px;">')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Spacing Fixed!")
