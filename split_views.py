import re

with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Split by <div class="view">
parts = html.split('<div class="view">')
# parts[0] is everything before the first view (which is wizard M1, M2, M3, M4, M5, wait!)
# The Wizard ALSO uses <div class="view">!
# We should only extract the main track views.
