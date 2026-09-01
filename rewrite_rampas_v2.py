import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start = html.find('<div class="app-container" id="app-rampas"')
end = html.find('<div class="app-container" id="app-historico"')

old_rampas = html[start:end]

metadata_bar = """<div style="display: flex; align-items: center; gap: 40px; margin-bottom: 24px;">
              <div style="background: #222; padding: 12px 24px; border-radius: 12px; font-weight: 700; color: #FFF; font-size: 24px; letter-spacing: 1px;">IPA</div>
              <div style="display: flex; align-items: baseline; gap: 12px;"><div style="color: #666; font-weight: 700; font-size: 16px; letter-spacing: 2px;">VOL</div><div style="color: #FFF; font-weight: 700; font-size: 28px;">20L</div></div>
              <div style="display: flex; align-items: baseline; gap: 12px;"><div style="color: #666; font-weight: 700; font-size: 16px; letter-spacing: 2px;">OG</div><div style="color: #FFF; font-weight: 700; font-size: 28px;">1.050</div></div>
              <div style="display: flex; align-items: baseline; gap: 12px;"><div style="color: #666; font-weight: 700; font-size: 16px; letter-spacing: 2px;">FG</div><div style="color: #FFF; font-weight: 700; font-size: 28px;">1.010</div></div>
            </div>"""

