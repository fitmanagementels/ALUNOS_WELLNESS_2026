# Churn — profissionais responsáveis sem plano ou polo

**Data:** 30/07/2026
**Estado:** aprovado pelo usuário para implementação

## Objetivo

Atualizar a base manual `FLUXO_CHURNS` para a nova fonte de dados: remover plano/frequência e polo, e registrar quem conduziu a manutenção do aluno e quem deu sua última aula.

## Schema de `FLUXO_CHURNS`

A ordem definitiva do cabeçalho será:

1. `churn_id`
2. `aluno_id`
3. `nome`
4. `telefone`
5. `data_saida`
6. `profissional_responsavel`
7. `ultimo_personal`
8. `motivo_saida`
9. `sinais_contexto`
10. `acao_retencao`
11. `criado_em`
12. `atualizado_em`

`contrato_x_sem` e `polo` deixam de existir no schema, nos payloads, nas mutações, no PWA e nas análises. O usuário já removeu as linhas da fonte anterior, portanto a atualização do cabeçalho não precisa migrar dados históricos nem fazer backup automático.

## Regras dos novos campos

Os dois campos são opcionais e são menus suspensos; valor vazio é válido.

- `profissional_responsavel`: `Elohim`, `Xico`, `Cadu`, `Ruan`, `Iranildo`.
- `ultimo_personal`: todos os profissionais responsáveis e também `Wallyson`, `Genuca`, `Yasmin`, `Wanderson Fabrício`, `Leonardo`, `Jackson`, `Vitória`, `Maria`, `Clara`, `Thomas`, `Max`, `Sávio`, `Cristian`, `Rafael`.

O backend rejeita valores não vazios fora dessas listas. A edição preserva os valores já gravados; `criado_em` permanece e `atualizado_em` é renovado.

## PWA e análises

- O formulário de Churn mostra `Data da saída`, depois `Profissional responsável` e `Último personal`.
- O pop-up de churn mostra os dois campos somente quando preenchidos; não mostra contrato nem polo.
- Todos os churns de `FLUXO_CHURNS` chegam ao dashboard: não haverá mais filtro por `XSTEAM WELLNESS CLUB`.
- O diagnóstico de frequência contratada é removido e substituído pelo ranking de `Profissional responsável`, incluindo `Não informado` para auditoria de preenchimento.
- Os gráficos temporais, o popup por período, os três textos de auditoria e a confirmação de exclusão permanecem inalterados.

## Backend e planilha

- `CONFIG.cabecalhos.fluxoChurns` passa a refletir exatamente a ordem acima.
- `garantirEstruturaPlanilha()` atualiza o cabeçalho da aba já vazia; não cria coluna de contrato ou polo.
- O comando de preencher IDs pendentes continua escrevendo somente a coluna A, usando a largura atual do schema para validar o cabeçalho.
- `churnSeguroParaDashboard_`, a mutação de Churn e as métricas usam os novos nomes em camelCase: `profissionalResponsavel` e `ultimoPersonal`.

## Testes e documentação

- Cobrir schema, leitura segura, criação/edição e rejeição de profissional inválido.
- Confirmar que a leitura de churn não filtra mais registros por polo.
- Confirmar que os diagnósticos agrupam profissionais responsáveis e mantêm `Não informado`.
- Atualizar o teste de HTML para remover contrato/polo e exigir os novos menus.
- Atualizar `CONTEXTO_DO_PROJETO.md`, `CONTEXTO_DO_PROJETO.html` e as instruções de instalação.

## Fora do escopo

- Sincronização com `VISAO_MESTRE`.
- Validação de `aluno_id`.
- Cadastro administrativo ou manutenção dinâmica da lista de profissionais.
- Métricas de permanência, coorte e taxa de churn histórica.
