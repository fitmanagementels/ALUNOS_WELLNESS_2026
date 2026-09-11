# Detalhamentos de Financeiro e filtro Matriculados

**Data:** 28/07/2026
**Status:** aprovado pelo usuário para implementação.

## Objetivo

Dar continuidade operacional à tela Financeiro: cada distribuição deve abrir o recorte que representa e os valores por hora-aula devem estar disponíveis de modo direto. Adicionar também um filtro global que reúna os alunos matriculados, sem alterar a base da planilha ou realizar novas chamadas ao servidor.

## Escopo aprovado

### Filtro global: Matriculados

- O seletor Status terá a opção `Matriculados`, antes dos status individuais.
- Ao selecioná-la, serão considerados os alunos cujo status normalizado seja `ativo`, `bloqueado`, `licenca` ou `em licenca`.
- A normalização remove acentos, espaços externos e diferenciação entre maiúsculas/minúsculas. Portanto, `Licença`, `LICENCA` e `Em licença` funcionam sem depender da grafia original.
- Os filtros Polo e Status continuam sendo aplicados antes da renderização de qualquer página.
- O estado inicial permanece `Ativo`; Matriculados é uma opção escolhida pelo operador, não uma mudança do padrão.

### Financeiro > Planos

- Cada barra de `Distribuição por frequência` abrirá um modal contendo somente os contratos com a frequência selecionada.
- A lista será agrupada visualmente por aluno. Um aluno pode constar em mais de uma frequência quando possui contratos distintos; dentro do recorte da frequência, cada contrato aparece uma vez.
- O topo do modal mostrará `Faturamento do recorte` como soma dos valores dos contratos selecionados, além da quantidade de contratos.
- O card `Ticket por aluno` exibirá abaixo do ticket a `Hora-aula média`: média aritmética de `valor ÷ (frequência semanal × 4,33)` apenas para contratos com frequência válida.
- O clique no card abre uma lista enxuta, uma linha por contrato, com exatamente `Aluno`, `Valor do plano` e `Valor por hora-aula`; contratos sem frequência válida mostram `—` para hora-aula e não participam da média.

### Financeiro > Vencimentos

- As quatro barras de `Mapa do mês` serão clicáveis.
- Cada barra abre o modal dos contratos cujo vencimento pertence ao quartil do mês atual: 1–7, 8–15, 16–23 e 24–fim.
- A lista preserva o detalhamento de contratos já usado nos blocos Últimos 5 dias, Hoje e Próximos 5 dias.

## Arquitetura

As alterações ficam em `apps-script/DashboardClient.html`. A função de filtro recebe uma pequena regra de status agregado; as funções de renderização derivam subconjuntos dos contratos já presentes no bootstrap local. Um novo renderizador de detalhe financeiro permite um cabeçalho resumido e uma lista de colunas reduzidas, sem afetar os modais de prescrição/avaliação.

Nenhum endpoint, aba, payload, cache ou fila de mutações será alterado. O comportamento novo usa os dados que o PWA já possui em memória.

## Critérios de aceite

1. `Matriculados` inclui Ativo, Bloqueado e Licença/Em licença, respeitando o filtro Polo.
2. Uma barra 2X lista somente contratos 2X, mostra o faturamento somado e preserva contratos distintos do mesmo aluno.
3. O card Ticket por aluno mostra e detalha valor de hora-aula conforme a fórmula oficial `valor ÷ (frequência × 4,33)`.
4. A lista de hora-aula tem somente aluno, valor do plano e hora-aula.
5. Cada quartil do mapa de vencimentos abre sua lista correta.
6. Nenhum dado de contato passa a ser exibido ou armazenado no navegador.
7. A suíte local continua passando.
