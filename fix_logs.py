with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

# Make sure app-historico has the correct margin setup
old_hist = """<div class="card" style="padding: 0; overflow: hidden;">"""
new_hist = """<div style="padding-bottom: 40px;"><div class="card" style="padding: 0; overflow: hidden;">"""

if old_hist in html:
    html = html.replace(old_hist, new_hist)

# close the div
old_hist_close = """              </table>
            </div>
          </div>"""
new_hist_close = """              </table>
            </div>
            </div>
          </div>"""
if old_hist_close in html:
    html = html.replace(old_hist_close, new_hist_close)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