new_rampas = f"""<div class="app-container" id="app-rampas" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="3" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 300%; display: flex; height: 100%; transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);">
            
            <!-- RAMPAS VIEW 1: METADATA & TIMELINE -->
            <div class="view" style="width: 33.333%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div class="card" style="flex: 1; min-height: 0; padding: 40px; display: flex; flex-direction: column;">
                {metadata_bar}
                <hr style="border: 0; border-top: 1px solid #222; margin: 0 0 32px 0; width: 100%;">
                
                <div class="card-title" style="margin-bottom: 32px; font-size: 16px; color: #888; letter-spacing: 2px;">PERFIL ATIVO</div>
                
                <div class="timeline" style="flex: 1; overflow-y: auto; padding-left: 12px; margin-left: 12px;">
                  <div class="tl-line" style="left: 23px;"></div>
                  <div class="tl-item completed" style="margin-bottom: 32px;"><div class="tl-dot" style="width: 24px; height: 24px; left: -12px;"></div><div class="tl-content" style="padding-left: 40px;"><div class="tl-name" style="font-size: 24px;">Fermentação Primária</div><div class="tl-desc" style="font-size: 18px; margin-top: 8px;">19.0°C &nbsp; 4 Dias</div></div></div>
                  <div class="tl-item active" style="margin-bottom: 32px;"><div class="tl-dot" style="width: 24px; height: 24px; left: -12px;"></div><div class="tl-content" style="padding-left: 40px;"><div class="tl-name" style="color: var(--text-primary); font-size: 24px;">Dry Hop 1</div><div class="tl-desc" style="color: var(--text-primary); font-size: 18px; margin-top: 8px;">19.0°C &nbsp; 3 Dias (Dia 2)</div></div></div>
                  <div class="tl-item pending" style="margin-bottom: 0;"><div class="tl-dot" style="width: 24px; height: 24px; left: -12px;"></div><div class="tl-content" style="padding-left: 40px;"><div class="tl-name" style="font-size: 24px;">Descanso Diacetil</div><div class="tl-desc" style="font-size: 18px; margin-top: 8px;">22.0°C &nbsp; 2 Dias</div></div></div>
                </div>
              </div>
            </div>

            <!-- RAMPAS VIEW 2: DETAILS & CONTROLS -->
            <div class="view" style="width: 33.333%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div class="card" style="flex: 1; min-height: 0; padding: 40px; display: flex; flex-direction: column;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
                  <div style="font-size: 16px; font-weight: 700; color: #888; letter-spacing: 2px;">PERFIL DE FERMENTAÇÃO</div>
                  <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:#888;fill:none;stroke-width:2;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </div>

                {metadata_bar}
                
                <hr style="border: 0; border-top: 1px solid #222; margin: 0 0 32px 0; width: 100%;">
                
                <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; padding-right: 16px;">
                  
                  <!-- Step 1 -->
                  <div style="display: flex; align-items: center; padding: 24px; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 16px; gap: 24px; position: relative;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; border: 1px solid #333; background: #111; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #555; font-weight: 700; position: relative; z-index: 1;">1</div>
                    <div style="position: absolute; bottom: -16px; left: 48px; width: 1px; height: 16px; background: #333; z-index: 0;"></div>
                    <div style="flex: 1;">
                      <div style="font-size: 20px; font-weight: 700; color: #555; margin-bottom: 8px;">Fermentação P</div>
                      <div style="display: flex; gap: 16px; color: #444; font-size: 16px; font-weight: 500;">
                        <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg> 18°C</div>
                        <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 3d</div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Step 2 ACTIVE -->
                  <div style="display: flex; align-items: center; padding: 24px; background: #151515; border: 1px solid #333; border-radius: 16px; gap: 24px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                    <div style="width: 48px; height: 48px; border-radius: 50%; background: #FFF; display: flex; align-items: center; justify-content: center; color: #000; position: relative; z-index: 1;">
                      <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
                    </div>
                    <div style="position: absolute; top: -16px; left: 48px; width: 1px; height: 16px; background: #333; z-index: 0;"></div>
                    <div style="position: absolute; bottom: -16px; left: 48px; width: 1px; height: 16px; background: #333; z-index: 0;"></div>
                    <div style="flex: 1;">
                      <div style="font-size: 20px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Cold Crash</div>
                      <div style="display: flex; gap: 16px; color: #AAA; font-size: 16px; font-weight: 500;">
                        <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg> 2°C</div>
                        <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 3d</div>
                      </div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 14px; font-weight: 900; color: #FFF; letter-spacing: 2px; margin-bottom: 4px;">ATIVO</div>
                      <div style="font-size: 16px; color: #AAA; font-weight: 500;">0s</div>
                    </div>
                  </div>
                  
                  <!-- Step 3 -->
                  <div style="display: flex; align-items: center; padding: 24px; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 16px; gap: 24px; position: relative;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; border: 1px solid #333; background: #111; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #888; font-weight: 700; position: relative; z-index: 1;">3</div>
                    <div style="position: absolute; top: -16px; left: 48px; width: 1px; height: 16px; background: #333; z-index: 0;"></div>
                    <div style="flex: 1;">
                      <div style="font-size: 20px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Maturacao</div>
                      <div style="display: flex; gap: 16px; color: #AAA; font-size: 16px; font-weight: 500;">
                        <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg> 10°C</div>
                        <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 1d</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #222; margin: 0 0 32px 0; width: 100%;">
                
                <!-- Controls -->
                <div style="display: flex; gap: 16px; height: 90px; flex-shrink: 0;">
                  <button style="flex: 1; background: #222; border: 1px solid #333; border-radius: 16px; color: #FFF; font-weight: 700; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
                    <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    PAUSAR
                  </button>
                  <button style="flex: 1; background: #222; border: 1px solid #333; border-radius: 16px; color: #FFF; font-weight: 700; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
                    <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                    ANTERIOR
                  </button>
                  <button style="flex: 1; background: #222; border: 1px solid #333; border-radius: 16px; color: #FFF; font-weight: 700; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
                    <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                    PRÓXIMA
                  </button>
                  <button style="flex: 1; background: #3a1111; border: 1px solid #ff4444; border-radius: 16px; color: #ff4444; font-weight: 700; font-size: 14px; letter-spacing: 1px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer;">
                    <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:#ff4444;stroke-width:0;"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                    FINALIZAR
                  </button>
                </div>

              </div>
            </div>

            <!-- RAMPAS VIEW 3: LOGS -->
            <div class="view" style="width: 33.333%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div class="card" style="flex: 1; min-height: 0; padding: 40px; display: flex; flex-direction: column;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;">
                  <div style="font-size: 16px; font-weight: 700; color: #888; letter-spacing: 2px; display: flex; align-items: center; gap: 12px;">
                    <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M3 15v4c0 1.1.9 2 2 2h14"></path></svg>
                    DIÁRIO DE BORDO
                  </div>
                  <button style="background: #222; border: 1px solid #333; border-radius: 20px; color: #FFF; font-weight: 700; font-size: 14px; letter-spacing: 2px; padding: 12px 24px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:3;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> ADICIONAR
                  </button>
                </div>

                <div style="flex: 1; overflow-y: auto; position: relative; padding-left: 20px; padding-right: 16px;">
                  <div style="position: absolute; top: 20px; bottom: 0; left: 28px; width: 1px; background: #333; z-index: 0;"></div>
                  
                  <!-- Log 1 -->
                  <div style="display: flex; gap: 32px; margin-bottom: 24px; position: relative; z-index: 1;">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #666; border: 4px solid #1a1a1a; margin-top: 32px; flex-shrink: 0;"></div>
                    <div style="flex: 1; background: #111; border: 1px solid #222; border-radius: 16px; padding: 24px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="background: #000; padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #FFF; letter-spacing: 1px;">SISTEMA</div>
                        <div style="color: #666; font-size: 14px; display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> 07/15 às 06:51 PM</div>
                      </div>
                      <div style="font-size: 20px; color: #CCC; font-weight: 500;">Lote iniciado.</div>
                    </div>
                  </div>
                  
                  <!-- Log 2 -->
                  <div style="display: flex; gap: 32px; margin-bottom: 24px; position: relative; z-index: 1;">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #a855f7; border: 4px solid #1a1a1a; margin-top: 32px; flex-shrink: 0; box-shadow: 0 0 10px #a855f7;"></div>
                    <div style="flex: 1; background: #111; border: 1px solid #222; border-radius: 16px; padding: 24px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="background: #000; padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #FFF; letter-spacing: 1px;">SYSTEM_ACTION</div>
                        <div style="color: #666; font-size: 14px; display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> 07/18 às 06:52 PM</div>
                      </div>
                      <div style="font-size: 20px; color: #CCC; font-weight: 500;">Avançou automaticamente para a etapa: Maturação (2°C)</div>
                    </div>
                  </div>
                  
                  <!-- Log 3 -->
                  <div style="display: flex; gap: 32px; margin-bottom: 24px; position: relative; z-index: 1;">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: #a855f7; border: 4px solid #1a1a1a; margin-top: 32px; flex-shrink: 0; box-shadow: 0 0 10px #a855f7;"></div>
                    <div style="flex: 1; background: #111; border: 1px solid #222; border-radius: 16px; padding: 24px; position: relative;">
                      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#666;fill:none;stroke-width:2;position:absolute;top:30px;right:24px;cursor:pointer;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="background: #000; padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; color: #FFF; letter-spacing: 1px;">SYSTEM_ACTION</div>
                        <div style="color: #666; font-size: 14px; display: flex; align-items: center; gap: 8px; margin-right: 40px;"><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> 07/22 às 12:22 PM</div>
                      </div>
                      <div style="font-size: 20px; color: #CCC; font-weight: 500;">Avançou automaticamente para a etapa: Etapa 3 (10°C)</div>
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="pagination" style="height: 60px; display: flex; align-items: center; justify-content: center; gap: 12px; flex-shrink: 0;">
          <div class="dot active"></div><div class="dot"></div><div class="dot"></div>
        </div>
      </div>\n\n"""

html = html.replace(old_rampas, new_rampas)

with open("public/7inch-launcher.html", "w") as f:
    f.write(html)
