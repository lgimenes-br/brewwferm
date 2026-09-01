import re

html_str = ""
with open("public/7inch-launcher.html", "r") as f:
    html_str = f.read()

# 1. Update goHome function
old_gohome = """    function goHome() {
      document.getElementById('main-ui').style.display = 'none';
      document.getElementById('launcher-ui').style.display = 'flex';
    }"""

new_gohome = """    function goHome() {
      // Intercept if inside a calculator detail
      if (activeAppId === 'app-calculadoras') {
        const calcMenu = document.getElementById('calc-menu');
        if (calcMenu && calcMenu.style.display === 'none') {
          const calcs = ['calc-brix', 'calc-abv', 'calc-carb', 'calc-yeast', 'calc-dens', 'calc-temp'];
          calcs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          });
          calcMenu.style.display = 'grid';
          return; // Stop execution
        }
      }

      document.getElementById('main-ui').style.display = 'none';
      document.getElementById('launcher-ui').style.display = 'flex';
    }"""

if old_gohome in html_str:
    html_str = html_str.replace(old_gohome, new_gohome)
else:
    print("goHome not found")

# 2. Remove the local title/voltar block from all 6 calculators
# They look like this:
# <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
#   <div style="font-size: 20px; font-weight: 700; color: #FFF; letter-spacing: 1px;">...</div>
#   <div class="btn-set primary" onclick="document.getElementById('calc-...').style.display='none'; document.getElementById('calc-menu').style.display='grid';" style="padding: 12px 24px; font-size: 14px;">
#     <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg> VOLTAR
#   </div>
# </div>

pattern = r'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">\s*<div style="font-size: 20px; font-weight: 700; color: #FFF; letter-spacing: 1px;">.*?</div>\s*<div class="btn-set primary" onclick="document\.getElementById\(\'calc-.*?\'\)\.style\.display=\'none\'; document\.getElementById\(\'calc-menu\'\)\.style\.display=\'grid\';" style="padding: 12px 24px; font-size: 14px;">\s*<svg.*?>.*?</svg> VOLTAR\s*</div>\s*</div>'

html_str = re.sub(pattern, '', html_str)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html_str)
