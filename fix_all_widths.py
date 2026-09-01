import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Fix Dashboard views (should be 20%)
start_dash = html.find('<div class="app-container" id="app-dashboard"')
end_dash = html.find('<div class="app-container" id="app-telemetria"')
dash_html = html[start_dash:end_dash]
dash_html = re.sub(r'<div class="view"\s+style="width:\s*100%;\s*padding:\s*24px;">', '<div class="view" style="width: 20%; padding: 0 40px; box-sizing: border-box; height: 100%;">', dash_html)
# Wait, let's just make it the exact layout the user wanted!
# padding 0 40px, box-sizing: border-box, height: 100%
dash_html = re.sub(r'<div class="view"\s+style="[^"]+">', '<div class="view" style="width: 20%; padding: 0 40px; box-sizing: border-box; height: 100%;">', dash_html)

# Fix Telemetria views (should be 50%)
start_tel = html.find('<div class="app-container" id="app-telemetria"')
end_tel = html.find('<div class="app-container" id="app-rampas"')
tel_html = html[start_tel:end_tel]
tel_html = re.sub(r'<div class="view"\s+style="[^"]+">', '<div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%;">', tel_html)

# Fix other apps (should be 100%)
start_others = html.find('<div class="app-container" id="app-rampas"')
end_others = html.find('<!-- WIZARD LOGIC -->')
if end_others == -1: end_others = html.find('<script>')
others_html = html[start_others:end_others]
others_html = re.sub(r'<div class="view"\s+style="[^"]+">', '<div class="view" style="width: 100%; padding: 0 40px; box-sizing: border-box; height: 100%;">', others_html)

# Combine
html = html[:start_dash] + dash_html + tel_html + others_html + html[end_others:]

# Fix attenuation view layout again
html = html.replace('<div class="view" style="width: 20%; padding: 0 40px; box-sizing: border-box; height: 100%;">\n            <div class="card" style="width: 90%; max-width: 900px; padding: 48px; padding-bottom: 72px;', 
                    '<div class="view" style="width: 20%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0;">\n            <div class="card" style="width: 100%; max-width: 900px; padding: 48px; padding-bottom: 72px;')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
