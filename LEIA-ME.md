# Base Central TecnoFit

Documento de configuração, organização e uso da base central de alunos e contratos.

- Versão do documento: 1.0
- Data de referência: 10/07/2026
- Fuso horário do projeto: `America/Fortaleza`
- Formato de exibição das datas: `dd/MM/yyyy`

## 1. Objetivo

Este projeto consolida três relatórios exportados pelo sistema TecnoFit em uma base central no Google Sheets:

- `vencimentos`: fonte principal dos alunos e contratos;
- `fichas`: fonte dos contatos e das datas das fichas;
- `avaliacao_fisica`: fonte das datas das avaliações físicas.

A base central é a fonte do dashboard implementado em Google Apps Script. O processo deve ser repetível, auditável e seguro: um arquivo semanal inválido não pode apagar ou corromper a última base válida.

## 2. Estrutura no Google Drive

Criar a seguinte estrutura:

```text
TECNOFIT_BASE_CENTRAL/
│
├── TecnoFit_Base_Mestre
│
├── 01_ENTRADA/
│
├── 02_PROCESSADOS/
│   └── AAAA/
│       └── AAAA-MM-DD/
│
├── 03_REJEITADOS/
│   └── AAAA/
│       └── AAAA-MM-DD/
│
└── 04_DOCUMENTACAO/
    └── LEIA-ME.md
```

### 2.1 Pasta principal

Nome recomendado:

```text
TECNOFIT_BASE_CENTRAL
```

A pasta deve pertencer a uma conta institucional ou administrativa permanente. Depois que o Apps Script for configurado, não excluir nem recriar suas subpastas: o script localizará cada uma pelo identificador do Google Drive.

### 2.2 Planilha mestre

Criar, na raiz da pasta principal, um Google Sheets permanente chamado:

```text
TecnoFit_Base_Mestre
```

Não colocar data, revisão ou palavras como `novo` e `final` no nome. A planilha será sempre a mesma; somente seus dados serão atualizados.

## 3. Abas da planilha mestre

Manter exatamente estes nomes:

```text
BASE_ALUNOS
CONTRATOS
VISAO_MESTRE
IMPORTACOES
```

Não renomear as abas depois que a automação for configurada.

### 3.1 `BASE_ALUNOS`

Contém uma linha por aluno. O campo `id` é único nesta aba.

| Campo | Regra |
|---|---|
| `id` | Código do aluno; chave de integração entre os relatórios |
| `aluno` | Nome obtido de `vencimentos` |
| `contato` | Coluna L de `fichas` |
| `status` | Status do cliente obtido de `vencimentos` |
| `inicio_plano` | Mantido vazio nesta primeira versão |
| `data_ficha` | Coluna D de `fichas` |
| `data_avaliacao` | Coluna C de `avaliacao_fisica` |
| `importacao_id` | Identificador da execução que atualizou a linha |

Regras:

- `vencimentos` define quais alunos participam da base atual;
- se um ID não for localizado em `fichas` ou `avaliacao_fisica`, o campo correspondente fica vazio;
- se houver mais de uma ficha ou avaliação para o mesmo ID, usar a data válida mais recente;
- não descartar o aluno por falta de contato, ficha ou avaliação.

### 3.2 `CONTRATOS`

Contém uma linha por contrato. Um aluno pode aparecer mais de uma vez.

| Campo | Regra |
|---|---|
| `_chave_contrato` | Chave técnica do contrato |
| `id` | Código do aluno |
| `contrato_completo` | Texto integral da coluna Contrato de `vencimentos` |
| `contrato_x_sem` | Primeiro segmento do contrato, como `2X` |
| `valor` | Valor numérico do contrato |
| `inicio_corrente` | Coluna Início de `vencimentos` |
| `vencimento` | Data de vencimento do contrato |
| `status_contrato` | Status específico do contrato |
| `polo` | Segundo segmento do contrato |
| `modalidade` | Modalidade original de `vencimentos` |
| `importacao_id` | Identificador da execução que atualizou a linha |

Exemplo de separação:

```text
Contrato original: 2X - XSTEAM WELLNESS CLUB - PERSONAL (2025)
contrato_x_sem:     2X
polo:               XSTEAM WELLNESS CLUB
```

O texto completo deve permanecer em `contrato_completo`, mesmo quando partes dele não forem exibidas na visão mestre.

### 3.3 `VISAO_MESTRE`

É a visão consolidada consumida pelo dashboard. Ela contém uma linha por contrato; por isso, IDs com vários contratos aparecem em várias linhas.

