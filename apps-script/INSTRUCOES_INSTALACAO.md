# Instalação do backend no Google Apps Script

> **PWA atual:** o dashboard operacional é publicado no GitHub Pages e não usa mais login OAuth. Para configurá-lo, siga [CONFIGURACAO_PWA_PUBLICO.md](../docs/operacao/CONFIGURACAO_PWA_PUBLICO.md). As seções antigas de publicação com usuários Google autorizados permanecem apenas como histórico e não devem ser usadas para a operação atual.

Estas instruções instalam o backend na planilha Google Sheets `TecnoFit_Base_Mestre`.

Planilha:

```text
https://docs.google.com/spreadsheets/d/1I63DuNBk1mR-U5gNe9EvGhSu-QryqXxfVrG0RC0vtfM/edit
```

## 1. Abrir o projeto Apps Script

1. Abra a planilha mestre.
2. Acesse **Extensões > Apps Script**.
3. Aguarde a abertura do editor em uma nova guia.
4. Se existir apenas o arquivo `Code.gs`, ele pode ser excluído depois que os módulos abaixo forem criados.

## 2. Criar os arquivos de script

No editor Apps Script, clique no botão **+** ao lado de Arquivos e escolha **Script**. Crie os arquivos abaixo, sem digitar a extensão `.gs` no campo de nome:

```text
00_Config
01_Normalizacao
02_ParserHtml
02_ParserXlsx
03_Permanencia
03_Transformacao
04_PlanilhaRepositorio
05_DriveRepositorio
06_LogImportacoes
07_ImportacaoService
08_Main
20_CargaInicialPermanencia
```

Para cada nome, copie todo o conteúdo do arquivo correspondente desta pasta:

```text
apps-script/00_Config.gs
apps-script/01_Normalizacao.gs
apps-script/02_ParserHtml.gs
apps-script/02_ParserXlsx.gs
apps-script/03_Permanencia.gs
apps-script/03_Transformacao.gs
apps-script/04_PlanilhaRepositorio.gs
apps-script/05_DriveRepositorio.gs
apps-script/06_LogImportacoes.gs
apps-script/07_ImportacaoService.gs
apps-script/08_Main.gs
apps-script/20_CargaInicialPermanencia.gs
```

A ordem visual dos arquivos no editor não altera a execução.

## 3. Criar o painel lateral

1. Clique novamente em **+**.
2. Escolha **HTML**.
3. Digite o nome `Sidebar`.
4. Substitua o conteúdo criado automaticamente por todo o conteúdo de `apps-script/Sidebar.html`.

O nome precisa ser exatamente `Sidebar`, pois `08_Main.gs` procura esse arquivo.

## 4. Configurar o manifesto

1. Abra **Configurações do projeto** no menu lateral do editor.
2. Marque **Mostrar o arquivo de manifesto appsscript.json no editor**.
3. Volte para **Editor**.
4. Abra `appsscript.json`.
5. Substitua seu conteúdo pelo conteúdo de `apps-script/appsscript.json`.

O manifesto solicita somente os acessos necessários para ler/mover arquivos no Drive, alterar a planilha e exibir o painel lateral.

## 5. Salvar e carregar o menu

1. Clique em **Salvar projeto**.
2. Volte para a planilha mestre.
3. Recarregue a página.
4. Aguarde o menu **TecnoFit** aparecer ao lado dos menus do Google Sheets.
5. Acesse **TecnoFit > Abrir painel**.

## 6. Autorizar a primeira execução

Na primeira abertura ou atualização, o Google solicitará autorização:

1. Clique em **Revisar permissões**.
2. Selecione a conta proprietária da planilha e das pastas.
3. Confira os acessos ao Google Drive e Google Sheets.
4. Clique em **Permitir**.

Somente a conta responsável pela atualização deve operar o painel nesta primeira versão.

## 7. Executar a primeira atualização

Antes de clicar no botão, confirme que `01_ENTRADA` contém somente:

O padrão canônico do quarto arquivo é `permanencia_AAAA-MM-DD_rNN.xls` (ou `.xlsx`). Exemplo de lote:

