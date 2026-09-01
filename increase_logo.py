import re

html_str = ""
with open("public/7inch-launcher.html", "r") as f:
    html_str = f.read()

old_css = """  .hdr-logo .logo-text { font-size: 28px; }
  .hdr-logo .logo-w-accent { right: -6px; width: 10px; height: 6px; }"""

new_css = """  .hdr-logo .logo-text { font-size: 42px; }
  .hdr-logo .logo-w-accent { right: -8px; width: 14px; height: 8px; border-top-right-radius: 3px; }"""

if old_css in html_str:
    html_str = html_str.replace(old_css, new_css)
else:
    print("CSS not found")

with open("public/7inch-launcher.html", "w") as f:
    f.write(html_str)
