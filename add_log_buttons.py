with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

old_html = """<div style="padding-bottom: 40px;"><div class="card" style="padding: 0; overflow: hidden;">"""

new_html = """<div style="padding-bottom: 40px;">
              <div style="display: flex; justify-content: flex-end; gap: 16px; margin-bottom: 24px;">
                <div class="btn-set primary" style="padding: 12px 24px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> EXPORTAR LOGS
                </div>
                <div class="btn-set danger" style="padding: 12px 24px; font-size: 14px;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;margin-right:8px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> LIMPAR LOGS
                </div>
              </div>
              <div class="card" style="padding: 0; overflow: hidden;">"""

if old_html in html:
    html = html.replace(old_html, new_html)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
