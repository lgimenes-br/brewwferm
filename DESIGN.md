---
name: Breww
description: Controle de fermentação de cerveja no celular, com firmware aberto.
colors:
  verde-no-alvo: "#71FC8F"
  chao: "#04070B"
  grafite-cartao: "#181C25"
  campo: "#20252F"
  texto: "#ECECF1"
  texto-secundario: "#898E99"
  texto-terciario: "#6B6F78"
  sobre-verde: "#0B0C10"
  vermelho-aviso: "#FF5A6E"
typography:
  display-xl:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "84px"
    fontWeight: 300
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  display-lg:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.035em"
  display:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "66px"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline-lg:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "60px"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  display-sm:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline-sm:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 300
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  leitura:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "96px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "'tnum'"
  leitura-sm:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "'tnum'"
  title:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.625
  body-sm:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
  input:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label-xs:
    fontFamily: "'Outfit', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.33
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.8
rounded:
  marca: "8px"
  campo: "12px"
  aviso: "16px"
  cartao: "24px"
  painel: "28px"
  pilula: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  malha: "48px"
  secao: "80px"
  secao-home: "128px"
components:
  button-primary:
    backgroundColor: "{colors.verde-no-alvo}"
    textColor: "{colors.sobre-verde}"
    rounded: "{rounded.pilula}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "#000000"
  button-accent:
    backgroundColor: "{colors.verde-no-alvo}"
    textColor: "{colors.chao}"
    rounded: "{rounded.pilula}"
    padding: "14px 24px"
  button-ghost:
    backgroundColor: "{colors.grafite-cartao}"
    textColor: "{colors.chao}"
    rounded: "{rounded.pilula}"
    padding: "14px 24px"
  card-light:
    backgroundColor: "{colors.grafite-cartao}"
    textColor: "{colors.chao}"
    rounded: "{rounded.cartao}"
    padding: "32px"
  card-dark:
    backgroundColor: "{colors.grafite-cartao}"
    textColor: "{colors.grafite-cartao}"
    rounded: "{rounded.cartao}"
    padding: "28px"
  leitura-instrumento:
    backgroundColor: "{colors.grafite-cartao}"
    textColor: "{colors.grafite-cartao}"
    typography: "{typography.leitura}"
    rounded: "{rounded.cartao}"
    padding: "24px 28px"
  status-pill:
    backgroundColor: "rgba(113,252,143,0.15)"
    textColor: "{colors.verde-no-alvo}"
    rounded: "{rounded.pilula}"
    padding: "4px 12px"
  input:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.texto}"
    rounded: "{rounded.campo}"
    padding: "14px 16px 14px 40px"
  input-pill:
    backgroundColor: "{colors.grafite-cartao}"
    textColor: "{colors.chao}"
    rounded: "{rounded.pilula}"
    height: "48px"
    padding: "0 20px"
  chip:
    backgroundColor: "{colors.grafite-cartao}"
    textColor: "{colors.texto-secundario}"
    rounded: "{rounded.pilula}"
    padding: "4px 12px"
---

# Design System: Breww

## Overview

> **Atualização de 2026-11-14:** o site inteiro (home, entrada, guia, assistente, ajuda, área logada e admin) passou a usar a identidade do app, descrita em "Identidade única: o app em todo o site" no fim deste arquivo. Ela vale sobre as regras de cor e tipografia claras abaixo. A estrutura, a curva, o tracejado e as regras de verde raro e vermelho reservado continuam valendo, agora sobre o chão escuro.

**Creative North Star: "O instrumento calmo"**

O Breww se parece com um instrumento de medição sereno: poucos elementos na tela, números grandes e leves, e um único verde que acende quando está tudo no alvo. O fundo é um cinza claro de papel, o texto é tinta quase preta e os dados do aparelho aparecem em painéis escuros, como o visor de um equipamento pousado sobre a bancada. Isso vale para o site inteiro: home, instalador, cadastro, ajuda e páginas legais.