```text
vencimentos_2026_07_08_r01.xls ou vencimentos_2026_07_08_r01.xlsx
fichas_2026_07_08_r01.xls ou fichas_2026_07_08_r01.xlsx
avaliacao_fisica_2026_07_08_r01.xls ou avaliacao_fisica_2026_07_08_r01.xlsx
permanencia_2026_07_08_r01.xls ou permanencia_2026_07_08_r01.xlsx
```

Use sempre uma exportação completa, sem filtro de status, para permanência. Os quatro arquivos precisam ter a mesma data e revisão. Não edite células nas abas gerenciadas; aguarde os quatro uploads terminarem e clique em **Atualizar base** uma única vez.

O backend também aceita hífens na data. Ele identifica o formato interno do arquivo: relatórios HTML de Excel continuam sendo lidos como `.xls` e arquivos Excel modernos são lidos como `.xlsx`, mesmo se o nome recebido estiver com a extensão trocada. Ao arquivar, a extensão será corrigida para refletir o formato real. Depois:

1. Abra **TecnoFit > Abrir painel**.
2. Confirme que aparece **Pronto para importar**.
3. Clique em **Atualizar base** uma única vez.
4. Não feche nem recarregue a planilha durante o processamento.
5. Aguarde a mensagem final com as quantidades de alunos e contratos.

Resultado esperado para o primeiro lote:

```text
330 alunos
339 contratos
339 linhas de dados em VISAO_MESTRE
4 registros SUCESSO em IMPORTACOES
```

Os arquivos serão renomeados com hífens e movidos para:

```text
02_PROCESSADOS/2026/2026-07-08/
```

## 8. Conferência após a atualização

- `BASE_ALUNOS`: 330 linhas de dados e IDs únicos.
- `CONTRATOS`: 339 linhas de dados.
- `VISAO_MESTRE`: 339 linhas de dados e coluna M oculta.
- `IMPORTACOES`: quatro linhas do lote com o mesmo `execucao_id` e status `SUCESSO`.
- `BASE_PERMANENCIA`: histórico acumulado de clientes, sem apagar ausentes de lotes posteriores.
- `HISTORICO_PERMANENCIA`: eventos idempotentes de entrada, status, ausência e reaparecimento.
- ID `2321`: três contratos com três chaves técnicas diferentes.
- `01_ENTRADA`: vazia.

## 9. Em caso de erro

1. Leia a mensagem exibida no painel.
2. Consulte as linhas `ERRO` em `IMPORTACOES`.
3. Não edite manualmente as abas gerenciadas.
4. Corrija os relatórios na origem.
5. Envie os quatro arquivos com revisão superior, como `r02`.
6. Abra novamente o painel e execute a atualização.

Quando o lote for reconhecido, mas algum dado for inválido, os arquivos serão movidos para `03_REJEITADOS/AAAA/AAAA-MM-DD`. A última base válida será restaurada.

## 10. Atualizações futuras do código

Quando um arquivo desta pasta for alterado, copie novamente seu conteúdo integral para o arquivo de mesmo nome no editor Apps Script. Salve o projeto e recarregue a planilha.

Não crie gatilhos agendados. Para a publicação atual do PWA público, use o procedimento em `docs/operacao/CONFIGURACAO_PWA_PUBLICO.md`.

## 11. Publicação do dashboard

Antes de publicar, conclua a instalação dos arquivos `00_Config.gs` a `08_Main.gs`, de `Sidebar.html` e de `appsscript.json` descrita nas seções anteriores. Depois:

1. No editor Apps Script vinculado à planilha mestre, clique em **+ > Script** e crie, sem digitar a extensão `.gs`, os arquivos `09_DashboardMetricas`, `10_DashboardPaginas`, `11_DashboardRepositorio` e `12_DashboardApi`.
2. Copie integralmente o conteúdo dos arquivos locais para os arquivos de mesmo nome no editor:

   ```text
   apps-script/09_DashboardMetricas.gs
   apps-script/10_DashboardPaginas.gs
   apps-script/11_DashboardRepositorio.gs
   apps-script/12_DashboardApi.gs
   ```

3. Clique em **+ > HTML** e crie os quatro arquivos abaixo, sem digitar a extensão `.html` no campo de nome:

   ```text
   Dashboard
   DashboardClient
   DashboardComponents
   DashboardStyles
   ```

