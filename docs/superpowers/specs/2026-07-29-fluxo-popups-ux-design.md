# Refinamento de UX — Fluxo e pop-ups

**Data:** 29/07/2026
**Estado:** desenho aprovado; aguardando revisão do documento

## Objetivo

Melhorar o caminho diário de consulta, edição e cadastro de Leads e Churns sem alterar as regras de dados, as mutações do backend ou as análises já entregues. Esta é a primeira frente do refinamento visual geral do PWA; Configurações e a estrutura das demais páginas serão uma etapa posterior.

## Trabalho principal

O usuário deve conseguir abrir uma lista de churns, identificar rapidamente o registro, editar ou apagar com segurança e salvar alterações sem depender de controles nativos desalinhados.

Fluxo mais curto:

1. Abrir **Fluxo > Churns**.
2. Acionar **Saídas registradas** ou um período do gráfico.
3. Escanear os registros no pop-up por nome, ID, data e frequência.
4. Escolher **Editar** ou **Apagar**.
5. Salvar pelo rodapé visível do formulário.

## Pop-up de lista de churns

Cada registro será uma linha de painel compacta, não uma sequência de texto e botões nativos:

- Cabeçalho da linha: nome à esquerda e data de saída como metadado destacado à direita em telas largas; em telas estreitas, a data passa para a segunda linha.
- Segunda linha: `ID do aluno` e frequência, com separador visual discreto.
- Motivo, sinais e retenção aparecem apenas quando preenchidos, como detalhes secundários. Campos vazios não deixam marcadores vazios.
- Ações ficam alinhadas no fim da linha: **Editar** é secundária e **Apagar** é uma ação de risco delimitada em vermelho. A confirmação de exclusão existente é mantida.
- O pop-up preserva cabeçalho fixo, corpo rolável e fecha por botão ou `Escape`.

## Formulários de Lead e Churn

Os formulários continuarão em duas colunas no desktop e uma coluna no celular, porém com agrupamento mais claro:

- Campos básicos primeiro; campos de contexto e observações depois.
- Inputs, selects e áreas de texto terão o mesmo acabamento escuro, borda, foco e altura mínima de 44 px.
- Datas usam controles de data nativos, convertidos para o formato esperado pelo backend no envio; registros existentes continuam sendo mostrados corretamente.
- O botão **Salvar** ficará em um rodapé de ação do formulário, visualmente separado e sempre após os campos. Em telas pequenas, terá largura total.
- O estado de salvamento existente (`Salvando…`, `Salvo`, falha) continua sendo exibido fora do diálogo.

## Sistema de ações

Serão introduzidas classes semânticas reutilizáveis:

- `primary`: criar ou salvar.
- `secondary`: editar, cancelar ou ação neutra.
- `danger`: apagar, mantendo confirmação prévia.

Todas terão alvo de toque de pelo menos 44 px, estado de hover/foco e contraste compatível com o tema escuro.

## Estados e acessibilidade

- Enquanto a análise de churn carrega, permanece a mensagem curta já existente; os gráficos mantêm área estável.
- Pop-up vazio explica que não há churns no recorte, sem exibir área em branco.
- Ações de risco são identificadas por texto, não apenas por cor.
- O foco do teclado permanece visível em botões, campos e fechamento do diálogo.

## Fora do escopo desta etapa

- Reorganização da página Configurações e substituição dos checkboxes nativos dela.
- Mudança de métricas, filtros, séries, payloads ou estrutura da planilha.
- Novo estilo decorativo global que não ajude diretamente os fluxos de Leads e Churns.

## Testes

- O cliente contém ações semânticas secundária e de risco nos detalhes de Churn.
- Formularios usam controles de data e convertem valores para a API sem alterar o payload final.
- O CSS define alvos de toque mínimos, estados de foco e responsividade de linhas e rodapé de formulário.
- Sintaxe do cliente e toda a suíte Node continuam válidas.
