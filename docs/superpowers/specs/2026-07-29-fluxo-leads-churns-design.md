# Fluxo — Leads e Churns

**Data:** 29/07/2026
**Estado:** desenho aprovado; aguardando revisão do documento antes do plano de implementação

## Objetivo

Adicionar a página principal **Fluxo** ao dashboard XSTEAM, com as subabas **Leads** e **Churns**. A etapa registra manualmente dados operacionais e os apresenta em recortes temporais simples e auditáveis. Ela não altera o snapshot importado de alunos e contratos.

## Escopo

- Criar duas abas persistentes do Google Sheets: `FLUXO_LEADS` e `FLUXO_CHURNS`.
- Permitir criar e editar Leads e Churns pelo dashboard.
- Permitir excluir Churns, mediante confirmação explícita; Leads não podem ser excluídos nesta versão.
- Exibir formulário sob demanda, indicadores, gráficos temporais, lista e detalhes em cada subaba.
- Manter a origem manual dos dados. Não haverá sincronização automática com a base mestre nesta etapa.

## Dados persistidos

### FLUXO_LEADS

| Coluna | Tipo e regra |
|---|---|
| `lead_id` | ID interno gerado pelo sistema; imutável. |
| `nome` | Texto obrigatório. |
| `telefone` | Texto obrigatório; usado exclusivamente para o atalho do WhatsApp. |
| `origem` | Texto livre opcional. |
| `indicacao` | Texto livre opcional. |
| `primeiro_contato` | Data manual obrigatória: dia em que o lead apareceu. |
| `experimental` | Data opcional agendada para a aula experimental; se ela ocorrer na data marcada, o valor é preservado. |
| `professor_experimental` | Texto opcional. |
| `entrada_como_cliente` | Data opcional em que o lead se tornou cliente pagante. |
| `status` | Seleção manual obrigatória. |
| `plano_contratado` | Seleção opcional. |
| `valor_pacote` | Número livre opcional, não negativo, exibido como moeda. |
| `minirrelatorio_venda` | Texto livre opcional com dores, objeções e pontos importantes para a venda. |
| `criado_em` | Data/hora gerada pelo sistema. |
| `atualizado_em` | Data/hora atualizada pelo sistema em cada edição. |

Status permitidos, sem automação implícita: `Novo`, `Em contato`, `Esfriando`, `Experimental agendado`, `Experimental realizado`, `Convertido` e `Perdido`.

Planos permitidos: `Pacote 5x`, `Pacote 10x`, `1x/sem`, `2x/sem`, `3x/sem`, `4x/sem`, `5x/sem` e `6x/sem`.

A data `entrada_como_cliente` não muda o status. O dashboard pode sinalizar, sem bloquear salvamento, quando a data existe e o status não é `Convertido`.

### FLUXO_CHURNS

| Coluna | Tipo e regra |
|---|---|
| `churn_id` | ID interno gerado pelo sistema; imutável. |
| `aluno_id` | Texto obrigatório, compatível com o ID da base mestre. |
| `nome` | Texto obrigatório. |
| `polo` | Gravado automaticamente como `XSTEAM WELLNESS CLUB`. |
| `data_saida` | Data manual obrigatória. |
| `motivo_saida` | Texto livre opcional. |
| `sinais_contexto` | Texto livre opcional com alertas e contexto percebido. |
| `acao_retencao` | Texto livre opcional com tentativa ou ação de retenção. |
| `criado_em` | Data/hora gerada pelo sistema. |
| `atualizado_em` | Data/hora atualizada pelo sistema em cada edição. |

Churns pertencem exclusivamente ao Wellness Club nesta versão. O vínculo por `aluno_id` prepara integrações futuras, mas não preencherá nem atualizará dados automaticamente.

## Experiência no dashboard

`Fluxo` entra na navegação principal, com `Leads` e `Churns` como subabas. Ambas seguem o padrão de espaço operacional: indicadores e análise no topo, ação `+ Novo…` e lista de trabalho abaixo. O formulário abre somente ao criar ou editar um registro.