4. Copie integralmente o conteúdo dos quatro arquivos locais correspondentes:

   ```text
   apps-script/Dashboard.html
   apps-script/DashboardClient.html
   apps-script/DashboardComponents.html
   apps-script/DashboardStyles.html
   ```

5. Clique em **Salvar projeto**.
6. Acesse **Implantar > Nova implantação**.
7. Em **Selecionar tipo**, escolha **Aplicativo da Web**.
8. Informe uma descrição que identifique a versão publicada.
9. Em **Executar como**, selecione a conta proprietária do projeto e da planilha mestre.
10. Em **Quem pode acessar**, selecione somente a opção que restrinja o aplicativo aos usuários pretendidos do Google Workspace. Não permita acesso público ou anônimo.
11. Clique em **Implantar**, revise os escopos solicitados e conclua a autorização com a conta proprietária.
12. Copie a URL implantada que termina em `/exec`. Não use a URL de teste terminada em `/dev` na operação diária.
13. Abra a URL `/exec` em um navegador de desktop e em um navegador de celular, autenticado em cada caso com um usuário autorizado.

Quando o código do dashboard mudar, crie uma nova versão em **Implantar > Gerenciar implantações**, atualize a implantação existente e repita a verificação abaixo.

O cliente usa Chart.js 4.4.7 com verificação SRI. Não remova os atributos `integrity` e `crossorigin="anonymous"` do arquivo `Dashboard.html` ao copiar ou revisar o código.

## 12. Checklist de aceitação do dashboard

- [ ] A página abre sem solicitar acesso público à planilha.
- [ ] As quatro áreas abrem no desktop e no celular.
- [ ] A data da última importação aparece corretamente.
- [ ] Um aluno com vários contratos conta uma vez em indicadores de alunos.
- [ ] O mesmo contrato não duplica valores.
- [ ] Vencimentos de 7 e 30 dias conferem com uma amostra manual.
- [ ] Fichas sem data aparecem como ausentes; fichas com mais de 30 dias, como desatualizadas.
- [ ] Avaliações sem data aparecem como ausentes; avaliações com mais de 90 dias, como desatualizadas.
- [ ] Busca e filtros atualizam cartões, gráficos e lista.
- [ ] Trocar qualquer filtro volta a lista para a página 1; Anterior e Próxima respeitam os limites.
- [ ] Indicadores e gráficos permanecem globais ao avançar a página da lista.
- [ ] A última atualização e eventual falha posterior aparecem no cabeçalho sem mensagem bruta da importação.
- [ ] Cada gráfico oferece um resumo textual navegável por tecnologia assistiva.
- [ ] Telefones ficam parcialmente ocultos nos cartões do celular.
- [ ] **Ver detalhes** abre um diálogo com foco inicial; botão Fechar e `Escape` fecham e restauram o foco.
- [ ] Antes de abrir os detalhes no celular, o contato completo não existe no DOM.
- [ ] Nenhuma mensagem de erro exibe nomes ou contatos.

## 13. Verificação visual após a publicação

Com a URL `/exec` implantada e um usuário autorizado, verifique o dashboard nestas dimensões de viewport:

- `1440 × 900`: menu lateral, grade de indicadores, gráficos, listas, foco visível e estados de carregamento, vazio e erro;
- `1024 × 768`: adaptação do menu lateral, grade em duas colunas, empilhamento dos gráficos e rolagem dos indicadores;
- `390 × 844`: transição do menu lateral para a navegação inferior, cartões móveis, indicadores com rolagem horizontal e gráficos empilhados.

Nas três dimensões, teste também a navegação por teclado, a preferência de movimento reduzido, a busca, os filtros e a ausência de dados pessoais nas mensagens de erro. Registre a data, o navegador, o usuário de teste autorizado e o resultado de cada item do checklist. A verificação visual real não pode ser concluída apenas com os arquivos locais: ela requer a implantação autorizada e a leitura controlada da planilha mestre.

No viewport móvel, confirme no inspetor que a tabela desktop e os contatos completos não existem no DOM antes de acionar **Ver detalhes**. Abra e feche o diálogo por botão e por `Escape`, verificando a restauração de foco. Ao ampliar a janela acima de `720px`, confirme que os cartões móveis são removidos e a tabela é criada sem uma nova chamada à API. O mascaramento móvel é apenas minimização de exposição visual; a autorização continua sendo controlada exclusivamente pelo acesso restrito ao Web App.

