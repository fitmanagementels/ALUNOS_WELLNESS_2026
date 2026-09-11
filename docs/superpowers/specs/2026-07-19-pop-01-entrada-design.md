# Design do POP da pasta 01_ENTRADA

**Data:** 19/07/2026
**Status:** aprovado para implementação

## Objetivo

Criar um manual operacional simples, em PDF, para permanecer na pasta `01_ENTRADA` e servir como lembrete rápido durante a atualização da base TecnoFit.

O documento deve permitir que o operador confira, sem consultar documentação técnica:

- como renomear os três relatórios;
- quais arquivos formam um lote válido;
- como definir data e revisão;
- como executar a atualização;
- o que conferir depois;
- como agir diante de um erro.

## Entrega

- Arquivo: `LEIA-ME_POP_01_ENTRADA.pdf`.
- Formato: A4, duas páginas, leitura confortável no celular e na impressão.
- Estilo: identidade XSTEAM em preto, branco e verde-limão, com fundo predominantemente claro para preservar legibilidade e economia de tinta.
- Natureza: PDF estático, sem controles ou dependência de internet.

### Convivência com a automação

O PDF ficará na própria `01_ENTRADA`. Para preservar a regra operacional de três relatórios, a descoberta de arquivos da automação deve ignorar exclusivamente o nome exato `LEIA-ME_POP_01_ENTRADA.pdf`, sem diferenciação entre maiúsculas e minúsculas. Todo outro arquivo continua sujeito à validação normal e poderá bloquear um lote inválido.

## Conteúdo da página 1

### Regra principal

A pasta `01_ENTRADA` deve conter exatamente três arquivos `.xls`, um de cada tipo, todos com a mesma data e revisão:

```text
vencimentos_AAAA-MM-DD_rNN.xls
fichas_AAAA-MM-DD_rNN.xls
avaliacao_fisica_AAAA-MM-DD_rNN.xls
```

Exemplo válido:

```text
vencimentos_2026-07-19_r01.xls
fichas_2026-07-19_r01.xls
avaliacao_fisica_2026-07-19_r01.xls
```

### Como interpretar o nome

- `AAAA-MM-DD`: data de referência ou exportação, escrita com ano, mês e dia.
- `rNN`: número da revisão com dois dígitos, começando normalmente em `r01`.
- Usar letras minúsculas, sem espaços e sem acentos.
- Não acrescentar palavras como `novo`, `final`, `corrigido` ou `atualizado`.

### Checklist antes de importar

- Há exatamente três relatórios `.xls` na pasta, além do POP.
- Os três tipos obrigatórios estão presentes.
- A data é igual nos três nomes.
- A revisão é igual nos três nomes.
- A extensão continua sendo `.xls`.
- Os relatórios não foram abertos e salvos novamente, convertidos ou editados.

## Conteúdo da página 2

### Fluxo operacional

1. Exportar os três relatórios do TecnoFit.
2. Renomear os arquivos segundo o padrão.
3. Remover da pasta itens antigos ou estranhos; manter apenas o POP e o lote atual.
4. Colocar somente os três relatórios do lote atual em `01_ENTRADA`, além do POP.
5. Abrir `TecnoFit_Base_Mestre`.
6. Acessar **TecnoFit > Abrir painel**.
7. Confirmar o estado **Pronto para importar**.
8. Clicar uma vez em **Atualizar base** e aguardar a conclusão sem fechar ou recarregar a planilha.
9. Confirmar a mensagem de sucesso e verificar que `01_ENTRADA` ficou vazia.

### Correções e revisões

Se qualquer um dos relatórios precisar ser corrigido, reenviar o conjunto completo com revisão superior. Não misturar revisões.

Exemplo: substituir todo o lote `r01` por três arquivos `r02`.

### Em caso de erro

1. Ler a mensagem exibida no painel.
2. Não editar manualmente as abas gerenciadas.
3. Corrigir ou exportar novamente os relatórios na origem.
4. Preparar novamente os três arquivos com revisão superior.
5. Repetir a importação somente quando o painel indicar que o lote está pronto.

Arquivos reconhecidos que falham durante o processamento podem ser enviados automaticamente para `03_REJEITADOS`. Um lote concluído com sucesso é arquivado em `02_PROCESSADOS`.

## Regras visuais

- Cabeçalho preto com marca textual `XSTEAM` e detalhe verde-limão.
- Hierarquia clara, títulos curtos e caixas de atenção.
- Exemplo correto destacado em verde.
- Erros comuns destacados com ícone e cor de alerta, sem depender apenas da cor.
- Checklist com caixas vazias adequadas para consulta ou impressão.
- Rodapé com versão e data do documento.

## Critérios de aceitação

- O PDF possui exatamente duas páginas A4.
- Todo o texto permanece legível em tela de celular.
- Nenhum bloco, título ou tabela é cortado entre páginas.
- As três nomenclaturas obrigatórias aparecem literalmente.
- As regras refletem `parseNomeArquivo`, `agruparLote` e a rotina de importação, com exceção explícita do PDF de POP ignorado na descoberta de entrada.
- O arquivo final abre sem erros e fica pronto para ser colocado em `01_ENTRADA`.
