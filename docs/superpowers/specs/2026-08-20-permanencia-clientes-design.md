# Permanência de clientes e indicadores associados a LTV

**Data:** 20/08/2026
**Estado:** desenho aprovado em conversa; aguardando revisão do documento

## Objetivo

Incorporar o relatório **Clientes por permanência** à atualização da base TecnoFit para registrar a primeira entrada conhecida de cada aluno, começar a construir um histórico confiável de mudanças e disponibilizar uma terceira subaba em **Financeiro > Permanência**.

Nesta etapa, os indicadores associados a LTV serão deliberadamente conservadores. O sistema mostrará separadamente o tempo de relacionamento e o pacote atual do aluno. Não multiplicará a mensalidade ou o valor atual pelo tempo na empresa, pois não há histórico suficiente de preços, planos, pausas, inadimplência ou pagamentos realizados.

## Princípios aprovados

- `Cliente desde` representa a primeira entrada histórica conhecida e não reinicia quando o aluno cancela e retorna.
- A associação entre relatórios será feita pelo código do aluno, nunca pelo nome.
- A população operacional de `BASE_ALUNOS` continuará sendo definida pelo relatório de vencimentos.
- Alunos cancelados e demais registros históricos do relatório de permanência não serão adicionados artificialmente à população operacional atual.
- Um aluno histórico não será apagado por desaparecer de uma atualização futura.
- O sistema preservará a menor data válida já conhecida para o aluno.
- O relatório completo deve ser exportado, incluindo ativos, bloqueados, alunos em licença, cancelados e excluídos.
- Não haverá cálculo de LTV estimado, receita histórica ou receita por coorte.
- O valor do pacote atual será exibido apenas como uma informação separada do tempo de relacionamento.

## Arquivo analisado e carga inicial

O arquivo fornecido para a carga inicial é `clientes por permanencia (07_08).xls`. Ele é um relatório HTML com extensão `.xls` e contém os cabeçalhos:

- `Código`;
- `Cliente`;
- `Cliente desde`;
- `Status atual`;
- `Continuidade (meses)`;
- `Contratos`.

A inspeção identificou 980 cadastros reais, todos com código único e data no formato brasileiro. A linha adicional `Total: 980` é um rodapé e não representa um cadastro.

A carga inicial terá referência de **07/08/2026** e será executada diretamente a partir do arquivo fornecido. Ela não exigirá que o usuário copie células, envie novamente os outros três relatórios ou preencha a planilha mestre manualmente. Dados pessoais reais não serão incluídos no Git, em fixtures ou em testes automatizados.

## Lotes futuros

Após a implantação, um lote semanal válido conterá exatamente quatro relatórios com a mesma data de referência e a mesma revisão:

```text
vencimentos_AAAA-MM-DD_rNN.xls
fichas_AAAA-MM-DD_rNN.xls
avaliacao_fisica_AAAA-MM-DD_rNN.xls
permanencia_AAAA-MM-DD_rNN.xls
```

Arquivos `.xlsx` continuarão aceitos. O formato real será detectado pelo conteúdo, como já ocorre com os três relatórios atuais.

Exemplo:

```text
vencimentos_2026-08-21_r01.xls
fichas_2026-08-21_r01.xls
avaliacao_fisica_2026-08-21_r01.xls
permanencia_2026-08-21_r01.xls
```

O PDF operacional reservado poderá permanecer em `01_ENTRADA`. Nenhum outro arquivo operacional poderá coexistir com o lote. O botão **Atualizar base** somente ficará disponível quando os quatro relatórios estiverem presentes e válidos.

Quando um lote já processado precisar de correção, todos os quatro arquivos usarão a revisão seguinte, por exemplo `r02`. Depois do sucesso, os quatro arquivos serão renomeados de forma canônica e arquivados juntos em `02_PROCESSADOS`.

## Modelo de dados

### `BASE_PERMANENCIA`