## 14. Validação com exports autorizados

Antes da publicação operacional, coloque temporariamente os quatro exports semanais autorizados — `vencimentos`, `fichas`, `avaliacao_fisica` e `permanencia` — em `/tmp/tecnofit-validacao` e execute:

```bash
npm run validate:real -- --dir /tmp/tecnofit-validacao
```

A validação deve terminar sem erros e não deve modificar a planilha mestre. Execute-a somente quando os quatro arquivos autorizados estiverem presentes. Por privacidade, não copie esses exports para o repositório, não registre no relatório nomes, contatos ou outras linhas de dados e apague a cópia temporária ao final. Se os quatro arquivos não estiverem disponíveis, registre a validação operacional como pendente; não substitua os dados reais por fixtures para declarar esse item concluído.

## 15. Aplicar a página Fluxo

1. No projeto Apps Script, atualize `00_Config`, `04_PlanilhaRepositorio`, `08_Main`, `12_DashboardApi`, `14_DashboardMutacoes`, `DashboardClient`, `DashboardComponents` e `DashboardStyles` com os arquivos locais correspondentes.
2. Crie um novo arquivo de script chamado `15_DashboardFluxo` e copie integralmente `apps-script/15_DashboardFluxo.gs`.
3. Salve o projeto e execute `garantirEstruturaPlanilha` uma vez, com a conta proprietária da planilha. Isso cria `FLUXO_LEADS` e atualiza o cabeçalho vazio de `FLUXO_CHURNS`; não apaga a base semanal nem os registros manuais existentes.
4. Confirme na planilha o cabeçalho de Churn: `churn_id`, `aluno_id`, `nome`, `telefone`, `data_saida`, `profissional_responsavel`, `ultimo_personal`, `motivo_saida`, `sinais_contexto`, `acao_retencao`, `criado_em`, `atualizado_em`. As linhas criadas pelo dashboard recebem ID e timestamps automaticamente. Para linhas incluídas manualmente, use **TecnoFit > Preencher IDs pendentes de Fluxo**: ele preenche apenas a coluna A das linhas com dados e atualiza o cache do dashboard.
5. Em **Implantar > Gerenciar implantações**, edite a implantação do Web App, selecione uma nova versão e publique. Esta etapa precisa incluir tanto `12_DashboardApi.gs` quanto `DashboardClient.html`; publicar apenas o backend mantém a interface antiga incompatível com a análise de Churn.
6. Feche a aba antiga do dashboard, abra novamente a URL `/exec` e faça uma recarga forte (`Ctrl+Shift+R`). A versão do bootstrap agora inclui uma assinatura compacta de `FLUXO_LEADS` e `FLUXO_CHURNS`, portanto alterações manuais nessas abas invalidam automaticamente o cache na próxima atualização do dashboard.
7. Abra **Fluxo > Leads**, cadastre um Lead fictício e confirme o status, datas e link de WhatsApp sem enviar mensagem.
8. Abra **Fluxo > Churns**, cadastre e edite um Churn fictício; confirme data de saída, os menus **Profissional responsável** e **Último personal**, e que a exclusão pede confirmação antes de remover o registro. Todos os churns manuais são mostrados; os filtros globais ficam ocultos nesta página.

9. Para aplicar o refinamento visual de listas e pop-ups de Fluxo, copie também as versões atuais de `DashboardClient.html` e `DashboardStyles.html` para o projeto Apps Script. Salve e publique uma nova versão do Web App antes de testar os novos campos de data, as ações Editar/Apagar e o rodapé Salvar.
10. Em **Churns**, confirme que **Saídas registradas** abre a lista em pop-up. Clique em uma barra do gráfico mensal para abrir somente o mês selecionado e em um ponto da linha semanal para abrir somente aquela semana. O mensal inicia com todo o histórico; o semanal inicia nas últimas 26 semanas. Os campos de mês e de data alteram apenas o gráfico correspondente.

O telefone do Lead é apresentado somente em Fluxo para construir o atalho operacional do WhatsApp. Mantenha o Web App restrito aos usuários autorizados.
