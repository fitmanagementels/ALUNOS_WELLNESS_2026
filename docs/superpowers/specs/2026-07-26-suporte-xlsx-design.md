# Design — suporte a relatórios XLSX

**Data:** 26/07/2026
**Estado:** aprovado para planejamento
**Escopo:** importador da Base Central TecnoFit

## Objetivo

Aceitar relatórios modernos do TecnoFit em formato XLSX sem interromper a leitura dos relatórios antigos em XLS/HTML. A base atual só poderá ser substituída depois que os três arquivos forem lidos e validados integralmente.

## Evidências

- O arquivo `vencimentos_2026-07-20_r02.xls` tinha extensão `.xls`, mas assinatura ZIP (`PK`) e estrutura interna OOXML de um XLSX.
- O arquivo de exemplo `avaliacao_fisica_2026-07-25_r01.xls` é HTML de Excel e contém os cabeçalhos `Código` e `Data da Avaliação`; o leitor HTML atual o interpreta corretamente.
- Os lotes de 20/07 `r01` e `r02` foram registrados como `ERRO` antes da substituição das abas gerenciadas. Eles não alteraram a base vigente.

## Contrato de entrada

Os três nomes continuam obrigatórios e compartilham data e revisão:

```text
vencimentos_AAAA-MM-DD_rNN.xls ou .xlsx
fichas_AAAA-MM-DD_rNN.xls ou .xlsx
avaliacao_fisica_AAAA-MM-DD_rNN.xls ou .xlsx
```

O formato real prevalece sobre a extensão:

- conteúdo HTML de Excel: leitor legado;
- conteúdo ZIP/OOXML: leitor XLSX;
- conteúdo desconhecido ou corrompido: erro explícito, sem alterar a base.

Arquivos XLSX que chegarem nomeados como `.xls` serão aceitos e arquivados com extensão `.xlsx`. O inverso também será normalizado para `.xls`. O histórico de `IMPORTACOES` preserva o nome recebido antes do arquivamento.

## Arquitetura

### Descoberta e lote

`parseNomeArquivo` aceitará as extensões `.xls` e `.xlsx`. O agrupamento continua exigindo exatamente um arquivo de cada tipo, a mesma data e a mesma revisão.

Após o agrupamento, cada arquivo recebe seu formato detectado pelo conteúdo do blob. O nome canônico final é produzido usando esse formato detectado, não a extensão que o operador informou.

### Leitor de tabelas

Será criado um módulo dedicado ao OOXML. Ele usará `Utilities.unzip(blob)`, serviço nativo do Apps Script, para localizar os componentes do XLSX:

- `xl/sharedStrings.xml`, quando existir;
- a primeira planilha em `xl/worksheets/sheet*.xml`;
- metadados de estilos quando forem necessários para representar datas numéricas.

O leitor converterá células compartilhadas, texto direto, texto inline, números, booleanos e datas Excel para uma matriz de valores. A matriz seguirá para a mesma função `tabelaParaObjetos` usada pelo HTML. Assim, cabeçalhos, regras de linhas-resumo, validações de IDs, datas, valores e contratos continuam centralizados e idênticos para os dois formatos.

O leitor HTML existente não será modificado em seu comportamento. Um roteador de formato escolherá apenas um leitor por arquivo.

### Datas

Datas que já vierem como texto, como `25/07/2026`, permanecem inalteradas. Datas XLSX armazenadas como número serão convertidas da base Excel para `dd/MM/yyyy` antes das validações já existentes.

### Segurança e falhas

A leitura, conversão e validação completa dos três arquivos ocorrerão antes do backup e da substituição de `BASE_ALUNOS`, `CONTRATOS` e `VISAO_MESTRE`.

Se um ZIP não contiver planilha, uma célula não puder ser interpretada ou os cabeçalhos obrigatórios estiverem ausentes, a importação falha, registra `ERRO`, move o lote reconhecido para `03_REJEITADOS` e mantém a última base válida. A regra de revisão superior continua valendo para qualquer tentativa registrada, inclusive as que falharam.

## Testes

Os testes unitários cobrirão:

- aceitação de nomes `.xls` e `.xlsx` com data por hífen ou sublinhado;
- XLSX válido com cabeçalhos e valores compartilhados, inline e numéricos;
- data XLSX serializada e data textual;
- XLSX com nome `.xls`, arquivado canonicamente como `.xlsx`;
- HTML antigo com nome `.xlsx`, arquivado canonicamente como `.xls`;
- arquivo ZIP inválido, sem worksheet ou com cabeçalho obrigatório ausente;
- regressão da leitura HTML atual;
- fluxo de importação que impede substituição das abas quando a leitura de um arquivo falha.

Após os testes locais, a validação manual usará o lote de 25/07 com uma revisão ainda não registrada. O painel deverá concluir a importação e o arquivo moderno deverá ser arquivado com extensão coerente ao seu conteúdo.

## Fora de escopo

- Conversão de arquivos para Google Sheets;
- suporte a XLS binário antigo (BIFF/OLE), que não é o formato observado;
- alteração do dashboard ou das regras de transformação de alunos e contratos.
