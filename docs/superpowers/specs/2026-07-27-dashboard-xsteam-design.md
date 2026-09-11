# Dashboard XSTEAM — Design do MVP

**Status:** aprovado para especificação; implementação ainda não iniciada.
**Data:** 27/07/2026
**Escopo:** web app Apps Script vinculado à planilha mestre TecnoFit.

## Objetivo

Disponibilizar um dashboard responsivo, de leitura operacional e com identidade XSTEAM, para monitorar planos, vencimentos, prescrições e avaliações. O painel deve ajudar a priorizar ações que reduzam risco de churn e perda de faturamento, sem contaminar o snapshot semanal da base mestre.

## Fora de escopo do MVP

- Dashboard histórico entre lotes ou séries históricas de vencimentos.
- Cadastro/edição de alunos, contratos, fichas ou avaliações.
- Gatilhos automáticos, notificações e cobrança automática.
- Personalização por usuário; a configuração é global.
- Tempo de empresa do aluno; a fonte ainda será definida.

## Arquitetura

O dashboard será um **web app** publicado pelo mesmo projeto Apps Script que atualiza a base mestre. A entrada `TecnoFit > Abrir dashboard` abre o web app em uma nova aba. A sidebar atual permanece dedicada à importação semanal.

O `doGet()` entrega o shell HTML. O cliente chama funções Apps Script assíncronas para obter bootstrap, configurações e gravações. A implementação deve seguir os padrões de HTML Service e `google.script.run` descritos na documentação oficial:

- https://developers.google.com/apps-script/guides/html
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/html/communication

O único código oficial será mantido na raiz `main`; não criar worktree ou cópia paralela para este dashboard.

### Fonte de dados

| Fonte | Uso no dashboard | Regra |
|---|---|---|
| `BASE_ALUNOS` | aluno, status, contato não exibido, datas de ficha e avaliação | snapshot vigente |
| `CONTRATOS` | valores, frequência, vencimentos, plano, polo, modalidade | uma linha por contrato |
| `VISAO_MESTRE` | leitura complementar quando necessária | não é fonte de escrita |
| `IMPORTACOES` | data/revisão da última importação bem-sucedida e versão da base | metadado de atualização |
| `CONFIG_DASHBOARD` | filtros padrão e cartões da Home | persistente; escrita só pelo app de configurações |
| `CONFIG_ALERTAS` | limites de idade de prescrição/avaliação | persistente; escrita só pelo app de configurações |
| `GESTAO_PAGAMENTOS` | perfil e observação de pagamento por ID | persistente; escrita só pelo app de configurações |

O payload do cliente não deve incluir contato nem colunas pessoais que não sejam usadas no dashboard.

### Abas persistentes criadas pelo backend

O backend garante que estas abas existam, tenham cabeçalhos e nunca sejam substituídas pela rotina semanal de importação. A importação semanal também atualiza uma versão persistente do dashboard quando concluir com sucesso. A versão muda quando houver nova importação bem-sucedida ou gravação em qualquer uma das três abas persistentes; ela é usada para invalidar caches com segurança.

#### `CONFIG_DASHBOARD`

Armazena configuração global dos filtros padrão e da Home em uma única tabela:

| tipo | chave | ativo | ordem | valor | titulo | estados |
|---|---|---:|---:|---|---|---|
| global | filtro_status_padrao |  |  | Ativo |  |  |
| global | filtro_polo_padrao |  |  | Wellness |  |  |
| home_card | dados_ausentes | Sim | 1 |  | Dados a regularizar | sem_ficha,sem_avaliacao |

Cada cartão suportado tem identificador fixo, estado ativo, ordem, título e situações selecionadas. O app não oferece um construtor livre de consultas; ele configura cartões de um catálogo controlado. Catálogo inicial: `dados_ausentes`, `prescricoes_criticas`, `avaliacoes_criticas`, `vencidos_5_dias`, `vencem_hoje`, `vencem_5_dias`, `operacao_prescricoes_em_dia`, `operacao_avaliacoes_em_dia` e `radar_valor_em_atencao`.

#### `CONFIG_ALERTAS`

