import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# 1. Extract the 6 views using regex.
# Each view starts with <!-- M1:, <!-- M2:, etc. and ends where the next one begins, or at <!-- Spacer
matches = re.finditer(r'(<!-- M(\d): .*?-->\s*<div class="view">.*?)(?=<!-- M\d: |<!-- Spacer)', html, re.DOTALL)
views = {}
for m in matches:
    idx = int(m.group(2))
    content = m.group(1).strip()
    views[idx] = content

# 2. Let's create the new isolated wrappers.
apps_html = ""

app_ids = {
    1: "app-dashboard",
    2: "app-telemetria",
    3: "app-rampas",
    4: "app-historico",
    5: "app-config",
    6: "app-calculadoras"
}

telemetria_p1 = """
          <!-- M2: TELEMETRIA P1 -->
          <div class="view" style="width: 50%;">
            <div class="page-top"><div><div class="page-title" style="margin: 0;">Telemetria (1/2)</div><div class="page-subtitle">Sensores Principais</div></div></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
              <div class="card" style="padding: 32px; display: flex; align-items: center; justify-content: space-between;">
                <div><div class="card-title">TEMP MOSTO</div><div class="tl-desc">S1 - Poço Térmico</div></div>
                <div style="font-size: 56px; font-weight: 700; color: var(--text-primary);"><span id="telemetria-temp">18.5</span><span style="font-size: 24px; color: var(--text-secondary);">°C</span></div>
              </div>
              <div class="card" style="padding: 32px; display: flex; align-items: center; justify-content: space-between;">
                <div><div class="card-title">GRAVIDADE (SG)</div><div class="tl-desc">iSpindel</div></div>
                <div style="font-size: 56px; font-weight: 700; color: #22c55e;"><span id="telemetria-sg">1.024</span></div>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
              <div class="card" style="padding: 24px;"><div class="tl-name" style="font-size: 16px;">Bateria iSpindel</div><div class="tl-value" style="font-size: 24px;">4.1V</div></div>
              <div class="card" style="padding: 24px;"><div class="tl-name" style="font-size: 16px;">Ângulo iSpindel</div><div class="tl-value" style="font-size: 24px;">42.5°</div></div>
              <div class="card" style="padding: 24px;"><div class="tl-name" style="font-size: 16px;">Temp iSpindel</div><div class="tl-value" style="font-size: 24px;">18.2°C</div></div>
              <div class="card" style="padding: 24px;"><div class="tl-name" style="font-size: 16px;">Sinal Wi-Fi</div><div class="tl-value" style="font-size: 24px;">-68 dBm</div></div>
            </div>
          </div>
"""

telemetria_p2 = """
          <!-- M2: TELEMETRIA P2 -->
          <div class="view" style="width: 50%;">
            <div class="page-top"><div><div class="page-title" style="margin: 0;">Telemetria (2/2)</div><div class="page-subtitle">Atuadores e Sistema</div></div></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
              <div class="card" style="padding: 32px; display: flex; align-items: center; justify-content: space-between; border-color: #4c1d28; background: #1a0f12;">
                <div><div class="card-title" style="color: #f43f5e;">RELÉ AQUECIMENTO</div><div class="tl-desc">Resistência</div></div>
                <div style="font-size: 40px; font-weight: 700; color: #f43f5e;">DESLIGADO</div>
              </div>
              <div class="card" style="padding: 32px; display: flex; align-items: center; justify-content: space-between; border-color: #1e3a8a; background: #0f172a;">
                <div><div class="card-title" style="color: #3b82f6;">RELÉ FRIO</div><div class="tl-desc">Compressor</div></div>
                <div style="font-size: 40px; font-weight: 700; color: #3b82f6;">LIGADO</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
              <div class="card" style="padding: 24px;"><div class="tl-name" style="font-size: 16px;">Sinal PWM</div><div class="tl-value" style="font-size: 24px;">0%</div></div>
              <div class="card" style="padding: 24px;"><div class="tl-name" style="font-size: 16px;">Uptime</div><div class="tl-value" style="font-size: 24px;">12h 45m</div></div>
              <div class="card" style="padding: 24px;"><div class="tl-name" style="font-size: 16px;">Carga CPU</div><div class="tl-value" style="font-size: 24px;">14%</div></div>
            </div>
          </div>
"""

for i in range(1, 7):
    app_id = app_ids[i]
    if i == 2:
        # Telemetry has 2 views
        apps_html += f"""
      <div class="app-container" id="{app_id}" style="display: none; height: 100%; position: relative;">
        <div class="views-wrapper" data-pages="2">
          <div class="views-track" style="width: 200%;">
{telemetria_p1}
{telemetria_p2}
          </div>
        </div>
        <div class="pagination"><div class="dot active"></div><div class="dot"></div></div>
      </div>
"""
    else:
        # 1 view apps
        content = views[i]
        # modify the .view to have width: 100% since it's the only one
        content = content.replace('<div class="view">', '<div class="view" style="width: 100%;">')
        apps_html += f"""
      <div class="app-container" id="{app_id}" style="display: none; height: 100%; position: relative;">
        <div class="views-wrapper" data-pages="1">
          <div class="views-track" style="width: 100%;">
            {content}
          </div>
        </div>
      </div>
"""

