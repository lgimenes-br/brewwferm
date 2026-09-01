import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start = html.find('<div class="app-container" id="app-rampas"')
end = html.find('<div class="app-container" id="app-historico"')

old_rampas = html[start:end]

new_rampas = """<div class="app-container" id="app-rampas" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="2" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 200%; display: flex; height: 100%; transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);">
            
            <!-- RAMPAS VIEW 1: TIMELINE -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div class="page-top" style="flex-shrink: 0; margin-bottom: 24px;">
                <div><div class="page-title" style="margin: 0;">Rampas de Fermentação</div><div class="page-subtitle">LOTE ATUAL - NEIPA TROPICAL</div></div>
              </div>
              <div class="card" style="flex: 1; min-height: 0; padding: 40px; display: flex; flex-direction: column;">
                <div class="card-title" style="margin-bottom: 32px; font-size: 24px;">PERFIL ATIVO</div>
                <div class="timeline" style="flex: 1; overflow-y: auto; padding-left: 12px; margin-left: 12px;">
                  <div class="tl-line" style="left: 23px;"></div>
                  <div class="tl-item completed" style="margin-bottom: 32px;"><div class="tl-dot" style="width: 24px; height: 24px; left: -12px;"></div><div class="tl-content" style="padding-left: 40px;"><div class="tl-name" style="font-size: 24px;">Fermentação Primária</div><div class="tl-desc" style="font-size: 18px; margin-top: 8px;">19.0°C &nbsp; 4 Dias</div></div></div>
                  <div class="tl-item active" style="margin-bottom: 32px;"><div class="tl-dot" style="width: 24px; height: 24px; left: -12px;"></div><div class="tl-content" style="padding-left: 40px;"><div class="tl-name" style="color: var(--text-primary); font-size: 24px;">Dry Hop 1</div><div class="tl-desc" style="color: var(--text-primary); font-size: 18px; margin-top: 8px;">19.0°C &nbsp; 3 Dias (Dia 2)</div></div></div>
                  <div class="tl-item pending" style="margin-bottom: 0;"><div class="tl-dot" style="width: 24px; height: 24px; left: -12px;"></div><div class="tl-content" style="padding-left: 40px;"><div class="tl-name" style="font-size: 24px;">Descanso Diacetil</div><div class="tl-desc" style="font-size: 18px; margin-top: 8px;">22.0°C &nbsp; 2 Dias</div></div></div>
                </div>
              </div>
            </div>

            <!-- RAMPAS VIEW 2: DETAILS -->
            <div class="view" style="width: 50%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div class="page-top" style="flex-shrink: 0; margin-bottom: 24px;">
                <div><div class="page-title" style="margin: 0;">Etapas Detalhadas</div></div>
                <button class="btn-header"><svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:3;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>NOVA ETAPA</button>
              </div>
              <div class="steps-list" style="flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; padding-bottom: 24px; margin: 0;">
                <div class="step-card completed" style="padding: 32px; border-radius: 16px;"><div class="step-num" style="width: 48px; height: 48px; font-size: 20px;">1</div><div class="step-info"><div class="step-title" style="font-size: 24px;">Fermentação Primária</div><div class="step-status" style="font-size: 16px; margin-top: 8px;">CONCLUÍDA</div></div><div class="step-metrics"><div class="step-metric"><div class="metric-lbl" style="font-size: 14px;">ALVO</div><div class="metric-val" style="font-size: 28px;">19.0<span class="metric-unit">°C</span></div></div><div class="step-metric"><div class="metric-lbl" style="font-size: 14px;">DURAÇÃO</div><div class="metric-val" style="font-size: 28px;">4<span class="metric-unit">d</span></div></div></div></div>
                
                <div class="step-card active" style="padding: 32px; border-radius: 16px;"><div class="step-num" style="width: 48px; height: 48px; font-size: 20px;">2</div><div class="step-info"><div class="step-title" style="font-size: 24px;">Dry Hop 1</div><div class="step-status" style="font-size: 16px; margin-top: 8px;"><div class="status-led"></div> ATIVA - DIA 2/3</div></div><div class="step-metrics"><div class="step-metric"><div class="metric-lbl" style="font-size: 14px;">ALVO</div><div class="metric-val" style="font-size: 28px;">19.0<span class="metric-unit">°C</span></div></div><div class="step-metric"><div class="metric-lbl" style="font-size: 14px;">DURAÇÃO</div><div class="metric-val" style="font-size: 28px;">3<span class="metric-unit">d</span></div></div></div></div>
                
                <div class="step-card pending" style="padding: 32px; border-radius: 16px;"><div class="step-num" style="width: 48px; height: 48px; font-size: 20px;">3</div><div class="step-info"><div class="step-title" style="font-size: 24px;">Descanso Diacetil</div><div class="step-status" style="font-size: 16px; margin-top: 8px;">PENDENTE</div></div><div class="step-metrics"><div class="step-metric"><div class="metric-lbl" style="font-size: 14px;">ALVO</div><div class="metric-val" style="font-size: 28px;">22.0<span class="metric-unit">°C</span></div></div><div class="step-metric"><div class="metric-lbl" style="font-size: 14px;">DURAÇÃO</div><div class="metric-val" style="font-size: 28px;">2<span class="metric-unit">d</span></div></div></div></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;">
          <div class="dot active"></div><div class="dot"></div>
        </div>
      </div>\n\n"""

html = html.replace(old_rampas, new_rampas)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
