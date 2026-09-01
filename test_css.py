import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

css = re.search(r'<style>(.*?)</style>', html, re.DOTALL).group(1)
print("CSS braces balance:", css.count('{') - css.count('}'))