Nas páginas que contam a história do produto (hoje, a home), o instrumento ganha seu registro de cartaz, **"A curva é a página"**: a seção da curva vira papel milimetrado, a linha de temperatura atravessa a página como fio condutor e a rolagem avança os dias de um lote de exemplo. É o mesmo instrumento visto de perto, não um segundo sistema: mesma paleta, mesma tipografia leve, mesmas pílulas. O guia de montagem (/instalar) e o assistente (/instalar/assistente) seguem a mesma gramática: malha só no topo, a linha verde como trilha dos passos (feito = cheio, atual = aceso, futuro = tracejado), painéis de instrumento Grafite para as leituras da placa e um tom de cinza por seção. O cadastro continua no registro calmo.

O clima é confiante, calmo e acolhedor. Confiante na tipografia grande e fina e nas frases diretas; calmo no espaço em branco e na ausência de enfeite; acolhedor nos cantos bem arredondados e na linguagem de cervejeiro. O visual não deve parecer rústico de cervejaria (madeira, barril, âmbar, letras de pub) nem um painel escuro técnico cheio de séries e cores.

**Key Characteristics:**
- Fundo claro, tinta escura e um único verde de destaque.
- Títulos grandes em peso leve, com espaçamento apertado; nas páginas de história, em escala de cartaz.
- A curva de temperatura como fio condutor: alvo tracejado, linha real verde, ponta com anel.
- Papel milimetrado só na seção da curva (o papel do gráfico); as outras seções se separam por tons de cinza.
- Dados do aparelho sempre em painéis Grafite, com números tabulares.
- Pílulas e cantos generosos em tudo o que se toca.

## Colors

Paleta quase monocromática, do papel claro à tinta, com um verde vivo que só aparece onde há algo a comemorar, medir ou destacar.

### Primary
- **Verde No Alvo** (`verde-no-alvo`): o verde que acende quando a fermentação está na temperatura certa. Marca-texto atrás das palavras-chave dos títulos, degradê embaixo da curva, a própria curva sobre fundo escuro, estados positivos sobre Grafite e o botão de avanço dos fluxos de tarefa e do fecho escuro da home.
- **Verde Linha** (`verde-linha`): o traço da curva real sobre o papel claro, onde o Verde No Alvo sumiria. Também a trilha da linha do tempo da montagem, os marcos atingidos e os tiques de lista sobre fundo claro. É sempre traço ou ponto, nunca área.

