import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Replace the #main-ui header completely
new_main_header = """
      <!-- HEADER -->
      <div class="header" style="display: flex; justify-content: space-between; align-items: center; padding: 40px 40px 40px 40px; margin: 0; background: var(--bg-base); z-index: 10;">
        <div class="logo-container hdr-logo">
          <div class="logo-text">BREW</div>
          <div class="logo-w-container"><div class="logo-text">W</div><div class="logo-w-accent"></div></div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 24px;">
          <div id="main-clock" style="font-size: 20px; font-weight: 700; color: #555;">21/08/26 12:40</div>
          <div style="border: 1px solid #10b981; border-radius: 8px; padding: 8px 16px; display: flex; align-items: center; gap: 10px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></div>
            <div style="color: #10b981; font-size: 16px; font-weight: 700; letter-spacing: 2px;">ONLINE</div>
          </div>
          <div class="home-btn" onclick="goHome()" style="background: #1A1A1A; border: 1px solid #333; padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; box-sizing: border-box;">
            <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:#FFF;fill:none;stroke-width:3;"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </div>
        </div>
      </div>
"""

# Regex to match the current header in #main-ui
header_pattern = re.compile(r'<!-- HEADER -->.*?</div>\s*</div>\s*</div>', re.DOTALL)

# But wait, what does the current header look like? 
# "      <!-- HEADER -->\n      <div class="header" style="justify-content: space-between; align-items: center; padding: 24px 40px; margin: 0; background: var(--bg-base); z-index: 10;">...</div>"
html = header_pattern.sub(new_main_header.strip(), html)


# Also ensure #launcher-ui header matches exactly the same padding visually
# #launcher-ui has padding: 40px;
# .launcher-header has margin-bottom: 40px;
# If #launcher-ui has padding: 40px, the .launcher-header is 40px from top and 40px from left.
# #main-ui does NOT have padding. Its .header now has padding: 40px. 
# But wait, in #main-ui, does the content after .header need padding-left/right 40px?
# No, .view has padding: 24px!
# Wait! In the launcher, the .launcher-grid has padding?
# Let's check #launcher-ui padding.