| Coluna | Campo | Origem ou regra |
|---|---|---|
| A | `id` | Código do aluno |
| B | `aluno` | `BASE_ALUNOS` |
| C | `contato` | `BASE_ALUNOS` |
| D | `status` | Status do cliente em `BASE_ALUNOS` |
| E | `contrato_x_sem` | `CONTRATOS` |
| F | `valor` | `CONTRATOS`; armazenado como número |
| G | `inicio_plano` | Vazio nesta primeira versão |
| H | `inicio_corrente` | `CONTRATOS` |
| I | `vencimento` | `CONTRATOS` |
| J | `polo` | `CONTRATOS` |
| K | `data_ficha` | `BASE_ALUNOS` |
| L | `data_avaliacao` | `BASE_ALUNOS` |
| M | `_chave_contrato` | Coluna técnica oculta e protegida |

As colunas com dados do aluno se repetem quando ele possui vários contratos. No dashboard:

- total de alunos deve usar a contagem distinta de `id`;
- total de contratos deve contar as linhas ou as chaves de contrato;
- valor contratado deve somar a coluna `valor`;
- análises por polo podem contar o mesmo aluno em mais de um polo.

### 3.4 Chave técnica do contrato

A chave será construída com:

```text
ID | CONTRATO_COMPLETO_NORMALIZADO | INICIO_CORRENTE_EM_AAAA-MM-DD
```

Exemplos:

```text
2321|2X-XSTEAM-WELLNESS-CLUB-PERSONAL-2025|2026-06-08
2321|2X-GREENLIFE-CT-PERSONAL-2025|2026-06-08
2321|1X-VOUCHER-PERSONAL|2026-06-08
```

Normalização do contrato:

- remover espaços no início e no fim;
- converter para maiúsculas;
- remover acentos;
- substituir sequências de caracteres especiais e espaços por `-`;
- remover hífens excedentes no início e no fim.

Nome, contato, valor e vencimento não participam da chave. Assim, uma alteração nesses campos não cria um contrato novo. Se duas linhas produzirem exatamente a mesma chave em um mesmo arquivo, a automação deve sinalizar a duplicidade; somente quando comprovadamente legítimas poderá acrescentar um sufixo de ocorrência, como `|02`.

A coluna M de `VISAO_MESTRE` deve ficar oculta e protegida contra edição manual.

### 3.5 `IMPORTACOES`

É o registro de auditoria das execuções. Ela não recebe cópias integrais dos três relatórios.

Cada arquivo processado ocupa uma linha:

| Campo | Descrição |
|---|---|
| `execucao_id` | Identificador compartilhado pelos três arquivos do lote |
| `data_hora_inicio` | Início do processamento |
| `data_hora_fim` | Término do processamento |
| `tipo_arquivo` | `vencimentos`, `fichas` ou `avaliacao_fisica` |
| `nome_arquivo` | Nome recebido no Drive |
| `drive_file_id` | Identificador do arquivo no Google Drive |
| `data_referencia` | Data declarada no nome do arquivo |
| `revisao` | Revisão declarada no nome, como `r01` |
| `linhas_lidas` | Total de registros encontrados |
| `linhas_validas` | Registros aceitos |
| `linhas_rejeitadas` | Registros recusados |
| `status` | `PROCESSANDO`, `SUCESSO` ou `ERRO` |
| `mensagem` | Resumo do resultado ou motivo do erro |

Os três registros de uma atualização semanal usam o mesmo `execucao_id`.

## 4. Nomes dos arquivos semanais

Cada atualização deve conter os três arquivos:

```text
vencimentos_AAAA-MM-DD_rNN.xls
fichas_AAAA-MM-DD_rNN.xls
avaliacao_fisica_AAAA-MM-DD_rNN.xls
```

Também são aceitos arquivos com a extensão `.xlsx`:

```text
vencimentos_AAAA-MM-DD_rNN.xlsx
fichas_AAAA-MM-DD_rNN.xlsx
avaliacao_fisica_AAAA-MM-DD_rNN.xlsx
```

Exemplo:

```text
vencimentos_2026-07-10_r01.xls
fichas_2026-07-10_r01.xls
avaliacao_fisica_2026-07-10_r01.xls
```

Regras recomendadas para quem prepara os arquivos:

- usar letras minúsculas;
- não usar espaços ou acentos;
- usar a data de exportação no formato `AAAA-MM-DD`;
- usar revisão com dois dígitos: `r01`, `r02`, `r03`;
- os três arquivos do lote devem ter a mesma data e revisão;
- não usar nomes como `novo`, `final`, `final2`, `corrigido` ou `atualizado`.