Uma linha por aluno, representando o estado mais recente conhecido:

| Campo | Uso |
|---|---|
| `id` | Código normalizado do aluno e chave de associação |
| `aluno` | Nome mais recente recebido no relatório |
| `cliente_desde` | Menor primeira entrada válida já conhecida |
| `status_permanencia` | Status bruto mais recente do relatório |
| `continuidade_meses_origem` | Valor informado pelo relatório, preservado para auditoria |
| `quantidade_contratos_origem` | Quantidade histórica informada pelo relatório |
| `primeira_observacao_em` | Primeira referência em que o ID foi encontrado |
| `ultima_observacao_em` | Referência mais recente em que o ID foi encontrado |
| `presente_ultimo_lote` | Indica se o ID apareceu na atualização mais recente |
| `importacao_id` | Execução que produziu o estado mais recente |

`Continuidade (meses)` será armazenada, mas não será usada como substituta de `Cliente desde` nem como tempo calculado. A amostra demonstrou que esse campo pode representar uma regra comercial diferente do tempo já transcorrido.

### `HISTORICO_PERMANENCIA`

Registro imutável somente de eventos relevantes, evitando duplicar aproximadamente 980 linhas a cada atualização:

| Campo | Uso |
|---|---|
| `evento_id` | Identificador único e idempotente do evento |
| `id` | Código do aluno |
| `data_referencia` | Data do lote que revelou a mudança |
| `tipo_evento` | Natureza da mudança |
| `campo` | Campo alterado, quando aplicável |
| `valor_anterior` | Valor conhecido antes da atualização |
| `valor_novo` | Valor recebido na atualização |
| `importacao_id` | Execução responsável pelo evento |
| `registrado_em` | Data e hora da gravação |

Eventos previstos:

- `CARGA_INICIAL`;
- `NOVO_ALUNO`;
- `ALTERACAO_STATUS`;
- `CORRECAO_CLIENTE_DESDE`;
- `ALTERACAO_CONTINUIDADE`;
- `ALTERACAO_CONTRATOS`;
- `AUSENTE_NO_LOTE`;
- `REAPARECIMENTO`.

A carga inicial produzirá um evento `CARGA_INICIAL` por aluno. Nas atualizações seguintes, somente diferenças reais gerarão novos eventos. Reprocessar a mesma importação não poderá duplicar eventos.

### Enriquecimento das bases atuais

Para IDs presentes em `BASE_ALUNOS`, o campo atualmente reservado a `inicio_plano` será preenchido a partir de `cliente_desde` e exposto no PWA com o rótulo **Cliente desde**. A mesma informação será propagada para `VISAO_MESTRE` sem alterar a quantidade de alunos ou contratos.

O status de permanência ficará separado do status operacional proveniente de vencimentos. Nenhum dos dois substituirá silenciosamente o outro.

## Regras de consolidação

1. Normalizar o código do aluno conforme as regras já usadas nos outros relatórios.
2. Ignorar explicitamente rodapés no formato `Total: N`, com ou sem a palavra `registros`.
3. Exigir código único dentro do relatório de permanência.
4. Interpretar `Cliente desde` como data brasileira `dd/MM/yyyy`.
5. Se a nova data for anterior à armazenada, atualizar para a data anterior e registrar `CORRECAO_CLIENTE_DESDE`.
6. Se a nova data for posterior à armazenada, preservar a data histórica anterior e emitir um diagnóstico, evitando que um retorno ou mudança de relatório apague a primeira entrada.
7. Atualizar status, continuidade e quantidade de contratos conforme o relatório mais recente, registrando os eventos correspondentes.
8. Marcar como ausentes os alunos não encontrados no lote, sem removê-los.
9. Ao reaparecer, restaurar `presente_ultimo_lote` e registrar `REAPARECIMENTO`.
10. Alunos sem correspondência na base operacional permanecem disponíveis apenas nas estruturas de permanência e nas análises históricas.