| regra | verde_ate | laranja_ate | vermelho_ate | roxo_ate |
|---|---:|---:|---:|---:|
| prescricoes | 90 | 180 | 270 | vazio |
| avaliacoes | 90 | 120 | 180 | 270 |

Os valores devem ser inteiros positivos e estritamente crescentes. O estado `sem dado` não é configurável e sempre possui prioridade máxima.

#### `GESTAO_PAGAMENTOS`

| id | aluno | perfil_pagamento | observacao | atualizado_em |
|---|---|---|---|---|

Há exatamente uma linha por ID. O app faz upsert por ID; a importação nunca remove registros, mesmo se o aluno não vier no novo lote.

Perfis iniciais:

1. Sem histórico
2. Bom pagador
3. Pagamento eventual fora do prazo
4. Pagamento frequentemente fora do prazo
5. Cobrança recorrente necessária
6. Em acompanhamento

## Navegação e responsividade

### Desktop

Barra lateral fixa com logo XSTEAM, filtros globais e quatro áreas principais:

1. Home
2. Financeiro
3. Acompanhamento
4. Configurações

Ao abrir `Financeiro`, as subabas são `Planos` e `Vencimentos`. Ao abrir `Acompanhamento`, as subabas são `Prescrições` e `Avaliações`. A área ativa é expandida na lateral e as duas subabas também aparecem como seletor horizontal no conteúdo.

### Mobile

Dock inferior fixo e compacto com quatro botões: Home, Financeiro, Acompanhamento e Configurações. As duas subabas da área selecionada aparecem como dois blocos de largura equivalente no topo do conteúdo. Não há sidebar nem segunda navegação global.

Ao abrir um detalhamento, o mobile usa uma tela/modal de largura total. No desktop, usa modal amplo. Fechar retorna ao KPI ou gráfico de origem e preserva filtros.

## Direção visual XSTEAM

- Fundo preto profundo, texto branco e amarelo-limão XSTEAM como assinatura de marca e ação primária.
- Tipografia condensada/de impacto somente em títulos, grandes números e chamadas; tipografia neutra e confortável para textos operacionais.
- Blocos angulares, bordas firmes, geometria/linhas diagonais discretas e poucos cantos arredondados.
- Laranja, vermelho, roxo e vinho quase preto são exclusivos de estados operacionais; não substituem o amarelo-limão da marca.
- Corpo de texto operacional no mínimo 13–14 px; nomes em 17 px ou mais; detalhes secundários aparecem somente após expansão.
- Logo oficial XSTEAM deve substituir o marcador temporário usado nos mockups.

## Filtros globais

Todas as telas, KPIs, gráficos e pop-ups obedecem aos mesmos filtros:

- `status`: padrão `Ativo`;
- `polo`: padrão `Wellness`.

Os filtros ativos permanecem visíveis no cabeçalho. Alterá-los recalcula a interface no cliente, sem nova leitura da planilha enquanto o payload atual estiver válido.

## Regras de negócio

### Valor e contratos múltiplos

- Faturamento é a soma de valores dos contratos que passam pelos filtros.
- Valor por aula = `valor mensal do plano ÷ (frequência semanal × 4,33)`.
- Para risco/receita associada a um aluno, somar todos os seus contratos atuais incluídos no filtro.
- A interface agrupa detalhamentos por ID, mas revela todos os contratos expansíveis.
- KPIs de vencimento distinguem explicitamente alunos únicos e contratos.

### Prescrições

Idade calculada sempre contra a data atual de abertura do app.

| Estado | Dias desde a ficha |
|---|---:|
| Verde | até 90 |
| Laranja | 91–180 |
| Vermelho | 181–270 |
| Roxo | acima de 270 |
| Sem ficha registrada | prioridade máxima |

### Avaliações

Idade calculada sempre contra a data atual de abertura do app.

| Estado | Dias desde a avaliação |
|---|---:|
| Verde | até 90 |
| Laranja | 91–120 |
| Vermelho | 121–180 |
| Roxo | 181–270 |
| Falha crítica de processo | acima de 270 |
| Sem avaliação registrada | prioridade máxima |

`Sem ficha registrada` e `Sem avaliação registrada` têm prioridade máxima, mas são rótulos de ausência de dado/processo e não idades calculadas.

### Vencimentos

