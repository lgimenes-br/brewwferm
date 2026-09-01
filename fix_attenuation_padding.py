import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

html = html.replace('<div class="view" style="width: 20%; height: 100%; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0;">',
                    '<div class="view" style="width: 20%; height: 100%; padding: 0 40px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0;">')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