## Proteções do lote

O lote inteiro continuará transacional. Nenhuma aba definitiva poderá permanecer parcialmente atualizada após uma falha.

A atualização será bloqueada quando houver:

- arquivo obrigatório ausente ou arquivo operacional adicional;
- data ou revisão divergente entre os quatro relatórios;
- cabeçalhos obrigatórios ausentes;
- códigos duplicados;
- conteúdo que não seja tabela HTML/XLS ou XLSX válido;
- redução superior a 20% da população conhecida de permanência;
- relatório contendo somente ativos quando a base anterior possuía outros status históricos.

Uma data inválida associada a um código real será registrada como aviso e não substituirá uma data anterior válida. O rodapé do relatório não contará como linha rejeitada.

Antes da substituição, o backup passará a incluir as duas novas abas. Em caso de erro após o início da gravação, `BASE_ALUNOS`, `CONTRATOS`, `VISAO_MESTRE`, `BASE_PERMANENCIA` e `HISTORICO_PERMANENCIA` serão restauradas conjuntamente.

## Conceitos analíticos

### Tempo de relacionamento

Será calculado dinamicamente a partir de `cliente_desde`, sem persistir um número que envelhece na planilha. A interface exibirá anos e meses completos, por exemplo `2 anos e 4 meses`.

Faixas padrão:

- até 3 meses;
- 4 a 6 meses;
- 7 a 12 meses;
- 13 a 24 meses;
- 25 meses ou mais.

### Coorte de entrada

Cada aluno com data válida pertencerá à coorte mensal `AAAA-MM` de sua primeira entrada conhecida.

### Retenção observada

Para manter consistência com o filtro já existente, serão considerados **Matriculados** os status normalizados como:

- Ativo;
- Bloqueado;
- Licença ou Em licença.

Cancelados e excluídos não serão considerados retidos.

```text
retenção observada = matriculados da coorte ÷ alunos conhecidos da coorte
```

O rótulo será sempre **Retenção observada**, pois o relatório é um retrato do cadastro e não um histórico financeiro ou causal completo.

### Informações monetárias

A subaba não calculará:

- LTV estimado;
- valor atual multiplicado pelo tempo;
- receita histórica;
- receita por faixa de permanência;
- receita por coorte.

No detalhe individual, serão mostrados separadamente o tempo na empresa e cada pacote atual com seu respectivo valor. Se houver mais de um contrato atual, os contratos serão listados separadamente, sem criar uma reconstrução histórica.

## PWA — Financeiro > Permanência

`Permanência` será a terceira subaba de Financeiro:

```text
Planos | Vencimentos | Permanência
```

As subabas existentes serão preservadas. A Home continuará orientada às filas operacionais de fichas e avaliações e não receberá cartões de LTV ou permanência.

### Leitura executiva

- cobertura da data de entrada entre os alunos do recorte atual;
- tempo mediano de relacionamento;
- quantidade de alunos por faixa de permanência;
- retenção observada por coorte;
- alunos novos, ausentes e com mudança de status no último lote.

### Análises

- distribuição de alunos por faixa de permanência;
- coortes mensais de entrada;
- matriculados versus cancelados por coorte;
- evolução dos eventos de mudança de status acumulados a partir da implantação.

Gráficos e blocos de coorte serão interativos. O clique abrirá o recorte correspondente usando o diálogo de detalhes já existente.

### Lista e perfil do aluno

Cada item mostrará:

- aluno;
- cliente desde;
- tempo na empresa;
- status atual;
- coorte de entrada;
- quantidade histórica de contratos informada pelo relatório;
- pacote ou pacotes atuais;
- valor individual de cada pacote atual.

O perfil existente do aluno receberá o mesmo resumo. Não haverá soma histórica nem multiplicação monetária.

### Filtros e responsividade