### Leads

- Filtros iniciais: período por primeiro contato, status, origem e professor experimental.
- KPIs: novos leads, entradas como cliente, conversão do período e leads em ação. “Em ação” reúne os status `Novo`, `Em contato`, `Esfriando`, `Experimental agendado` e `Experimental realizado`; exclui `Convertido` e `Perdido`.
- Linha temporal: primeiros contatos versus entradas como cliente, por período.
- Funil: quantidade de Leads por status manual.
- Lista: nome, primeiro contato, status destacado, origem, plano, valor e botão de WhatsApp; minirrelatório aparece no detalhe.
- O telefone é normalizado no navegador apenas para montar o link do WhatsApp.

O indicador de conversão do período é `entradas como cliente no período / primeiros contatos no período`. Ele descreve o movimento do período e não uma coorte fechada de conversão.

### Churns

- Filtro inicial: período por data de saída; polo permanece fixo em Wellness Club.
- KPIs: saídas, registros com motivo preenchido e registros com ação de retenção preenchida.
- Gráfico temporal: saídas por período.
- Lista: aluno, ID, data de saída e acesso ao detalhe com os três textos completos.
- Não haverá ranking de motivos nem classificação automática dos textos livres nesta primeira versão.
- A exclusão exige confirmação explícita e é irreversível; é destinada a registros de churn criados por engano.

## Backend e integridade

- `CONFIG` receberá nomes de abas e cabeçalhos dos dois fluxos.
- `garantirEstruturaPlanilha()` criará as abas e seus cabeçalhos sem apagar valores existentes; a importação semanal continuará sem tocar nelas.
- O repositório de dashboard terá leitura tipada e validação de cabeçalhos para Fluxo.
- As operações entrarão na mesma rotina de mutações do dashboard, protegida por `LockService`, `requestId` idempotente e incremento de versão após êxito.
- Operações: criar/editar Lead, criar/editar Churn e excluir Churn. A exclusão de Lead não será aceita pelo backend.
- Validações: objeto esperado, IDs existentes para edição/exclusão, textos dentro de limites, datas válidas, campos obrigatórios, status e plano permitidos e valor do pacote vazio ou numérico não negativo.
- `criado_em` é preservado durante edição; `atualizado_em` é sempre renovado.

## Privacidade e erros

O telefone de Lead é uma exceção deliberada à regra geral do payload sem contato: é enviado somente no dado de Fluxo exibido ao usuário autenticado do dashboard, pois é requisito para abrir WhatsApp. Nenhum telefone ou nome real será colocado em fixtures, testes ou documentação.

Falhas de validação retornam mensagem segura e não escrevem parcialmente. Falhas de cache não impedem a leitura da planilha. A interface restaura a alteração na fila se a gravação falhar e informa o erro; exclusões só saem visualmente da lista após confirmação do backend.

## Testes

- Estrutura: criação e preservação de `FLUXO_LEADS` e `FLUXO_CHURNS` após `garantirEstruturaPlanilha()` e após importação.
- Mutações: criação, edição, idempotência, validações e auditoria de timestamps de Lead e Churn.
- Exclusão: Churn pode ser removido com request válido; Lead é recusado; repetição da mesma requisição é idempotente.
- Métricas: período, funil, conversão do período, série temporal de Leads e série temporal/completude de Churns.
- Interface: navegação Fluxo, formulários, status, link de WhatsApp, confirmação de exclusão e renderização dos detalhes.

## Fora do escopo

- Sincronização de Churn com `BASE_ALUNOS`, `CONTRATOS` ou `VISAO_MESTRE`.
- Automação de status a partir de datas de Leads.
- Exclusão de Leads.
- Ranking e categorização automática das observações de Churn.
- Taxa de churn baseada na população ativa; ela exigirá uma definição de denominador histórico em etapa futura.
