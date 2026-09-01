with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start_idx = html.find('<!-- HEADER -->')
end_idx = html.find('<!-- MAIN VIEWS SWIPE -->', start_idx)

# Use class "launcher-header" to inherit the flex properties, but override margin to 40px all around
new_header = """
      <!-- HEADER -->
      <div class="launcher-header" style="margin: 40px; background: var(--bg-base); z-index: 10;">
        <div class="logo-container hdr-logo">
          <div class="logo-text">BREW</div>
          <div class="logo-w-container"><div class="logo-text">W</div><div class="logo-w-accent"></div></div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 24px;">
          <div id="main-clock" style="font-size: 20px; font-weight: 700; color: #555;">21/08/26 12:40</div>
          <div class="home-btn" onclick="goHome()" style="background: #1A1A1A; border: 1px solid #333; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; box-sizing: border-box;">
            <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:#FFF;fill:none;stroke-width:3;"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </div>
          <div style="border: 1px solid #10b981; border-radius: 8px; padding: 8px 16px; display: flex; align-items: center; gap: 10px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></div>
            <div style="color: #10b981; font-size: 16px; font-weight: 700; letter-spacing: 2px;">ONLINE</div>
          </div>
        </div>
      </div>

      """

html = html[:start_idx] + new_header + html[end_idx:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Header Height Fixed!")
