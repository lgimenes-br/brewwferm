with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

div_starts = html.count('<div')
div_ends = html.count('</div')
print(f"<div count: {div_starts}")
print(f"</div count: {div_ends}")