Não usar o termo “atraso” como indicador do dashboard. Exibir:

- contratos/alunos que venceram nos últimos 5 dias;
- contratos/alunos que vencem hoje;
- contratos/alunos que vencem nos próximos 5 dias;
- linha do tempo dos 11 dias (5 anteriores, hoje e 5 posteriores);
- mapa mensal por faixas fixas: dias 1–7, 8–15, 16–23 e 24–fim.

O MVP exibe a distribuição do lote vigente; não cria evolução histórica entre semanas/meses.

### Prioridades da Home

A Home é configurável, não uma cópia fixa das outras páginas. O catálogo de cartões permite ativar/desativar, ordenar e selecionar estados para cada recorte.

Ordenação dentro de um cartão de ação:

1. gravidade da situação;
2. valor mensal total do aluno;
3. desempate estável por nome/ID.

A Home combina:

- ações da semana: dados ausentes, prescrições/avaliações em estado de ação e vencimentos;
- leitura positiva: percentuais de prescrições e avaliações verdes;
- radar de valor em atenção;
- detalhamentos sempre por modal, nunca listas grandes na tela inicial.

## Páginas e análises

### Home

Resumo configurável da estratégia vigente. Mostra apenas cartões ativos definidos em `CONFIG_DASHBOARD`, indicadores positivos e blocos acionáveis. Cada cartão abre detalhe filtrado.

### Financeiro > Planos

- faturamento mensal;
- alunos únicos;
- contratos;
- ticket médio por aluno;
- valor por aula;
- distribuição de alunos, contratos e faturamento por frequência semanal;
- nome completo do plano disponível no detalhamento, não como agrupamento principal.

### Financeiro > Vencimentos

- três cartões operacionais (5 dias anteriores, hoje, 5 dias seguintes);
- linha do tempo de 11 dias;
- mapa mensal em quatro faixas fixas;
- quantidade de alunos e contratos em todos os recortes;
- detalhamento por aluno e contratos expansíveis.

### Acompanhamento > Prescrições

- KPIs de verde, laranja, crítico (vermelho/roxo), sem ficha e faturamento associado à ação;
- gráfico de distribuição por faixa de dias;
- detalhes com data/falta de data, perfil de pagamento, contratos e valor mensal total.

### Acompanhamento > Avaliações

- KPIs de verde, laranja, crítico (vermelho/roxo), falha crítica, sem avaliação e faturamento associado à ação;
- gráfico de distribuição por faixa de dias;
- detalhes com data/falta de data, perfil de pagamento, contratos e valor mensal total.

### Configurações

Três seções:

1. **Home:** cartões ativos, ordem, título e estados incluídos;
2. **Alertas:** dias de corte das duas regras, com validação crescente;
3. **Pagamentos:** busca por nome/ID, seleção de perfil, observação opcional e salvamento por upsert.

As configurações são globais. O app grava somente as três abas persistentes; não altera as abas de snapshot do lote.

## Detalhamentos

Todo KPI, cartão e segmento de gráfico deve abrir um detalhamento. O padrão contém:

- título e origem do recorte;
- total de alunos, contratos e faturamento associado quando aplicável;
- chips dos estados incluídos e filtros globais ativos;
- aluno, situação/data, valor mensal, perfil de pagamento e contagem de contratos;
- expansão dos contratos com plano, frequência, valor e vencimento;
- busca local e ordenação local quando a lista for grande.

## Desempenho e consistência

### Bootstrap e cache

1. O shell, logo e loading são renderizados imediatamente.
2. Sem cache válido, a splash XSTEAM anima a barra até 95% em aproximadamente 2 segundos; completa somente com o bootstrap real. Não atrasar artificialmente uma resposta rápida. Se a espera passar de 5 segundos, mostrar mensagem de carregamento demorado.
3. O bootstrap traz somente os dados necessários para todas as páginas e uma `versao_base` derivada da última importação/configuração.
4. O cliente guarda o payload sem contatos em memória e em cache persistente do navegador, indexado pela versão.
5. Em reaberturas, renderiza o cache imediatamente e consulta apenas a versão em segundo plano. Em divergência, baixa o bootstrap novo e atualiza a tela de modo discreto.
6. Filtros, subabas, gráficos, busca e pop-ups operam localmente no payload válido.

