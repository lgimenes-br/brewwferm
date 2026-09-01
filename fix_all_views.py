import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Replace all `<div class="view" style="...">` with a standard style
# Wait, some views have width: 100%, some have width: 50%, some have width: 20%.
# I need to preserve the width!

def replace_view(match):
    style_str = match.group(1)
    # Extract width
    width_match = re.search(r'width:\s*([^;]+);', style_str)
    if width_match:
        width = width_match.group(1).strip()
    else:
        width = "100%"
        
    return f'<div class="view" style="width: {width}; height: 100%; padding: 0 40px; box-sizing: border-box;">'

html = re.sub(r'<div class="view"\s+style="([^"]+)">', replace_view, html)
html = re.sub(r'<div class="view">', '<div class="view" style="width: 100%; height: 100%; padding: 0 40px; box-sizing: border-box;">', html)

# Let's ensure the content inside .view has height: 100% if it's the main container.
# The user wants the boxes to START at the green line and END at the red line.
# If they are flex containers with `height: 100%`, they will stretch to the bounds.
# Wait, for Telemetria P1 and P2:
# They have `<div style="display: flex; flex-direction: column; height: 100%; gap: 24px;">`
# That's perfect.

# Let's fix the pagination so it's a fixed height block at the bottom
html = html.replace('style="position: relative; height: 50px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"', 'style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"')
html = html.replace('style="height: 50px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"', 'style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("All views standardized!")
