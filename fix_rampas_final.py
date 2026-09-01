import re
with open("public/7inch-launcher.html", "r") as f:
    html = f.read()

start = html.find('<div class="app-container" id="app-rampas"')
end = html.find('<div class="app-container" id="app-historico"')
old_rampas = html[start:end]

new_rampas = """<div class="app-container" id="app-rampas" style="display: none; position: relative;">
        <div class="views-wrapper" data-pages="3" style="flex: 1; min-height: 0; overflow: hidden;">
          <div class="views-track" style="width: 300%; display: flex; height: 100%; transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);">
            
            <!-- RAMPAS VIEW 1: METADATA GRID -->
            <div class="view" style="width: 33.333%; padding: 0 40px; box-sizing: border-box; height: 100%;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 24px; height: 100%;">
                <div class="card" style="display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 32px; background: #111;">
                  <div style="background: #222; padding: 12px 32px; border-radius: 16px; font-weight: 900; color: #FFF; font-size: 32px; letter-spacing: 2px;">IPA</div>
                  <div style="font-size: 16px; color: #666; letter-spacing: 3px; margin-top: 16px; font-weight: 700;">ESTILO DA RECEITA</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 32px; background: #111;">
                  <div style="font-size: 64px; font-weight: 700; color: #FFF;">20<span style="font-size: 32px; color: #666; margin-left: 4px;">L</span></div>
                  <div style="font-size: 16px; color: #666; letter-spacing: 3px; margin-top: 8px; font-weight: 700;">VOLUME ESPERADO</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 32px; background: #111;">
                  <div style="font-size: 64px; font-weight: 700; color: #FFF;">1.050</div>
                  <div style="font-size: 16px; color: #666; letter-spacing: 3px; margin-top: 8px; font-weight: 700;">OG (GRAVIDADE ORIGINAL)</div>
                </div>
                <div class="card" style="display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 32px; background: #111;">
                  <div style="font-size: 64px; font-weight: 700; color: #FFF;">1.010</div>
                  <div style="font-size: 16px; color: #666; letter-spacing: 3px; margin-top: 8px; font-weight: 700;">FG (GRAVIDADE FINAL ALVO)</div>
                </div>
              </div>
            </div>

            <!-- RAMPAS VIEW 2: STEPS & CONTROLS -->
            <div class="view" style="width: 33.333%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; gap: 24px;">
              
              <!-- Left: Steps (75%) -->
              <div style="flex: 3; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding-right: 8px; padding-bottom: 24px;">
                <!-- Step 1 -->
                <div class="card" style="display: flex; align-items: center; padding: 24px 32px; gap: 32px; position: relative; border-radius: 24px; background: #111;">
                  <div style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666; font-weight: 700; position: relative; z-index: 1; flex-shrink: 0;">1</div>
                  <div style="position: absolute; bottom: -16px; left: 56px; width: 2px; height: 16px; background: #333; z-index: 0;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 24px; font-weight: 700; color: #666; margin-bottom: 8px;">Fermentação Primária</div>
                    <div style="display: flex; gap: 24px; color: #555; font-size: 18px; font-weight: 500;">
                      <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg> 18°C</div>
                      <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 3d</div>
                    </div>
                  </div>
                </div>
                
                <!-- Step 2 ACTIVE -->
                <div class="card" style="display: flex; align-items: center; padding: 24px 32px; border: 1px solid #444; gap: 32px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border-radius: 24px; background: #151515;">
                  <div style="width: 48px; height: 48px; border-radius: 50%; background: #FFF; display: flex; align-items: center; justify-content: center; color: #000; position: relative; z-index: 1; flex-shrink: 0;">
                    <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg>
                  </div>
                  <div style="position: absolute; top: -16px; left: 56px; width: 2px; height: 16px; background: #333; z-index: 0;"></div>
                  <div style="position: absolute; bottom: -16px; left: 56px; width: 2px; height: 16px; background: #333; z-index: 0;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 24px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Cold Crash</div>
                    <div style="display: flex; gap: 24px; color: #AAA; font-size: 18px; font-weight: 500;">
                      <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg> 2°C</div>
                      <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 3d</div>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 14px; font-weight: 900; color: #FFF; letter-spacing: 2px; margin-bottom: 4px;">ATIVO</div>
                    <div style="font-size: 18px; color: #AAA; font-weight: 500;">0s</div>
                  </div>
                </div>
                
                <!-- Step 3 -->
                <div class="card" style="display: flex; align-items: center; padding: 24px 32px; gap: 32px; position: relative; border-radius: 24px; background: #111;">
                  <div style="width: 48px; height: 48px; border-radius: 50%; border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666; font-weight: 700; position: relative; z-index: 1; flex-shrink: 0;">3</div>
                  <div style="position: absolute; top: -16px; left: 56px; width: 2px; height: 16px; background: #333; z-index: 0;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 24px; font-weight: 700; color: #FFF; margin-bottom: 8px;">Maturação</div>
                    <div style="display: flex; gap: 24px; color: #AAA; font-size: 18px; font-weight: 500;">
                      <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg> 10°C</div>
                      <div style="display: flex; align-items: center; gap: 8px;"><svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 1d</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right: Buttons (25%) -->
              <div style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; background: #1a1a1a; color: #FFF; border: 1px solid #333;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  PAUSAR
                </button>
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; background: #1a1a1a; color: #FFF; border: 1px solid #333;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
                  ANTERIOR
                </button>
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; background: #1a1a1a; color: #FFF; border: 1px solid #333;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:none;stroke-width:2;"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
                  PRÓXIMA
                </button>
                <button class="card" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; cursor: pointer; padding: 0; font-size: 16px; font-weight: 700; letter-spacing: 2px; border-radius: 24px; border: 1px solid #ff4444; color: #ff4444; background: #3a1111;">
                  <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:currentColor;fill:#ff4444;stroke-width:0;"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect></svg>
                  FINALIZAR
                </button>
              </div>
            </div>

            <!-- RAMPAS VIEW 3: LOGS -->
            <div class="view" style="width: 33.333%; padding: 0 40px; box-sizing: border-box; height: 100%; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div style="font-size: 14px; font-weight: 700; color: #888; letter-spacing: 3px; display: flex; align-items: center; gap: 12px;">
                  <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M3 15v4c0 1.1.9 2 2 2h14"></path></svg>
                  DIÁRIO DE BORDO
                </div>
                <button style="background: #222; border: 1px solid #333; border-radius: 20px; color: #FFF; font-weight: 700; font-size: 12px; letter-spacing: 2px; padding: 8px 20px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:3;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> ADICIONAR
                </button>
              </div>

              <div style="flex: 1; overflow-y: auto; position: relative; padding-left: 20px; padding-right: 8px; padding-bottom: 24px;">
                <div style="position: absolute; top: 20px; bottom: 0; left: 29px; width: 2px; background: #333; z-index: 0;"></div>
                
                <!-- Log 1 -->
                <div style="display: flex; gap: 24px; margin-bottom: 16px; position: relative; z-index: 1;">
                  <div style="width: 20px; height: 20px; border-radius: 50%; background: #666; border: 4px solid var(--bg-base); margin-top: 24px; flex-shrink: 0;"></div>
                  <div class="card" style="flex: 1; padding: 20px 24px; background: #111; border-radius: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <div style="background: #000; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #FFF; letter-spacing: 1px;">SISTEMA</div>
                      <div style="color: #666; font-size: 12px; display: flex; align-items: center; gap: 6px; font-weight: 600;"><svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> 07/15 às 06:51 PM</div>
                    </div>
                    <div style="font-size: 16px; color: #DDD; font-weight: 500;">Lote iniciado.</div>
                  </div>
                </div>
                
                <!-- Log 2 -->
                <div style="display: flex; gap: 24px; margin-bottom: 16px; position: relative; z-index: 1;">
                  <div style="width: 20px; height: 20px; border-radius: 50%; background: #a855f7; border: 4px solid var(--bg-base); margin-top: 24px; flex-shrink: 0; box-shadow: 0 0 10px rgba(168,85,247,0.5);"></div>
                  <div class="card" style="flex: 1; padding: 20px 24px; background: #111; border-radius: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <div style="background: #000; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #FFF; letter-spacing: 1px;">SYSTEM_ACTION</div>
                      <div style="color: #666; font-size: 12px; display: flex; align-items: center; gap: 6px; font-weight: 600;"><svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> 07/18 às 06:52 PM</div>
                    </div>
                    <div style="font-size: 16px; color: #DDD; font-weight: 500;">Avançou automaticamente para a etapa: Maturação (2°C)</div>
                  </div>
                </div>
                
                <!-- Log 3 -->
                <div style="display: flex; gap: 24px; margin-bottom: 16px; position: relative; z-index: 1;">
                  <div style="width: 20px; height: 20px; border-radius: 50%; background: #a855f7; border: 4px solid var(--bg-base); margin-top: 24px; flex-shrink: 0; box-shadow: 0 0 10px rgba(168,85,247,0.5);"></div>
                  <div class="card" style="flex: 1; padding: 20px 24px; background: #111; border-radius: 20px; position: relative;">
                    <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#555;fill:none;stroke-width:2;position:absolute;top:24px;right:20px;cursor:pointer;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <div style="background: #000; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; color: #FFF; letter-spacing: 1px;">SYSTEM_ACTION</div>
                      <div style="color: #666; font-size: 12px; display: flex; align-items: center; gap: 6px; font-weight: 600; margin-right: 32px;"><svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> 07/22 às 12:22 PM</div>
                    </div>
                    <div style="font-size: 16px; color: #DDD; font-weight: 500;">Avançou automaticamente para a etapa: Etapa 3 (10°C)</div>
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
