import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# I will find all instances of style="width: XX%; height: 100%; padding: 0 40px; box-sizing: border-box;" 
# and replace with style="width: XX%;" OR style="width: XX%; padding: 24px;"
# Let's just remove the height, padding, and box-sizing from ALL views inline styles, 
# and let the CSS handle it, EXCEPT for the width.

def replace_view(match):
    style_str = match.group(1)
    width_match = re.search(r'width:\s*([^;]+);', style_str)
    if width_match:
        width = width_match.group(1).strip()
    else:
        width = "100%"
        
    return f'<div class="view" style="width: {width}; padding: 24px;">'

html = re.sub(r'<div class="view"\s+style="([^"]+)">', replace_view, html)

# For Dashboard P2 (Attenuation), we had custom flex:
html = html.replace('<div class="view" style="width: 20%; padding: 24px;">\n            <div class="card" style="width: 90%; max-width: 900px; padding: 48px; padding-bottom: 72px;', 
                    '<div class="view" style="width: 20%; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0;">\n            <div class="card" style="width: 90%; max-width: 900px; padding: 48px; padding-bottom: 72px;')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
