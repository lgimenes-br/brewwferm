with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

old_btn = '''        <div class="app-card" onclick="openApp(2)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg></div>
          <div class="app-name">Gráficos</div>
        </div>'''

new_btn = '''        <div class="app-card" onclick="openApp(2)">
          <div class="app-icon"><svg viewBox="0 0 24 24" style="width:100%;height:100%;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M6 2h12v10l-6 10-6-10z"></path><path d="M6 6h12"></path><path d="M9 22v2"></path><path d="M15 22v2"></path></svg></div>
          <div class="app-name">Fermentação</div>
        </div>'''

html = html.replace(old_btn, new_btn)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
