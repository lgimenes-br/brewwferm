import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# We need to find the wizard-track and remove inline styles from its views.
start = html.find('<div class="views-track" id="wizard-track">')
end = html.find('<!-- WIZARD KEYBOARD MODAL -->')

wizard_html = html[start:end]
wizard_html = re.sub(r'<div class="view"\s+style="[^"]+">', '<div class="view">', wizard_html)

html = html[:start] + wizard_html + html[end:]

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
