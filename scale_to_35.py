import re

with open('public/3.5inch-launcher.html', 'r') as f:
    html = f.read()

# Replace the title
html = html.replace('1024x600', '480x320 scaled')

# Find the .screen CSS
screen_css_pattern = r'\.screen\s*\{[^}]*\}'
def repl_screen(m):
    # We want width: 1024px; height: 682px; transform: scale(0.46875); transform-origin: 0 0;
    return ".screen { width: 1024px; height: 682px; background-color: var(--bg-base); display: flex; flex-direction: column; color: var(--text-primary); overflow: hidden; position: relative; border: 1px solid var(--border-color); transform: scale(0.46875); transform-origin: 0 0; }"

html = re.sub(screen_css_pattern, repl_screen, html)

# Replace body to not have center justification because scale changes layout box
body_pattern = r'body\s*\{[^}]*\}'
def repl_body(m):
    return "body { background-color: #222; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Inter', sans-serif; user-select: none; -webkit-font-smoothing: antialiased; margin: 0; }"

html = re.sub(body_pattern, repl_body, html)

# Wrap .screen inside a physical hardware box for the browser to show exactly what it will look like
# Wait, the browser will center .screen if it's in a flex body. 
# But .screen has transformed size. The browser still reserves 1024x682 for it in flow layout.
# So it's better to wrap it in a div of 480x320.
html = html.replace('<div class="screen">', '<div style="width: 480px; height: 320px; box-shadow: 0 0 20px rgba(0,0,0,0.5);"><div class="screen">')
html = html.replace('<!-- ================= SCRIPT ================= -->', '</div>\n<!-- ================= SCRIPT ================= -->')

with open('public/3.5inch-launcher.html', 'w') as f:
    f.write(html)

print("Scaling done!")
