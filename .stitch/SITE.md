# Breww — Mapa Completo de Telas no Google Stitch

## Visão Geral do Produto
**Breww** é o ecossistema completo de controle cervejeiro e refrigeração inteligente (Web App + Display Touchscreen embarcado de 3.5" e 7").
Por padrão de fábrica, todo equipamento novo inicia no **Modo Geladeira** (4.0°C) para uso imediato e seguro, podendo ser alternado a qualquer momento para **Modo Fermentador** (com rampas automáticas, leitura de hidrômetro sem fio iSpindel/Tilt e assistente IA Gemini) ou **Modo Chopeira (Kegerator)**.

## Inventário das 14 Telas do Ecossistema
1. **01. Login e Cadastro (`/login` e `/register`)** — Autenticação escura minimalista com card centralizado.
2. **02. Boas-Vindas — Primeiro Acesso (`/` vazio)** — Guia de 3 passos para recém-chegados + botões "Buscar na Rede Wi-Fi (mDNS)" e "Adicionar pelo Código/IP".
3. **03. Dashboard Principal — Meus Dispositivos (`/`)** — Grid de equipamentos conectados nos 3 modos (Geladeira, Fermentador e Chopeira).
4. **04. Controle — Modo Geladeira (Padrão Inicial)** — Controle direto de temperatura com botões `-` e `+`, umidade relativa e banner de identificação de sensores com 1 clique.
5. **05. Controle — Modo Chopeira (Kegerator)** — Temperatura de serviço do chope + configuração da torneira (estilo, cervejaria, IBU, ABV).
6. **06. Assistente de Nova Fermentação (Wizard 4 Passos)** — Receita/BeerXML, Densidades OG/FG, Perfil de Rampas e Resumo de Início.
7. **07. Controle — Modo Fermentador Ativo** — Gráficos duplos (Temperatura + Densidade SG), Previsão de FG, Linha do Tempo de Rampas, Diário do Lote e Consultor IA Gemini.
8. **08. Histórico de Lotes e Relatório Completo (`/history` e `/history/:id`)** — Arquivo de brassagens finalizadas com estatísticas de atenuação, ABV final e exportação.
9. **09. Comparador de Lotes (`/compare`)** — Sobreposição visual de dois lotes para comparar curvas de temperatura e atenuação.
10. **10. Calculadoras Cervejeiras (`/calculators`)** — 6 ferramentas: ABV, Correção de Densímetro, Priming (Carbonatação), Diluição/Evaporação, IBU (Tinseth) e Água de Brassagem.
11. **11. Configurações e Sensores 1-Wire (`/settings`)** — Pareamento de sensores DS18B20 por toque/aquecimento, preferências de unidades (°C/°F, SG/°Plato), alertas e integrações (Brewfather, iSpindel, Tilt).
12. **12. Página Pública Ao Vivo (`/live/:token`)** — Telemetria somente-leitura para compartilhar o lote em andamento com amigos ou clientes.
13. **13. Painel Administrativo (`/admin`)** — Gestão da frota de controladores, usuários, versões de firmware OTA e diagnósticos.
14. **14. Display Físico do Aparelho (Telas 3.5" e 7")** — Tela de configuração inicial Wi-Fi com QR Code + Menu Launcher com os 6 aplicativos nativos da controladora.
