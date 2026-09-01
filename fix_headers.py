import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# 1. Update updateClock() to update both clocks
clock_js = """
    function updateClock() {
      const now = new Date();
      const dd = now.getDate().toString().padStart(2, '0');
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const yy = now.getFullYear().toString().slice(-2);
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const timeStr = `${dd}/${mm}/${yy} ${hours}:${minutes}`;
      
      const clockEl1 = document.getElementById('launcher-clock');
      if(clockEl1) clockEl1.innerText = timeStr;
      
      const clockEl2 = document.getElementById('main-clock');
      if(clockEl2) clockEl2.innerText = timeStr;
    }
"""
html = re.sub(r'    function updateClock\(\) \{.*?    \}', clock_js.strip(), html, flags=re.DOTALL)


# 2. Replace #main-ui header
new_main_header = """
      <!-- HEADER -->
      <div class="header" style="justify-content: space-between; align-items: center; padding: 24px 40px; margin: 0; background: var(--bg-base); z-index: 10;">
        <div style="display: flex; align-items: center; gap: 24px;">
          <div class="home-btn" onclick="goHome()" style="background: #1A1A1A; border: 1px solid #333; padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:#FFF;fill:none;stroke-width:3;"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </div>
          <div class="logo-container hdr-logo">
            <div class="logo-text">BREW</div>
            <div class="logo-w-container"><div class="logo-text">W</div><div class="logo-w-accent"></div></div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 24px;">
          <div id="main-clock" style="font-size: 20px; font-weight: 700; color: #555;">21/08/26 12:40</div>
          <div style="border: 1px solid #10b981; border-radius: 8px; padding: 8px 16px; display: flex; align-items: center; gap: 10px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></div>
            <div style="color: #10b981; font-size: 16px; font-weight: 700; letter-spacing: 2px;">ONLINE</div>
          </div>
        </div>
      </div>
"""

old_header_pattern = re.compile(r'<!-- HEADER -->\n      <div class="header">.*?</div>\n      </div>', re.DOTALL)
html = old_header_pattern.sub(new_main_header.strip(), html)

# The original .header had padding: 32px 40px 16px 40px; I replaced it inline but let's just make sure we don't double dip padding.
# Since it's replacing the inner HTML of #main-ui, it's fine.

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Headers synced!")