O backend aceita, na entrada, datas separadas por hífen ou sublinhado e as extensões `.xls` ou `.xlsx`. Por exemplo, `fichas_2026-07-08_r01.xls`, `fichas_2026_07_08_r01.xls` e `fichas_2026-07-08_r01.xlsx` são reconhecidos. Ao arquivar o lote, o backend normaliza o nome para o padrão com hífens e corrige a extensão quando ela não corresponder ao conteúdo real do arquivo.

### 4.1 Arquivos corrigidos

Se qualquer relatório precisar ser corrigido, enviar novamente o conjunto completo com uma revisão maior.

Exemplo:

```text
vencimentos_2026-07-10_r02.xls
fichas_2026-07-10_r02.xls
avaliacao_fisica_2026-07-10_r02.xls
```

Não misturar `r01` e `r02` no mesmo lote.

## 5. Preservação dos arquivos de origem

Os relatórios do TecnoFit podem ser tabelas HTML de Excel com extensão `.xls` ou arquivos Excel modernos `.xlsx`. Eles devem ser enviados exatamente como foram recebidos; a automação identifica o formato pelo conteúdo, e não apenas pelo nome.

Não fazer antes do upload:

- abrir e salvar novamente no Excel;
- converter para Google Sheets;
- alterar os cabeçalhos;
- inserir, excluir ou reorganizar colunas;
- copiar os dados para outro arquivo;
- alterar manualmente datas, valores ou IDs.

A automação deverá ler o conteúdo original desse formato específico.

## 6. Configuração inicial

1. Criar a pasta `TECNOFIT_BASE_CENTRAL`.
2. Criar as quatro subpastas indicadas neste documento.
3. Criar o Google Sheets `TecnoFit_Base_Mestre`.
4. Criar as quatro abas com os nomes exatos.
5. Colocar este arquivo em `04_DOCUMENTACAO`.
6. Definir uma conta institucional ou administrativa como proprietária.
7. Compartilhar `01_ENTRADA` com quem enviará os relatórios.
8. Restringir a edição da planilha mestre aos responsáveis pela base.
9. Proteger cabeçalhos, fórmulas e colunas técnicas.

Quando o Apps Script for implementado, registrar nas propriedades do projeto:

```text
ID_PLANILHA_MESTRE
ID_PASTA_ENTRADA
ID_PASTA_PROCESSADOS
ID_PASTA_REJEITADOS
FUSO_HORARIO=America/Fortaleza
```

Usar os identificadores do Google Drive, e não apenas os nomes ou caminhos das pastas.

## 7. Rotina semanal

### 7.1 Responsável pelo envio

1. Exportar os três relatórios no mesmo período.
2. Confirmar que pertencem à mesma data de referência.
3. Renomeá-los conforme o padrão do projeto.
4. Confirmar que usam a mesma revisão.
5. Colocar exatamente os três arquivos em `01_ENTRADA`.
6. Informar ao responsável pela atualização que o lote está disponível.

### 7.2 Responsável pela atualização

1. Conferir os nomes, a data e a revisão.
2. Abrir `TecnoFit > Abrir painel` e clicar em `Atualizar base`.
3. Aguardar o término sem editar as abas de dados.
4. Conferir `IMPORTACOES`.
5. Confirmar três registros com status `SUCESSO` e o mesmo `execucao_id`.
6. Conferir a data da última atualização exibida na planilha ou no dashboard.
7. Fazer uma verificação rápida da quantidade de alunos, contratos e valores.

## 8. Fluxo previsto da automação

1. Localizar em `01_ENTRADA` os três arquivos com a mesma data e revisão.
2. Confirmar que o lote ainda não foi processado.
3. Validar os nomes e os cabeçalhos esperados.
4. Ler e normalizar IDs, textos, datas e valores.
5. Separar frequência e polo do contrato completo.
6. Relacionar os relatórios pelo ID do aluno.
7. Validar duplicidades e campos obrigatórios.
8. Montar as novas bases temporariamente em memória.
9. Atualizar as abas definitivas somente se todo o lote for válido.
10. Registrar os resultados em `IMPORTACOES`.
11. Mover o lote para `02_PROCESSADOS/AAAA/AAAA-MM-DD`.

A atualização deve funcionar como uma operação única: se um dos três arquivos falhar, nenhuma aba definitiva será substituída.

## 9. Tratamento de erros

