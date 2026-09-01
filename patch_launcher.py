import re

with open('public/7inch-launcher.html', 'r') as f:
    html = f.read()

# 1. Add CSS for Launcher
launcher_css = """
  /* LAUNCHER UI */
  #launcher-ui { display: none; flex-direction: column; height: 100%; width: 100%; animation: fadeIn 0.5s; background: var(--bg-base); padding: 40px; }
  .launcher-header { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; }
  .launcher-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; flex: 1; }
  .app-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; transition: 0.2s; }
  .app-card:active { transform: scale(0.95); opacity: 0.8; }
  .app-icon { width: 64px; height: 64px; border-radius: 16px; background: #1A1A1A; display: flex; align-items: center; justify-content: center; border: 1px solid #333; }
  .app-icon svg { width: 32px; height: 32px; stroke: #FFF; stroke-width: 2; fill: none; }
  .app-name { font-size: 18px; font-weight: 700; color: var(--text-primary); letter-spacing: 1px; text-transform: uppercase; }
  .home-btn { background: #1A1A1A; border: 1px solid #333; padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
"""
html = html.replace("</style>", launcher_css + "\n</style>")

# 2. Add Launcher HTML right before <div id="main-ui">
launcher_html = """
    <!-- =========================================
         LAUNCHER UI
         ========================================= -->
    <div id="launcher-ui">
      <div class="launcher-header">
        <div>
          <div style="font-size: 28px; font-weight: 600; letter-spacing: -1px;">Olá, Cervejeiro</div>
          <div style="font-size: 14px; color: var(--text-secondary); margin-top: 4px;">Selecione um aplicativo para iniciar</div>
        </div>
        <div style="font-size: 20px; font-weight: 700; color: #555;">12:40</div>
      </div>
      <div class="launcher-grid">
        <div class="app-card" onclick="openApp(0)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></div>
          <div class="app-name">Dashboard</div>
        </div>
        <div class="app-card" onclick="openApp(1)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
          <div class="app-name">Telemetria</div>
        </div>
        <div class="app-card" onclick="openApp(2)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg></div>
          <div class="app-name">Gráficos</div>
        </div>
        <div class="app-card" onclick="openApp(3)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></div>
          <div class="app-name">Logs</div>
        </div>
        <div class="app-card" onclick="openApp(4)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></div>
          <div class="app-name">Settings</div>
        </div>
        <div class="app-card" onclick="openApp(5)">
          <div class="app-icon"><svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line></svg></div>
          <div class="app-name">Calculadoras</div>
        </div>
      </div>
    </div>
"""
html = html.replace('    <div id="main-ui">', launcher_html + '\n    <div id="main-ui">')

# 3. Add Home button to Header and make track width 600% (6 views)
# Wait, first find the header icons and prepend the home button
header_icons_replace = """<div class="header-icons">
            <div class="home-btn" onclick="goHome()"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#FFF;fill:none;stroke-width:2;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>
"""
html = html.replace('<div class="header-icons">', header_icons_replace)

# Track width
html = html.replace('width: 500%;', 'width: 600%;')
# The .view flex basis is calc(100% / 5). We change it to 6.
html = html.replace('flex: 0 0 calc(100% / 5);', 'flex: 0 0 calc(100% / 6);')
html = html.replace('width: calc(100% / 5);', 'width: calc(100% / 6);')

# Add 6th dot to pagination
html = html.replace('<div class="dot active"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>', 
                    '<div class="dot active"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div>')

# 4. Append Calculadoras View at the end of M5 (before closing main-track)
m6_html = """          <!-- M6: CALCULADORAS -->
          <div class="view">
            <div class="page-top"><div><div class="page-title" style="margin: 0;">Calculadoras</div></div></div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60%; color: var(--text-secondary);">
              <svg viewBox="0 0 24 24" style="width:64px;height:64px;stroke:currentColor;fill:none;stroke-width:2;margin-bottom:24px;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="14.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line></svg>
              <div style="font-size: 20px; font-weight: 700; color: #FFF;">Calculadoras Cervejeiras</div>
              <div style="margin-top: 12px; font-size: 14px;">ABV, Correção de Densidade, Carbonatação, etc.</div>
            </div>
          </div>
"""
# Replace the end of M5 to insert M6
html = html.replace('<!-- Spacer to force scroll past pagination dots -->', m6_html + '\n            <!-- Spacer to force scroll past pagination dots -->')

# 5. JS Changes
js_changes = """
    function finishWizard() {
      document.getElementById('wizard-ui').style.display = 'none';
      document.getElementById('launcher-ui').style.display = 'flex';
      initMainDashboard();
    }

    function openApp(index) {
      document.getElementById('launcher-ui').style.display = 'none';
      document.getElementById('main-ui').style.display = 'flex';
      setMainView(index);
    }
    
    function goHome() {
      document.getElementById('main-ui').style.display = 'none';
      document.getElementById('launcher-ui').style.display = 'flex';
    }
"""
html = html.replace("""    function finishWizard() {
      document.getElementById('wizard-ui').style.display = 'none';
      document.getElementById('main-ui').style.display = 'flex';
      initMainDashboard();
    }""", js_changes)

# Update totalMainViews in JS
html = html.replace('const totalMainViews = 5;', 'const totalMainViews = 6;')

with open('public/7inch-launcher.html', 'w') as f:
    f.write(html)
print("Patch successful!")
