with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Fix Step 1
old_s1 = '<div class="card" style="display: flex; align-items: center; padding: 24px 32px; gap: 32px; position: relative; border-radius: 24px; background: #111;">'
new_s1 = '<div class="card" style="display: flex; flex-direction: row; align-items: center; padding: 16px 24px; gap: 24px; position: relative; border-radius: 20px; background: #111;">'
html = html.replace(old_s1, new_s1)

# Fix Step 2
old_s2 = '<div class="card" style="display: flex; align-items: center; padding: 24px 32px; border: 1px solid #444; gap: 32px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border-radius: 24px; background: #151515;">'
new_s2 = '<div class="card" style="display: flex; flex-direction: row; align-items: center; padding: 16px 24px; border: 1px solid #444; gap: 24px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border-radius: 20px; background: #151515;">'
html = html.replace(old_s2, new_s2)

# Fix Step 3
old_s3 = '<div class="card" style="display: flex; align-items: center; padding: 24px 32px; gap: 32px; position: relative; border-radius: 24px; background: #111;">'
new_s3 = '<div class="card" style="display: flex; flex-direction: row; align-items: center; padding: 16px 24px; gap: 24px; position: relative; border-radius: 20px; background: #111;">'
html = html.replace(old_s3, new_s3)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