# Replace the old main-container with apps_html
old_container_pattern = re.compile(r'<div class="views-wrapper" id="main-container">.*?<!-- Spacer to force scroll past pagination dots -->\n            <div style="height: 100px; width: 100%; flex-shrink: 0;"></div>\n          </div>\n        </div>\n      </div>', re.DOTALL)

# Add spacer to apps that need scrolling (M5 Settings)
# Actually, the python replace above replaces the spacer.
# Let's add the spacer manually inside M5 in the apps_html.
apps_html = apps_html.replace('<!-- M5: CONFIGURAÇÕES -->', '<!-- M5: CONFIGURAÇÕES -->').replace('<!-- 1-WIRE -->', '<!-- 1-WIRE -->') # Just a check
apps_html = apps_html.replace('</div>\n      <div class="app-container" id="app-calculadoras"', '  <div style="height: 100px; width: 100%; flex-shrink: 0;"></div>\n          </div>\n      <div class="app-container" id="app-calculadoras"')

html = old_container_pattern.sub(apps_html, html)

# 3. Add generic Swipe logic
js_logic = """
    // =========================================
    // APPS LOGIC & SWIPING
    // =========================================
    let activeAppId = null;
    let activeTrack = null;
    let activeDots = null;
    let activeTotalPages = 1;
    let activePageIndex = 0;
    let startX = 0; let currentX = 0; let isDragging = false;

    function openApp(index) {
      document.getElementById('launcher-ui').style.display = 'none';
      document.getElementById('main-ui').style.display = 'flex';
      
      const appIds = ['app-dashboard', 'app-telemetria', 'app-rampas', 'app-historico', 'app-config', 'app-calculadoras'];
      
      // Hide all apps
      appIds.forEach(id => {
         const el = document.getElementById(id);
         if(el) el.style.display = 'none';
      });
      
      // Show selected app
      activeAppId = appIds[index];
      const appEl = document.getElementById(activeAppId);
      appEl.style.display = 'block';
      
      // Setup swiping context for this app
      const wrapper = appEl.querySelector('.views-wrapper');
      activeTrack = appEl.querySelector('.views-track');
      activeTotalPages = parseInt(wrapper.getAttribute('data-pages') || 1);
      activeDots = appEl.querySelectorAll('.dot');
      
      // Reset to page 0
      setAppPage(0);
    }
    
    function goHome() {
      document.getElementById('main-ui').style.display = 'none';
      document.getElementById('launcher-ui').style.display = 'flex';
    }

    function setAppPage(index) {
      if(!activeTrack || activeTotalPages <= 1) return;
      if (index < 0) index = 0;
      if (index >= activeTotalPages) index = activeTotalPages - 1;
      activePageIndex = index;
      
      const percent = activePageIndex * (100 / activeTotalPages);
      activeTrack.style.transform = `translateX(-${percent}%)`;
      if(activeDots) activeDots.forEach((dot, i) => dot.classList.toggle('active', i === activePageIndex));
    }

    // Bind swipe events globally, but they act on the active track
    window.addEventListener('mousedown', (e) => { 
       if(!activeTrack || activeTotalPages <= 1) return;
       startX = e.clientX; isDragging = true; 
    });
    window.addEventListener('mouseup', (e) => {
      if(!isDragging) return; isDragging = false; currentX = e.clientX;
      if (startX - currentX > 100) setAppPage(activePageIndex + 1); else if (currentX - startX > 100) setAppPage(activePageIndex - 1); 
    });
    window.addEventListener('touchstart', (e) => { 
       if(!activeTrack || activeTotalPages <= 1) return;
       startX = e.touches[0].clientX; isDragging = true; 
    }, {passive: true});
    window.addEventListener('touchend', (e) => {
      if(!isDragging) return; isDragging = false; currentX = e.changedTouches[0].clientX;
      if (startX - currentX > 100) setAppPage(activePageIndex + 1); else if (currentX - startX > 100) setAppPage(activePageIndex - 1);
    });
"""

# Replace old swiping logic
old_js_pattern = re.compile(r'// =========================================\n    // MAIN HMI LOGIC.*?function initMainDashboard\(\) {', re.DOTALL)
html = old_js_pattern.sub(js_logic + '\n    function initMainDashboard() {', html)

# Remove old #main-track CSS and add .app-container CSS
html = html.replace('/* Main UI specific */\n  #main-track { width: 600%; }\n  #main-track .view { width: calc(100% / 6); padding: 24px; padding-bottom: 60px; overflow-y: auto; }', '/* App Containers */\n  .app-container { flex: 1; overflow: hidden; }\n  .app-container .view { padding: 24px; overflow-y: auto; }')


with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Refactor successful!")
