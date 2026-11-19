# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Principal: cervejeiro caseiro.** Faz cerveja em casa, com um a três fermentadores em geladeira adaptada (aquecedor e compressor). Quer manter a temperatura de fermentação certa sem ficar vigiando a geladeira e ser avisado quando algo sai do esperado.
- **Também: nanocervejarias e cervejeiros ciganos.** Operam vários fermentadores, precisam ver todos de uma vez, repetir perfis e guardar o histórico dos lotes.

## Product Purpose

O Breww controla e acompanha a fermentação de cerveja. Um controlador com ESP32 lê a temperatura da cerveja e do ambiente, liga aquecimento ou refrigeração e segue um perfil de etapas (por exemplo: primária, descanso de diacetil, cold crash). O app mostra tudo ao vivo, envia alertas e guarda o histórico de cada lote.

Sucesso é a pessoa ligar o controlador (montado por ela ou comprado pronto), vinculá-lo à conta em poucos minutos e confiar nele para conduzir a fermentação.

## Positioning

Quatro fatos que, juntos, um produto vizinho não pode afirmar igual:

1. **Firmware aberto.** O código do controlador é aberto (GPL-3.0) e roda em placas ESP32 comuns; qualquer pessoa pode montar o seu.
2. **Instala pelo navegador.** O site detecta a placa, grava o firmware e configura o Wi‑Fi pelo cabo USB, sem instalar programas.
3. **App completo no celular.** Controle ao vivo, perfis de etapas, alertas, histórico e biblioteca de perfis, no iOS e no Android.
4. **Feito no Brasil.** Em português, pensado para o cervejeiro brasileiro.

## Operating Context

- **O uso diário é pelo app.** Quem entra no site com a conta chega à área logada (aparelhos, detalhe do aparelho, histórico, calculadoras, comparar e ajustes), que repete a identidade do app para uso no computador.
- **O site serve para:** apresentar o produto (home), criar a conta (Google, Apple ou e-mail), guiar a montagem (`/instalar`), gravar o firmware e configurar o Wi‑Fi (`/instalar/assistente`), ajuda, privacidade, termos e o painel do administrador (`/admin`).
- O assistente de instalação é usado no computador, com a placa ligada por USB, em navegador com Web Serial (Chrome ou Edge), normalmente com as peças na bancada.
- Repositórios irmãos: o app (`breww-app`) e o firmware (espelho público `lgimenes-br/breww-firmware`). O servidor vive neste repositório, em `backend/`.

## Capabilities and Constraints

- **Oferta:** monte o seu (peças + firmware aberto) e controlador pronto com tela, que o Breww vende ou vai vender em breve.
- **Funções:** controle de temperatura com perfil de etapas; modos fermentador, geladeira e chopeira; densidade por densímetro flutuante (iSpindel); umidade; notificações no celular; histórico e comparação de lotes; biblioteca de perfis compartilhados; atualização do firmware pelo ar com retorno automático à versão anterior em caso de falha.
- **Placas suportadas:** ESP32‑S3 com tela de 3,5", ESP32 DevKit, ESP32‑S3 e ESP32‑C3 sem tela.
- **Conta gratuita** com até 3 aparelhos.
- **Idioma:** português do Brasil hoje; o produto deve ficar pronto para ganhar inglês (evitar texto preso em imagens e frases que não se traduzem).
- **Termos da interface:** "aparelho" ou "controlador", "lote", "perfil", "etapa", "alvo", "fermentador", "geladeira", "chopeira".
- Este repositório é público: nada de segredos ou dados de clientes em arquivos versionados.
- **Em aberto:** preço e data de venda do controlador pronto; conteúdo e preço do plano pago; data de publicação do app nas lojas.

## Brand Commitments

- Nome: **Breww**. Domínio: breww.live. Contato: contato@breww.live.
- Logo e símbolo próprios (`components/BrewwMark.tsx`).
- Voz: português do Brasil, tratando a pessoa por "você", direta e sem jargão desnecessário.

## Evidence on Hand

- Código real do firmware aberto e o repositório público.
- Mapas de ligação das placas suportadas (`components/Installer.tsx`).
- Telas reais do app e dados reais de um aparelho de teste.
- Ainda não há depoimentos de clientes, números de usuários, fotos do controlador pronto nem preços publicados.

## Product Principles

1. **Funciona sozinho.** O controlador decide localmente; o app acompanha e avisa.
2. **Da bancada à primeira leitura em minutos.** Gravar, conectar e vincular é um único caminho guiado.
3. **Aberto de verdade.** Quem quiser monta o seu com o mesmo firmware do controlador pronto.
4. **Serve para um ou para vinte fermentadores.** O que atende o caseiro não atrapalha a nanocervejaria.
5. **O celular é o painel.** O site leva a pessoa até o app; não compete com ele.