- Os filtros globais de status e polo continuarão funcionando para os alunos e contratos atuais.
- A análise histórica preservará todos os IDs do escopo do relatório, mesmo quando não houver contrato atual.
- A subaba seguirá os estados de carregamento, vazio e erro já usados no PWA.
- No desktop, os três destinos compartilharão o seletor horizontal existente.
- No celular, os três botões permanecerão acessíveis sem rolagem lateral obrigatória e os detalhes usarão a visualização de tela cheia existente.

## Operação futura

O trabalho manual ficará limitado a:

1. exportar os quatro relatórios completos;
2. nomeá-los com a mesma data e revisão;
3. colocá-los em `01_ENTRADA`;
4. aguardar o término dos uploads;
5. abrir o menu da planilha, conferir o lote e clicar uma única vez em **Atualizar base**.

O POP em HTML/PDF, as instruções de instalação e a inspeção exibida na barra lateral serão atualizados para quatro arquivos.

## API, versão e cache

O bootstrap público incluirá a base de permanência necessária para os filtros, análises e perfis, sem expor campos adicionais desnecessários. A API continuará validando o formato antes de responder.

Uma importação bem-sucedida incrementará a versão do dashboard. O PWA invalidará o cache antigo e carregará a nova estrutura automaticamente. Clientes com cache incompatível não poderão tratar a ausência de permanência como um conjunto válido silenciosamente.

## Testes e critérios de aceitação

### Parser e lote

- reconhecer o quarto tipo e os seis cabeçalhos reais;
- aceitar HTML/XLS e XLSX;
- ignorar `Total: 980` e variações equivalentes;
- exigir quatro arquivos com data e revisão comuns;
- rejeitar tipo repetido, duplicidade de ID e lote extra ou incompleto;
- detectar redução abrupta e exportação filtrada apenas por ativos.

### Consolidação e histórico

- criar 980 estados e 980 eventos na carga inicial sintética equivalente;
- associar por ID e nunca por nome;
- preservar a menor data histórica;
- registrar mudança de status e quantidade de contratos;
- marcar ausência sem apagar;
- registrar reaparecimento;
- impedir duplicação de eventos no reprocessamento;
- restaurar as cinco bases gerenciadas após falha.

### Métricas

- calcular meses completos e as cinco faixas nos limites exatos;
- calcular mediana com população par, ímpar e vazia;
- formar coortes mensais;
- normalizar Ativo, Bloqueado e Licença como Matriculados;
- excluir cancelados e excluídos da retenção observada;
- não multiplicar tempo por valor nem expor campos de LTV estimado.

### PWA

- exibir `Permanência` como terceira subaba de Financeiro;
- preservar Planos, Vencimentos, filtros globais e demais páginas;
- abrir detalhes por faixa e coorte;
- mostrar pacotes atuais individualmente;
- apresentar estados de cobertura parcial, vazio e erro;
- funcionar em desktop e celular;
- atualizar corretamente após mudança de versão e cache.

### Validação da carga real

1. Confirmar 980 IDs únicos na fonte enviada.
2. Executar a carga inicial sem exigir edição manual da planilha.
3. Informar quantos IDs foram associados à população operacional e quantos permaneceram somente no histórico.
4. Conferir amostras de datas e status sem inserir dados pessoais nos testes ou commits.
5. Comparar cobertura, faixas e coortes com cálculos independentes.
6. Executar toda a suíte automatizada existente e os novos testes.
7. Publicar Apps Script e PWA.
8. Verificar os endpoints públicos e a terceira subaba em desktop e celular.
9. Confirmar que a carga incrementou a versão e que o PWA não está exibindo cache anterior.

## Fora do escopo

- LTV realizado ou estimado;
- reconstrução de preços e planos históricos;
- histórico de pagamentos e inadimplência;
- atribuição causal de churn;
- redefinição da primeira entrada após retorno;
- edição manual dos dados de permanência pelo PWA;
- automação agendada sem confirmação do lote completo.