Se um lote for inválido:

1. manter a última base válida sem alterações;
2. registrar `ERRO` em `IMPORTACOES`;
3. informar na coluna `mensagem` o motivo encontrado;
4. mover o conjunto para `03_REJEITADOS/AAAA/AAAA-MM-DD`;
5. corrigir a origem do problema;
6. enviar os três arquivos novamente com uma revisão maior.

Erros que devem impedir a atualização:

- ausência de um dos três arquivos;
- datas ou revisões diferentes dentro do lote;
- cabeçalhos obrigatórios ausentes ou alterados;
- arquivo vazio ou ilegível;
- IDs obrigatórios vazios ou inválidos;
- datas obrigatórias inválidas;
- valores de contrato impossíveis de converter em número;
- duplicidade não explicada da chave técnica;
- falha durante a gravação da planilha mestre.

## 10. Permissões e segurança

Recomendação de acesso:

- proprietário do projeto: acesso total à pasta principal e à planilha mestre;
- administrador que envia relatórios: edição apenas em `01_ENTRADA`;
- usuários do dashboard: leitura do dashboard, sem edição das bases;
- automação: executada pela conta proprietária ou institucional responsável.

Não compartilhar publicamente os relatórios, pois eles contêm dados pessoais. Contatos, avaliações e outras informações dos alunos devem ser acessíveis somente às pessoas autorizadas.

## 11. Checklist antes de cada atualização

- [ ] Existem exatamente três arquivos em `01_ENTRADA`.
- [ ] Os nomes seguem o padrão definido.
- [ ] Os três arquivos possuem a mesma data.
- [ ] Os três arquivos possuem a mesma revisão.
- [ ] Nenhum arquivo foi convertido ou editado manualmente.
- [ ] Não existem arquivos de lotes antigos misturados na entrada.
- [ ] A última base válida continua disponível.

## 12. Checklist depois de cada atualização

- [ ] Há três registros do lote em `IMPORTACOES`.
- [ ] Os três registros têm o mesmo `execucao_id`.
- [ ] Os três registros apresentam status `SUCESSO`.
- [ ] Os arquivos foram movidos para `02_PROCESSADOS`.
- [ ] A quantidade de alunos é plausível.
- [ ] A quantidade de contratos é igual ou maior que a de alunos.
- [ ] Alunos com múltiplos contratos permanecem representados.
- [ ] A data da última atualização foi alterada.

## 13. Regras de manutenção

- Não editar manualmente `CONTRATOS` ou `VISAO_MESTRE`.
- Corrigir dados no sistema de origem e gerar um novo lote.
- Não apagar arquivos de `02_PROCESSADOS`.
- Não reutilizar uma revisão já processada.
- Não alterar nomes de abas, pastas ou cabeçalhos sem atualizar o Apps Script e este documento.
- Registrar neste arquivo qualquer alteração futura do fluxo ou da estrutura de dados.

## 14. Situação atual do projeto

O código-fonte da automação manual do Google Apps Script está disponível em `apps-script/`, acompanhado por testes e instruções de instalação. O backend ainda precisa ser copiado para o editor Apps Script vinculado à planilha e autorizado pela conta proprietária antes da primeira importação real.

O dashboard de gestão está implementado localmente em `apps-script/`, incluindo métricas, páginas, repositório, API e os quatro arquivos HTML da interface. Os testes automatizados locais estão passando. A implantação externa não foi realizada nesta etapa: ainda é necessário copiar o código para o projeto Apps Script vinculado à planilha, publicar o aplicativo da web com acesso restrito aos usuários autorizados e verificar visualmente a URL `/exec` em desktop, tablet e celular.

A validação operacional com dados reais também permanece pendente. Ela só deve ser executada quando os três exports semanais autorizados estiverem disponíveis em uma pasta temporária, sem copiar dados de alunos para o repositório ou para relatórios. Até a implantação e essas verificações serem concluídas, o dashboard deve ser tratado como implementado e verificado por testes locais, mas ainda não homologado no ambiente real. Gatilhos agendados e atualizações automáticas permanecem fora da fase atual. Não substituir manualmente as abas definitivas.

## 15. Arquivos do backend

- `apps-script/00_Config.gs` a `apps-script/08_Main.gs`: módulos do backend.
- `apps-script/Sidebar.html`: painel lateral com o botão de atualização.
- `apps-script/appsscript.json`: manifesto e permissões.
- `apps-script/INSTRUCOES_INSTALACAO.md`: procedimento completo de instalação e primeira execução.
- `tests/`: testes automatizados com dados fictícios.

