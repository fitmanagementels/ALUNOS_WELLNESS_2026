# Análise temporal de churns — Fluxo

**Data:** 29/07/2026
**Estado:** desenho aprovado; aguardando revisão do documento

## Objetivo

Transformar a subaba **Fluxo > Churns** em uma área de análise de saídas do polo `XSTEAM WELLNESS CLUB`. A página deve priorizar tendências e diagnósticos acionáveis; a lista individual deixa de ocupar a tela e passa a ser consultada sob demanda em um pop-up.

## Escopo de dados

- A fonte é `FLUXO_CHURNS`, limitada no backend aos registros cujo `polo` seja `XSTEAM WELLNESS CLUB`.
- A data de referência é `data_saida`.
- Não serão usadas `inicio_plano`, `inicio_corrente`, ficha ou avaliação para inferir tempo de empresa.
- Portanto, coortes e tempo até churn ficam fora desta etapa. Eles só poderão ser criados quando houver uma data histórica confiável de entrada do aluno.

## Hierarquia da página

1. Cartões de leitura rápida: saídas registradas, registros com motivo e registros com ação de retenção.
2. Tendência mensal (MoM): barras por mês e leitura da variação contra o mês imediatamente anterior.
3. Tendência semanal (WoW): linha semanal com pontos discretos clicáveis para revelar oscilações.
4. Diagnósticos: ranking de motivos, distribuição por frequência contratada e cobertura de retenção.
5. Detalhe: lista de churns em pop-up, filtrada pelo cartão ou pelo período clicado em um gráfico.

## Lista em pop-up

O cartão **Saídas registradas** será interativo. Ao acioná-lo, abre o diálogo existente do dashboard com todos os churns atualmente disponíveis. A mesma estrutura será usada para os detalhes temporais:

- Clique em uma barra mensal: abre somente os churns daquele mês.
- Clique em um ponto semanal: abre somente os churns da semana iniciada na segunda-feira exibida no gráfico.
- Cada item apresenta nome, ID do aluno, data de saída, frequência, motivo, sinais/contexto e ação de retenção quando preenchidos, além de ações existentes de editar e apagar.
- O título do diálogo identifica o recorte, por exemplo `Churns — Jul/2026` ou `Churns — 07–13 Jul/2026`.

O refinamento visual detalhado da lista fica deliberadamente fora desta etapa; ela apenas deixa de compor a página principal e passa a ser acessível sob demanda.

## MoM — churn mensal

O gráfico mensal usa barras, uma por competência `AAAA-MM`, com quantidade de churns como valor principal. O estado inicial contém todo o histórico disponível. Dois campos de mês (`mês inicial` e `mês final`) permitem restringir o período sem introduzir filtros diários.

Cada ponto mensal leva também a variação absoluta e percentual em relação ao mês anterior. Se não houver mês anterior, a variação é apresentada como indisponível; se o mês anterior tiver zero churns, a variação percentual não é calculada para evitar uma porcentagem artificialmente infinita. Meses sem saídas dentro do intervalo aparecem com valor zero, preservando a continuidade da leitura.

## WoW — churn semanal

O gráfico semanal usa uma linha com marcadores circulares discretos e uma observação por semana iniciada na segunda-feira. Cada marcador representa a soma de churns de segunda a domingo e pode ser selecionado para abrir o diálogo do período correspondente.

Por padrão, o recorte é das últimas 26 semanas, incluindo a semana corrente. Os filtros são duas datas (`início` e `fim`) aplicadas às semanas; quando alterados, o gráfico inclui todas as semanas que intersectam esse intervalo. Semanas sem churns aparecem como zero, garantindo que picos e quedas sejam visíveis e clicáveis.

## Diagnósticos complementares

### Motivos de saída

Exibir barras horizontais ordenadas pela quantidade de registros em `motivo_saida`. Valores vazios não entram no ranking e alimentam o indicador de incompletude. O gráfico não atribui causa aos churns: apenas organiza o que foi registrado manualmente.

### Frequência contratada

Exibir barras por `contrato_x_sem` (`1X`, `2X`, etc.). Registros sem frequência formam a categoria `Não informado`, para separar ausência de auditoria de uma frequência real.

### Cobertura de retenção

Exibir a proporção e as quantidades de churns com e sem `acao_retencao` preenchida. É uma medida de completude do processo de retenção, não uma medida de eficácia: não há dado nesta etapa para afirmar se a ação evitou ou não uma saída.

## Comportamento e segurança

- Os filtros globais de status e polo continuam ocultos em Fluxo.
- A análise não altera nenhuma linha da planilha; editar e apagar continuam ações explícitas realizadas pelo diálogo.
- Datas ausentes ou inválidas são excluídas exclusivamente das séries temporais e continuam aparecendo no pop-up do cartão geral.
- Tooltips e diálogos usam texto construído com APIs de DOM, sem inserir conteúdo de planilha como HTML.

## Testes

- Série mensal: meses vazios, recorte por mês, variação normal, primeiro mês e base anterior zero.
- Série semanal: limite padrão de 26 semanas, preenchimento de zeros, limites de semana e seleção de um ponto.
- Popup: filtro total, mensal e semanal; nenhum registro fora do período aparece.
- Diagnósticos: ranking, categoria `Não informado` e contagem de retenção.
- Cliente: cartões e elementos de gráfico possuem ações de clique; os filtros respectivos atualizam somente sua própria visualização.