### Neutral
- **Tinta** (`tinta`): texto principal, botão primário das páginas públicas, alvo tracejado da curva, fecho e rodapé.
- **Grafite Cartão** (`grafite-cartao`): painéis de instrumento, cartões de dados, a seção do código aberto e o painel da marca nas telas de entrada.
- **Papel Névoa** (`papel-nevoa`): fundo de todas as páginas e preenchimento dos campos de formulário.
- **Branco Superfície** (`branco-superficie`): cartões claros, campos em pílula da home e o painel de formulário.
- **Cinza Texto** (`cinza-texto`): texto secundário sobre fundo claro. É o cinza da marca (#6B6F78) escurecido para manter contraste 4,5:1.
- **Cinza Texto Forte** (`cinza-texto-forte`): texto digitado nos campos e corpo de avisos.
- **Cinza Sobre Escuro** (`cinza-sobre-escuro`) e **Cinza Claro Sobre Escuro** (`cinza-claro-sobre-escuro`): rótulos e texto secundário dentro dos painéis escuros, das seções escuras e do rodapé.

### Tertiary
- **Verde Estado** (`verde-estado`): ponto de "ligado" ou "ao vivo" sobre fundo claro, e a linha fantasma do lote inteiro (a 22%) por baixo da curva desenhada.
- **Vermelho Aviso** (`vermelho-aviso`): somente erros e avisos.

### Named Rules
**Regra do Verde Raro.** O verde ocupa pouca área: um grifo, uma linha, um ponto, um botão, o preenchimento de uma régua. Nunca vira fundo de seção.

**Regra do Verde Sobre Escuro.** Como texto ou ícone, o Verde No Alvo só aparece sobre Tinta ou Grafite Cartão. Sobre fundo claro ele é fundo de marca-texto, de botão ou de régua, com texto em Tinta; o traço sobre claro é Verde Linha.

**Regra do Vermelho Reservado.** Vermelho aparece só em erro e aviso; nunca como decoração nem como série de gráfico. O susto de temperatura da curva é marcado em Grafite, não em vermelho.

## Typography

**Display Font:** Inter Tight (com Inter, system-ui)
**Body Font:** Inter (com system-ui)
**Code Font:** a monoespaçada do sistema (ui-monospace, SF Mono, Menlo), só em trechos de código-fonte.

**Character:** Uma única família em dois cortes: a versão apertada, em peso leve e tamanho grande, dá aos títulos e às leituras a voz confiante; a versão normal mantém o texto corrido calmo e legível.

### Hierarchy
- **Display XL** (300, 84px a partir de 1024px, passando por 72px e 44px, entrelinha 0,98–1, espaçamento −0,035em): título da home e do fecho, em escala de cartaz. Só nas páginas de história.
- **Display** (300, 44px no celular até 66px no computador, entrelinha 1,02): título principal das demais páginas e número grande dos cartões de dados. O degrau de 72px também serve ao preço de destaque.
- **Leitura** (300, 56px no celular e 96px a partir de 640px, entrelinha 1, espaçamento −0,04em, algarismos tabulares): a temperatura viva do painel de instrumento, com a unidade pequena em Cinza Claro Sobre Escuro ao lado.
- **Headline** (300, 36px no celular até 48–60px, entrelinha 1,02–1,05, espaçamento −0,03em a −0,035em): título de cada seção e de cada capítulo da curva. Pode ter a segunda metade em Cinza Texto (ou em Verde No Alvo sobre escuro).
- **Title** (600, 18–20px): título de cartão, de passo e de plano.
- **Body** (400, 15–18px, entrelinha 1,625): texto corrido, em Cinza Texto quando é apoio. Largura máxima em torno de 28–36rem.
- **Label** (500, 11–14px): etiquetas, rótulos do gráfico (dias, etapas), legendas e rótulos de campo. Sem caixa alta espaçada.
- **Input** (400, 16px): texto digitado nos campos de formulário. Nunca menor: abaixo de 16px o iPhone dá zoom ao focar o campo.
- **Code** (400, 13px, entrelinha 1,8): trechos reais do firmware. Nunca como fantasia de "técnico" em texto comum.

### Named Rules
**Regra do Peso Leve.** Título e leitura grandes são sempre leves (300). O peso forte (600) fica para títulos pequenos e botões.

**Regra dos Números Tabulares.** Temperaturas, densidades, versões, contagens e horas usam algarismos tabulares para não dançar quando o valor muda.

## Layout

Coluna central de até 72rem (`max-w-6xl`), com margem lateral de 16px no celular e 24px a partir de 640px. Nas páginas comuns as seções respiram cerca de 80px; nas seções da home, 96px no celular e 128px a partir de 1024px. Cabeçalhos de seção da home são uma grade de duas colunas (título 1,2 : texto 1) alinhada pela base, que empilha no celular. Grades de cartões têm duas ou três colunas com 16–24px entre elas.

A curva da home vai de ponta a ponta da tela, fora da coluna central; tudo o mais fica dentro dela. A seção fixa ocupa a altura da tela (100svh) e reserva 64px para o cabeçalho.

**Papel milimetrado.** Só a seção da curva pousa numa malha de 48px em linhas de 1px de Tinta a 5%: é o papel do gráfico. As demais seções não têm malha e se diferenciam pelo tom do chão, nesta ordem na home: Branco Gelo (#F7F7F8) na montagem, Grafite Cartão no código aberto, Papel Névoa na projeção, Cinza Régua (#E4E6E9) nos preços e Tinta no fecho, com uma linha branca a 8% separando o rodapé. O Cinza Texto mantém 6,5:1 no Branco Gelo e 5,5:1 no Cinza Régua. A malha é chão, não enfeite: nunca dentro de cartões.

As telas de entrada (cadastro, login) usam dois painéis lado a lado no computador, o da marca escuro e o do formulário branco, ambos com 12–16px de respiro até a borda da janela; no celular fica só o formulário. O cabeçalho é fixo, translúcido sobre o Papel Névoa, com uma linha fina embaixo. Na home, no celular, uma barra fixa com as duas ações aparece quando o título sai de cena e some no fecho.

## Elevation & Depth

Plano, com camadas de cor. A profundidade vem do contraste entre o Papel Névoa, os cartões brancos e os painéis Grafite. Cartões de conteúdo não têm sombra; quando precisam de contorno, é uma linha de 1px em preto a 7–10% (ou branco a 10% dentro de áreas escuras). Na home, o parallax cria a outra profundidade: camadas que andam em velocidades diferentes com a rolagem.

### Shadow Vocabulary
- **Instrumento na bancada** (`box-shadow: 0 30px 60px -35px rgba(11,13,18,0.7)`): o painel de leitura que flutua sobre a malha e a curva.
- **Visor pequeno** (`box-shadow: 0 24px 40px -30px rgba(11,13,18,0.55)`): as telinhas Grafite da linha do tempo da montagem.
- **Notificação** (`box-shadow: 0 18px 40px -28px rgba(11,13,18,0.5)`): o aviso de celular branco que ilustra o alerta.

### Named Rules
**Regra do Plano por Padrão.** Sombra só em instrumento ou notificação pousado sobre o papel milimetrado, sempre difusa e puxada para baixo. Nada de sombra para "destacar" cartão comum de conteúdo.

## Shapes

Cantos generosos e contínuos. Tudo o que se toca é pílula (botões, etiquetas, campos da home, links do cabeçalho). Cartões e painéis de instrumento usam 24px; os grandes painéis das telas de entrada, 28px; avisos e visores pequenos, 16px; campos de formulário, 12px; as marcas da matriz, 8px. Contornos são sempre finos (1px) e quase transparentes.

Na home, a forma tem dois estados: **cheio** é o que já aconteceu ou já existe (linha contínua, régua preenchida, contorno sólido); **tracejado** é o que ainda não aconteceu (o alvo à frente, a projeção, o plano Pro, o próximo lote). Não há cantos vivos, faixas coloridas laterais nem divisórias grossas.

**Regra do Tracejado.** Tracejado quer dizer sempre "não fixo": o que ainda não aconteceu (passo futuro, próximo lote, projeção), o que é opcional (peças extras, plano Pro) ou o que fica à sua escolha (pino livre para sensor). Cheio quer dizer fixo ou já existente.

**Regra do Aviso Único.** Todo aviso usa a mesma caixa: fundo Vermelho Aviso a 7%, borda a 30%, texto #7A1F2B e o ícone de alerta. Erros que bloqueiam usam o fundo #FDECEA. Nada de âmbar ou rosa fora disso.

## Components

Macios e seguros: formas cheias, arredondadas, sem ornamento, com estados claros.

### Buttons
- **Shape:** pílula (9999px), altura mínima de 48px (14px de respiro vertical, 24px horizontal), texto de 15px em peso 500–600.
- **Primary:** fundo Tinta, texto branco. É o botão das páginas públicas ("Criar conta", "Monte o seu controlador").
- **Accent:** fundo Verde No Alvo, texto Tinta. Avança nos fluxos de tarefa (assistente de instalação) e é o botão principal sobre fundo escuro (fecho da home, lista de espera escura).
- **Ghost:** fundo branco (ou Papel Névoa a 70% com desfoque sobre a malha), contorno preto a 10–15%, texto Tinta.
- **Link de texto:** 15px em peso 500, sublinhado a 30% da cor que fica cheio ao passar o mouse.
- **Hover / Focus:** o primário escurece para preto; o de destaque perde 5% de brilho; o fantasma clareia para branco ou ganha um véu preto a 3%. A seta do botão principal desliza 2px para a direita. Foco pelo teclado: contorno Tinta de 2px, afastado 2px; em áreas escuras o contorno é Verde No Alvo. Desabilitado: 50–60% de opacidade.

### Chips
- **Style:** pílula pequena, fundo branco translúcido, contorno preto a 10%, texto de 12px em Cinza Texto, com um ponto Verde Estado quando indica algo ativo.
- **Estado de plano:** "Agora" em pílula Verde No Alvo com texto Tinta; "Em breve" em pílula de contorno Tinta a 20% e texto Cinza Texto.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** branco (conteúdo geral) ou Grafite Cartão (dados do aparelho). Dentro de seções escuras, superfícies são branco a 3–6% ou Tinta a 70% com contorno branco a 10%.
- **Shadow Strategy:** nenhuma em cartão de conteúdo; ver Elevation & Depth.
- **Border:** opcional, 1px em preto a 7–10%.
- **Internal Padding:** 28–32px (painel de leitura: 20–28px).

### Inputs / Fields
- **Style (formulários):** fundo Papel Névoa, contorno preto a 7%, canto de 12px, ícone à esquerda em Cinza Texto, rótulo pequeno acima.
- **Style (lista de espera da home):** campo em pílula de 48px, fundo branco e contorno preto a 10%, com o botão ao lado; sobre escuro, branco a 6% com contorno branco a 15%.
- **Focus:** contorno e anel finos em preto a 20–30% (branco a 40% sobre escuro); o ícone passa para Tinta.
- **Error:** aviso em bloco (fundo #FDECEA, texto #8A2418) com ícone nos formulários; mensagem com role de alerta logo abaixo do campo na lista de espera. Nunca só cor.

### Navigation
- **Cabeçalho:** logo à esquerda, links de 14px em Cinza Texto que passam para Tinta ao passar o mouse, e um único botão primário pequeno à direita. Abaixo de 768px os links vão para um menu que abre embaixo do cabeçalho, com itens de 48px separados por linhas finas.
- **Rodapé:** fundo Tinta, texto Cinza Claro Sobre Escuro, links que clareiam para branco. Tudo o que se toca tem 44px ou mais.

### Marca-texto
Grifo Verde No Alvo atrás de duas ou três palavras do título, cobrindo de 40% a 92% da altura da linha e acompanhando a quebra de linha. É a assinatura do sistema; usar uma vez por título, e só no título principal de cada página.

### A curva
O fio condutor da home e de qualquer leitura de lote. Alvo em degraus tracejados de Tinta a 50% (traço de 2,5px, padrão 9/9), com o nome e a temperatura de cada etapa escritos acima do degrau. Linha real em Verde Linha de 6px, pontas redondas, com degradê Verde No Alvo de 42% a 0% embaixo; por baixo, o lote inteiro como linha fantasma em Verde Estado a 22%. A ponta da linha é um ponto Verde Linha de 14px com contorno Papel Névoa de 3px dentro de um anel Verde No Alvo a 35% de 32px. Eixo dos dias em Tinta a 18%, rótulos "Dia N" em Label tabular. Eventos (o alerta) são uma pílula Grafite com texto branco e um fio vertical de Tinta a 25%. Sobre fundo escuro, a linha passa a Verde No Alvo e o alvo a branco a 45%. Dados de exemplo são sempre rotulados ("Lote de exemplo").

### Leitura de instrumento
Painel Grafite de 24px de canto que acompanha a ponta da curva: linha de rótulo em Cinza Claro Sobre Escuro com um ponto Verde No Alvo (dia e hora, nome do lote), a temperatura em Leitura com "°C" pequeno ao lado, e embaixo, separados por uma linha branca a 10%, o estado em pílula (Verde No Alvo a 15% com texto Verde No Alvo quando "no alvo"; branco a 10% com texto branco quando aquecendo ou resfriando), o alvo e a densidade, todos tabulares.

### Linha do tempo da montagem
Trilha horizontal no computador e vertical no celular: um fio de Tinta a 10% e, sobre ele, a trilha Verde Linha de 3px que cresce com a rolagem. Cada passo é um círculo de 32px com contorno Verde Linha de 2px e ícone de traço, que se preenche quando a trilha chega; abaixo, título em Title, apoio em Body pequeno e um visor Grafite de 16px de canto com o que a tela mostra naquele passo. A lista de peças fecha como a legenda de um gráfico, com ícones em quadrados brancos de 12px de canto.

### Matriz de compilação
Tabela em painel Tinta a 70% com contorno branco a 10% e 24px de canto, numa seção Grafite: placas nas linhas, versões publicadas nas colunas (tabulares), cada célula uma marca de 32px e 8px de canto com um tique. Versões anteriores em Verde No Alvo a 15% com tique verde; a versão atual em Verde No Alvo cheio com tique Tinta. No celular, só as versões mais recentes.

### Régua de preços
Régua em pílula dividida ao meio: de 1 a 3 fermentadores, contorno Verde Linha a 40% com preenchimento Verde No Alvo que cresce com a rolagem; de 4 em diante, contorno tracejado de Tinta a 30% e números em Cinza Texto. Uma divisa tracejada desce do meio da régua e separa os dois planos, escritos como anotações de cada lado: preço em Display de 72px ou frase em Headline, lista com tiques Verde Linha.

### Gráfico de projeção
O mesmo vocabulário da curva aplicado ao futuro: linha cheia em Verde Linha até a pílula Tinta "hoje", e dali em diante uma curva tracejada de Tinta a 50% (padrão 7/8) com marcos — anel vazio de contorno Tinta para o que está em teste, ponto Verde Linha cheio para o destino — e rótulos com o estado em Cinza Texto.

### Movimento
Ver `.impeccable/design.json` (motion). Em resumo: na home a rolagem conduz tudo; as linhas se revelam por recorte, nunca por tracejado animado; com movimento reduzido tudo fica no estado final, parado.

## Do's and Don'ts

### Do:
- **Do** usar o Verde No Alvo com parcimônia: grifo, linha, ponto, régua ou um botão por tela.
- **Do** usar Verde Linha para o traço da curva sobre fundo claro e Verde No Alvo para a curva sobre fundo escuro.
- **Do** usar tracejado para o que ainda não aconteceu (alvo à frente, projeção, plano futuro, próximo lote) e cheio para o que já existe.
- **Do** manter títulos e leituras grandes em peso 300 com espaçamento negativo (−0,03em a −0,04em).
- **Do** mostrar dados do aparelho em painéis Grafite, com números tabulares e o estado em pílula.
- **Do** usar o papel milimetrado de 48px (Tinta a 5%) só na seção da curva, e diferenciar as outras seções pelo tom do chão (Branco Gelo, Grafite, Névoa, Cinza Régua, Tinta).
- **Do** usar pílula em tudo o que é clicável e 24px nos cartões e painéis.
- **Do** rotular dados sintéticos como exemplo.
- **Do** respeitar a preferência de movimento reduzido: sem seção fixa, curva inteira estática, capítulos em lista e toda camada no estado final.

### Don't:
- **Don't** usar visual rústico de cervejaria: madeira, barril, âmbar, letras de pub, lousa de giz.
- **Don't** transformar páginas em painel escuro técnico com várias séries e cores: uma curva por vez, numa só cor.
- **Don't** pôr sombra em cartão comum de conteúdo nem usar o verde como fundo de seção.
- **Don't** escrever rótulos em caixa alta espaçada, pôr kicker ou sobretítulo acima dos títulos, ou usar títulos grandes em negrito.
- **Don't** usar vermelho fora de erro e aviso, nem para o susto de temperatura da curva.
- **Don't** revelar linhas animando o tracejado do SVG esticado; use recorte.
- **Don't** pôr a malha milimetrada dentro de cartões ou painéis; ela é sempre o chão da seção.

## Identidade única: o app em todo o site

O site inteiro usa a identidade do app Breww; a classe `.app-shell` fica no topo de `App.tsx`. Na home, a curva continua sendo a página: a linha da cerveja em verde, o alvo tracejado em branco a 45%, a malha de 48px em branco a 3,5% só na seção da curva, as seções separadas por uma linha fina, e o grifo do título vira texto verde. Nas telas de entrada, a esquerda mostra um cartão real do app (dados de exemplo, rotulados) e o formulário fica direto sobre o chão: Google primeiro, e-mail depois, um botão verde só, e a recuperação de senha é uma etapa da mesma tela. No admin, o menu lateral usa as mesmas pílulas da barra do site, e a visão geral começa por "Precisa de atenção", com atalhos para a seção certa.

### Área logada: o app no computador

A área logada (`/`, `/fermenter/:id`, `/history`, `/history/:id`, `/calculators`, `/compare`, `/settings`) não segue o "instrumento calmo" claro das páginas públicas. Ela repete a identidade do app Breww (`breww-app/src/theme.ts`), para quem usa os dois não sentir que mudou de produto. O admin (`/admin`) segue a mesma identidade.

- **Escopo:** a classe `.app-shell` (no topo de `App.tsx`) define os tokens em `index.css` para o site todo.
- **Cores:** fundo `#04070B` com três brilhos difusos bem discretos (verde a 8%, grafite a 10%); cartões `#181C25` com borda branca a 8%; campos `#20252F`; texto `#ECECF1`, secundário `#898E99`, terciário `#6B6F78`. Um único verde, `#71FC8F`, para o que está ativo, o botão principal e a curva da cerveja. Vermelho `#FF5A6E` só em aviso e erro.
- **Tipografia:** Outfit. Título de página de 40–52px em peso 300; valores grandes leves; títulos de cartão de 17px em peso normal; rótulos de 12–15px. Sem negrito 700 e sem caixa alta espaçada.
- **A leitura do app:** temperatura com a parte inteira grande e leve, o decimal menor em cinza e "°C" pequeno no alto (`TempDisplay`). Sem leitura, mostra "--", nunca 0 inventado.
- **Peças** (`components/app/AppUI.tsx`): `TempDisplay`, `SmallValue`, `Chip` (pílula com ponto), `StatTile` (rótulo, número e legenda), `PageHeader` e `SectionLabel`; e as classes `.app-card` (canto de 26px), `.app-row` (22px), `.app-pill`, `.app-icon-btn`, `.app-btn` (verde) e `.app-btn-quiet`.
- **Regra do verde único por tela:** um botão verde por tela; "Salvar" de cada seção é discreto. Verde também é a aba ativa (texto) e o ponto de "ligado".
- **Gráficos:** cerveja em verde, geladeira e sensores extras em cinza, alvo tracejado em branco a 45%, grade branca a 6%, dica escura `#20252F`. Na comparação, lote A em verde e lote B em cinza; densidade tracejada.
- **Navegação:** barra fixa translúcida, abas em pílula com ícone e rótulo (só ícone na página do aparelho, onde entram o nome, o estado e o modo), seta de voltar à esquerda nas páginas de detalhe.
- **Telas antigas:** o fim do bloco `.app-shell` em `index.css` converte as classes claras antigas (`bg-white`, `border-black/…`, azuis, âmbar) para o escuro, para que modais e assistentes não fiquem claros. Telas novas usam os tokens direto.

