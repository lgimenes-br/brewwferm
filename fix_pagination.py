with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Fix pagination position
html = html.replace('style="height: 50px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"', 'style="position: relative; height: 50px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;"')

# Decrease font sizes in Dashboard P1 to prevent overflow
html = html.replace('font-size: 80px;', 'font-size: 64px;')
html = html.replace('font-size: 40px;', 'font-size: 32px;')

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
print("Pagination and fonts fixed!")
