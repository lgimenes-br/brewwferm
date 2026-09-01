with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# 1. Remove position: absolute from .pagination in CSS
html = html.replace('.pagination { position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: center; gap: 12px; z-index: 20; pointer-events: none; }', 
                    '.pagination { display: flex; justify-content: center; gap: 12px; z-index: 20; pointer-events: none; }')

# 2. Fix the header margin in #main-ui to have less bottom margin
html = html.replace('<div class="launcher-header" style="margin: 40px; background: var(--bg-base); z-index: 10;">', 
                    '<div class="launcher-header" style="margin: 32px 40px 16px 40px; background: var(--bg-base); z-index: 10; flex-shrink: 0;">')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
