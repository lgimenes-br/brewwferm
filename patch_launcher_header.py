with open("public/7inch-launcher.html", "r") as f:
    content = f.read()

# Replace Olá Cervejeiro
logo_html = """
        <div class="logo-container hdr-logo">
          <div class="logo-text">BREW</div>
          <div class="logo-w-container"><div class="logo-text">W</div><div class="logo-w-accent"></div></div>
        </div>
"""
content = content.replace('<div>\n          <div style="font-size: 28px; font-weight: 600; letter-spacing: -1px;">Olá, Cervejeiro</div>\n\n        </div>', logo_html.strip())

# Add ID to time
content = content.replace('<div style="font-size: 20px; font-weight: 700; color: #555;">12:40</div>', '<div id="launcher-clock" style="font-size: 20px; font-weight: 700; color: #555;">Qua, 12:40</div>')

# Add JS to update the clock
js_clock = """
    function updateClock() {
      const now = new Date();
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const day = days[now.getDay()];
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const clockEl = document.getElementById('launcher-clock');
      if(clockEl) clockEl.innerText = `${day}, ${hours}:${minutes}`;
    }
    setInterval(updateClock, 1000);
    updateClock();
    
    // =========================================
    // WIZARD LOGIC
"""
content = content.replace('    // =========================================\n    // WIZARD LOGIC', js_clock)

with open("public/7inch-launcher.html", "w") as f:
    f.write(content)
