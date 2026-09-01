import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# 1. Remove duplicate openApp
html = re.sub(r'function openApp\(index\)\s*\{\s*document\.getElementById\(\'launcher-ui\'\)\.style\.display\s*=\s*\'none\';\s*document\.getElementById\(\'main-ui\'\)\.style\.display\s*=\s*\'flex\';\s*setMainView\(index\);\s*\}\n\s*', '', html)

# 2. Change targetApp.style.display = 'block' to 'flex'
html = html.replace("targetApp.style.display = 'block'", "targetApp.style.display = 'flex'")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
