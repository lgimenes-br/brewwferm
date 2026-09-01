with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start_idx = html.find('<div class="views-wrapper" id="main-container">')
end_idx = html.find('<!-- PAGINATION DOTS -->', start_idx)
if end_idx == -1:
    end_idx = html.find('</div>\n    </div>\n  </div>', start_idx)

main_block = html[start_idx:end_idx]

# Split main_block by <!-- M
m_blocks = main_block.split('<!-- M')
# m_blocks[1] is 1: DASHBOARD
# m_blocks[2] is 2: TELEMETRIA
# m_blocks[3] is 3: RAMPAS
# m_blocks[4] is 3: HISTÓRICO
# m_blocks[5] is 5: CONFIGURAÇÕES
# m_blocks[6] is 6: CALCULADORAS

views = {}
for i in range(1, len(m_blocks)):
    block = m_blocks[i]
    # Reattach <!-- M
    block = '<!-- M' + block
    
    # Clean up the end (remove closing tags of the track if it's the last one)
    if '<!-- Spacer to force scroll' in block:
        block = block.split('<!-- Spacer to force scroll')[0]
        
    views[i] = block

import pprint
for k in views.keys():
    print(k, views[k][:50])