## 16. Dashboard de gestão implementado

### 16.1 Objetivo e identidade visual

O dashboard prioriza o uso em desktop e também se adapta ao uso ocasional no celular. Cada página combina indicadores e gráficos com uma lista operacional de alunos que precisam de atenção.

A interface segue a identidade visual da XSTEAM: fundo preto ou grafite, textos brancos de alto contraste, verde-limão como cor principal de destaque e ação, tipografia forte, cartões escuros e gráficos objetivos.

### 16.2 Arquitetura e navegação

O dashboard é uma aplicação web única e modular em Google Apps Script. As quatro páginas são carregadas internamente, sem recarregar toda a aplicação.

- desktop: menu lateral, indicadores em grade, gráficos e tabela operacional;
- tablet: menu lateral reduzido e grade em duas colunas;
- celular: navegação inferior, indicadores roláveis, filtros compactos, gráficos empilhados e listas em cartões.

As páginas são:

1. `Vencimentos`;
2. `Fichas prescritas`;
3. `Avaliações`;
4. `Planos dos alunos`.

### 16.3 Conteúdo das páginas

#### `Vencimentos`

- vencidos, próximos 7 dias, próximos 30 dias e valor a renovar;
- vencimentos por semana, distribuição por situação e análise por polo;
- busca por nome ou ID e filtros por polo, status do aluno, período de 30/60/90 dias, situação, frequência, modalidade e status do contrato;
- lista paginada e ordenada por urgência, com contato, frequência, polo, vencimento, situação e valor.

#### `Fichas prescritas`

- alunos com ficha, sem ficha, com ficha desatualizada e cobertura percentual;
- situação das fichas, faixas de idade e cobertura por polo;
- lista prioritária de alunos sem ficha ou com ficha antiga;
- limite inicial configurável de 30 dias para considerar uma ficha desatualizada.

#### `Avaliações`

- alunos avaliados, sem avaliação, com avaliação desatualizada e cobertura percentual;
- situação das avaliações, faixas de idade e cobertura por polo;
- lista prioritária de alunos sem avaliação ou com avaliação antiga;
- limite inicial configurável de 90 dias para considerar uma avaliação desatualizada.

#### `Planos dos alunos`

- alunos distintos, contratos, valor total e ticket médio;
- contratos por polo, frequência semanal, modalidade e status;
- valor contratado por polo;
- tabela paginada com status do aluno, frequência, modalidade, polo, início corrente, vencimento, status do contrato e valor.

### 16.4 Fontes e regras

- `BASE_ALUNOS`: fonte efetiva dos dados únicos do aluno e das datas de ficha e avaliação;
- `CONTRATOS`: fonte efetiva dos detalhes de modalidade, polo, frequência, status, datas e valor;
- `VISAO_MESTRE`: visão consolidada disponível na planilha para conferência e outras integrações, mas não lida pela API atual do dashboard;
- `IMPORTACOES`: data, estado e mensagens da última atualização.

Indicadores de alunos usam contagem distinta de `id`. Indicadores financeiros e de contratos usam `_chave_contrato` distinta para evitar duplicidades.

Os limites de 30 dias para fichas e 90 dias para avaliações são configurações centralizadas. O dashboard exibe esqueletos durante o carregamento e estados próprios de ausência de resultados e erro. O cabeçalho informa a data da última base válida e, quando uma tentativa posterior falha, apresenta um alerta sem expor a mensagem bruta da importação. As listas usam paginação no servidor (25 itens por padrão e máximo de 100), sem reduzir a população usada pelos indicadores e gráficos.

Cada gráfico possui um resumo textual acessível associado ao canvas. O Chart.js 4.4.7 é carregado pelo CDN configurado com SRI e `crossorigin="anonymous"`; se o CDN falhar, os indicadores, resumos e listas continuam disponíveis.

No celular, somente os cartões com contato parcialmente oculto são criados no DOM; no desktop, somente a tabela correspondente é criada. Linhas com contato oferecem **Ver detalhes**, que abre um diálogo acessível e revela o contato completo somente após a ação. O diálogo recebe foco inicial, fecha por botão ou `Escape` e devolve o foco ao acionador. Essa ocultação reduz a exposição visual em telas pequenas, mas não concede nem substitui autorização: a barreira de acesso é a publicação do Web App restrita aos usuários autorizados do Google Workspace.

A especificação completa está em `docs/superpowers/specs/2026-07-11-dashboard-xsteam-design.md`.