O backend pode usar `CacheService` para bootstrap/sumários, sem depender dele para integridade. O cache do Apps Script pode expirar ou ser removido antes do prazo, portanto a planilha e a versão persistida são a autoridade.

### Gravações

- Alterações de Home/Alertas/Pagamentos atualizam a interface de forma otimista.
- Cliente mantém uma fila sequencial de mutações; patches próximos são agrupados antes do envio.
- Cada mutação usa identificador idempotente e estado de pendência.
- Backend valida o lote de alterações, usa `LockService.getScriptLock()`, grava em batch e responde com a configuração normalizada e nova versão.
- Falhas preservam a alteração como pendente, mostram estado claro e tentam novamente; o usuário pode reenviar manualmente.
- Duplo clique ou várias ações rápidas não podem criar duplicidade, especialmente no upsert de `GESTAO_PAGAMENTOS`.

## Estados da interface

- **Carregando:** splash/placeholder, sem tela em branco.
- **Carregamento demorado:** mensagem clara após 5 segundos, mantendo a barra em progresso.
- **Sem resultado:** explicar que o filtro não retornou registros e oferecer limpeza de filtro.
- **Erro de leitura:** mensagem não técnica com ação “Tentar novamente”.
- **Gravação pendente:** indicador discreto; o app continua navegável.
- **Base:** cabeçalho mostra data/hora da última importação bem-sucedida.

## Segurança e acesso

- Inicialmente, somente o usuário proprietário opera o dashboard e suas configurações globais.
- O deployment do web app deve restringir acesso à conta autorizada, de acordo com a opção disponível na conta Google.
- Não incluir contato no cache/payload do cliente.
- Não expor detalhes técnicos de erros ao usuário final.

## Testes e critérios de aceite

### Testes unitários

- classificação de prescrição e avaliação em cada fronteira de dias;
- ausência de data como prioridade máxima;
- cálculo de valor por aula usando 4,33;
- agrupamento por ID com múltiplos contratos;
- distinção de aluno único e contrato em vencimentos;
- faixas mensais e janela de 11 dias;
- filtros globais aplicados antes de métricas/detalhes;
- validação de `CONFIG_ALERTAS` crescente;
- upsert de perfil de pagamento sem duplicidade;
- ordenação transparente por gravidade e valor mensal;
- invalidação de cache por mudança de versão;
- fila de mutações, retry e idempotência.

### Validação manual

- Abrir pelo menu do Sheets em desktop e mobile.
- Confirmar responsividade e navegação aprovada.
- Conferir uma amostra de valores, datas, contratos múltiplos e perfis contra a planilha.
- Alterar um cartão da Home, um prazo e um perfil de pagamento; confirmar persistência e atualização da interface.
- Simular falha de rede/chamada e duas gravações rápidas.
- Executar importação semanal e confirmar que `CONFIG_DASHBOARD`, `CONFIG_ALERTAS` e `GESTAO_PAGAMENTOS` permanecem preservadas; a próxima abertura deve detectar nova versão.

## Critérios de aceite do MVP

O MVP está pronto quando:

1. Abre como web app pelo menu da planilha, com layout desktop/mobile definido.
2. Filtros padrão `Ativo` e `Wellness` alcançam todas as métricas, gráficos e detalhes.
3. Financeiro e Acompanhamento apresentam as análises definidas e todos os detalhes em modal/tela de detalhes.
4. Home respeita configuração global de cartões, ordem e estados.
5. Prazos de alerta são validados e persistidos.
6. Perfil de pagamento é criado/atualizado pelo app e sobrevive às importações.
7. Ausência de ficha/avaliação aparece como prioridade máxima e com rótulo próprio.
8. Cache e fila de gravação evitam carregamentos e travamentos repetidos, preservando consistência.
9. Estados de loading, vazio, erro e pendência são claros.

## Pendências deliberadamente pós-MVP

- fonte e análise de tempo de empresa;
- histórico de ausentes do lote e séries históricas entre importações;
- perfil/personalização por usuário;
- revisão dos KPIs após semanas de uso;
- campos adicionais em `GESTAO_PAGAMENTOS`.
