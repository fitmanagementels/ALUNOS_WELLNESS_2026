# Migração integral do XSTEAM Gestão para Cloudflare — desenho aprovado

## Objetivo

Transferir todo o funcionamento do XSTEAM Gestão para a plataforma Cloudflare sem interromper a operação e sem perder dados. Depois do corte, frontend, backend, autenticação, banco de dados, importações e arquivos operacionais não dependerão de GitHub Pages, Google Apps Script, Google Sheets ou Google Drive.

O GitHub continuará apenas como cópia versionada do código-fonte. Ele não fará parte do caminho de execução do sistema. A publicação de produção será realizada diretamente no Cloudflare por Wrangler e, depois de validada, registrada no GitHub.

## Restrições e decisões aprovadas

- Não comprar nem manter domínio próprio nesta fase.
- Usar um endereço gratuito `workers.dev`, com nome final a confirmar durante a implantação.
- Adotar um único Cloudflare Worker para entregar o PWA e atender a API no mesmo domínio.
- Usar Cloudflare D1 como fonte única dos dados operacionais.
- Usar Cloudflare R2 para arquivos originais, exportações e backups duráveis.
- Exigir login Google por Cloudflare Access.
- Autorizar exclusivamente `fitmanagement.els@gmail.com` e `elohimlima15@gmail.com`.
- Fazer toda consulta e edição operacional pelo PWA.
- Tratar planilhas apenas como arquivos de entrada, exportação ou contingência; nenhuma planilha será uma base viva depois do corte.
- Projetar a solução para permanecer dentro das franquias gratuitas, com telemetria dos limites e sem adesão automática a plano pago.

## Arquitetura-alvo

```text
Usuário
  |
  | Login Google
  v
Cloudflare Access — allowlist de dois e-mails
  |
  v
Cloudflare Worker único / workers.dev
  |-- Workers Static Assets: HTML, CSS, JS, manifesto e service worker
  |-- API: leitura, gravação, importação, exportação e auditoria
  |-- D1: dados relacionais e histórico operacional
  `-- R2: arquivos brutos, relatórios de importação e backups
```

Frontend e API terão a mesma origem. Isso elimina CORS, reduz configurações divergentes e permite que a mesma proteção do Access cubra todos os caminhos de produção.

## Autenticação e autorização

O Cloudflare Access será configurado com Google como provedor de identidade genérico. A política será `deny by default` e terá regras explícitas de inclusão para os dois e-mails aprovados.

O bloqueio no Access será a primeira camada. O Worker também lerá a identidade validada pelo Access e rejeitará ações quando o e-mail não estiver na allowlist interna. Essa segunda verificação evita que uma alteração acidental na política externa abra a API.

Não haverá token Google no PWA, senha própria, usuário público nem rota de API anônima. URLs de preview também deverão ser protegidas. Logs não armazenarão nomes, telefones, conteúdo dos formulários, arquivos ou tokens.

## Modelo de dados no D1

O esquema será normalizado em torno do ID TecnoFit do aluno. As entidades previstas são:

- `students`: identidade e dados cadastrais consolidados;
- `contracts`: planos e contratos, incluindo status, datas e valores;
- `prescriptions` e `assessments`: situação e datas dos dois processos independentes;
- `permanence_events`: histórico de entrada, permanência e vínculos encontrados nos relatórios;
- `student_profiles`: professor responsável, perfil de pagamento e observações;
- `student_last_teachers`: relação de múltipla seleção para últimos professores;
- `tags`, `tag_groups` e `student_tags`: catálogos e classificações;
- `leads` e eventos temporais de leads;
- `churns` e campos manuais de retenção;
- `new_students`: registros oficiais de alunos novos;
- `settings`: limites, ordenação, catálogos e preferências operacionais;
- `import_batches`, `import_files` e `import_errors`: rastreabilidade integral de cada lote;
- `mutation_log`: idempotência, autoria, data e resultado das alterações;
- `data_versions`: versão ativa e versões anteriores da base derivada.

As tabelas e os índices serão definidos por migrações SQL versionadas no repositório. Campos manuais persistentes serão separados dos dados oficiais para impedir que novas importações apaguem o trabalho da equipe.

## Regras de precedência e preservação

- O ID do aluno é a chave de conciliação entre fontes e versões.
- Dados manuais existentes permanecem associados ao ID.
- Fontes oficiais prevalecem para nome, contrato, valor, início, vencimento, status e demais informações de plano.
- Para registros repetidos de plano, continua válida a escolha da linha com vencimento mais recente, sem inferir status somente pela data.
- Perfis, etiquetas, observações, professor responsável, últimos professores, dados manuais de churn e leads não são apagados pela ausência em um lote.
- Churns já preenchidos mantêm os campos manuais; os campos oficiais passam a vir da lista oficial migrada.
- A prévia de transição de churns continua sendo referência de auditoria e deve ser incorporada à migração, não descartada.

## Importação no PWA

O PWA receberá os relatórios por seleção ou arraste de arquivos. Para respeitar o limite de CPU do Workers Free, a leitura de XLS/XLSX e a normalização inicial ocorrerão no navegador, usando código hospedado pelo próprio Worker. O backend nunca confiará cegamente no resultado do cliente: validará esquema, tipos, datas, assinatura do lote, contagens e regras de negócio antes de gravar.

Fluxo do lote:

1. O usuário escolhe os arquivos originais.
2. O PWA identifica tipo, data e revisão e realiza validações locais rápidas.
3. O PWA envia os arquivos brutos ao R2 e dados normalizados em partes identificadas.
4. O Worker registra um lote em estado de preparação.
5. O D1 recebe dados em tabelas de estágio, sem alterar a versão ativa.
6. Uma prévia informa inserções, atualizações, preservações, ausências, rejeições e divergências.
7. Após confirmação, uma transação promove a nova versão.
8. Se qualquer etapa falhar, a versão anterior continua ativa e o lote permanece disponível para diagnóstico.

Os quatro relatórios TecnoFit continuam sendo um conjunto indivisível: vencimentos, fichas, avaliações e permanência devem compartilhar data e revisão. Cancelados oficiais e alunos novos terão importadores próprios, igualmente auditáveis, e não exigirão transposição manual de células.

## Continuidade de uso e sincronização

O PWA continuará usando atualização otimista e uma fila persistente no navegador:

- a interface reflete a alteração imediatamente;
- a operação recebe um identificador idempotente antes do envio;
- a fila local sobrevive a fechamento, recarga e perda temporária de conexão;
- o Worker registra cada operação uma única vez;
- falhas transitórias são repetidas com espera progressiva;
- o usuário vê estados discretos de `salvando`, `salvo` ou `pendente`, sem modal bloqueado;
- falhas definitivas mantêm o conteúdo local e oferecem nova tentativa;
- a lista de alunos preserva o estado expandido, filtros, ordenação e posição durante e depois do salvamento.

O service worker guardará o shell do aplicativo. Dados pessoais em cache local serão limitados ao necessário para a operação, associados à versão do esquema e removidos no logout.

## Backup, recuperação e auditoria

- D1 Time Travel dará a recuperação imediata disponível no plano contratado; na franquia gratuita, a janela atual é de sete dias.
- Exportações periódicas do D1 serão armazenadas no R2 para retenção superior à janela do Time Travel.
- Arquivos originais terão caminho imutável por data, revisão e identificador de lote.
- Cada importação terá autor, horário, hashes, contagens, erros e versão resultante.
- Exclusões funcionais usarão arquivamento lógico quando houver valor histórico.
- O GitHub armazenará código, migrações e documentação, nunca planilhas reais, contatos, banco exportado, tokens ou segredos.

## Estratégia de migração

### 1. Inventário e congelamento lógico

Mapear abas, colunas, transformações e contratos atuais. Gerar exportações completas da planilha e registrar a versão correspondente do código. Nenhum dado atual será removido.

### 2. Fundação Cloudflare

Criar D1, R2, bindings, segredos, ambientes e Worker com Static Assets. Configurar Google no Access e validar separadamente os dois logins autorizados e um login não autorizado.

### 3. Migração do backend

Portar normalização, métricas, consultas e mutações do Apps Script para módulos testáveis do Worker. Reproduzir o contrato necessário ao PWA antes de introduzir melhorias de API.

### 4. Migração dos dados

Importar a fotografia completa da base atual. Conciliar por ID, preservar campos manuais e produzir relatório de totais, ausências, duplicidades e divergências. Nenhuma promoção será feita sem paridade aprovada.

### 5. Migração do frontend

Publicar o PWA como Static Assets no mesmo Worker, substituir o adaptador do Apps Script por chamadas locais à API e manter as características de cache, fila e atualização otimista.

### 6. Operação paralela e ensaio

Executar leituras comparativas entre a base atual e o D1. Realizar ensaios de importação e mutação em ambiente de pré-produção protegido. Escritas reais permanecerão em apenas uma fonte durante cada ensaio para evitar bases divergentes.

### 7. Corte controlado

Fazer backup final, bloquear temporariamente alterações no sistema antigo, migrar o delta, validar contagens e liberar o novo endereço. O sistema antigo ficará somente para consulta e contingência durante a janela de estabilização.

### 8. Desativação segura

Depois da aprovação operacional, remover a dependência do GitHub Pages e revogar segredos entre Worker e Apps Script. Apps Script, planilha e Drive serão preservados como arquivo temporário e só serão desativados ou excluídos mediante autorização específica.

## Rollback

Antes do corte serão preservados:

- exportação completa da planilha;
- versão do código em produção;
- banco D1 anterior ao delta final;
- objetos originais no R2;
- endereço antigo ainda funcional durante a janela de estabilização.

Se um critério crítico falhar, o endereço de operação volta ao sistema anterior enquanto o D1 é corrigido. O rollback não exigirá reconstrução manual de planilhas.

## Custos e limites

A solução será otimizada para o Workers Free:

- até 100 mil requisições ao Worker por dia;
- D1 com até 5 milhões de linhas lidas e 100 mil linhas escritas por dia;
- até 5 GB totais no D1 e 500 MB por banco;
- R2 com 10 GB-mês e franquias mensais de operações;
- índices, paginação, respostas incrementais e lotes reduzem consumo;
- o painel exibirá uso e alertas operacionais antes dos limites.

O projeto não ativará plano pago como parte da migração. Se o crescimento futuro exigir mudança, ela dependerá de autorização explícita da gestão.

## Critérios de aceite

1. O endereço de produção é `workers.dev` e não depende de domínio pago.
2. Somente os dois e-mails aprovados entram pelo Google; terceiros são bloqueados.
3. PWA e API são entregues pelo Cloudflare e continuam funcionando sem GitHub Pages, Apps Script, Sheets ou Drive.
4. D1 contém os dados atuais, históricos e manuais, conciliados por ID e validados por totais.
5. R2 contém os arquivos originais e os artefatos de backup previstos.
6. As quatro importações TecnoFit são atômicas e mantêm a última versão válida diante de erro.
7. Cancelados oficiais e alunos novos podem ser atualizados pelo PWA sem transposição manual.
8. Perfis, etiquetas, professores, observações, leads e churns podem ser salvos sem bloquear o fluxo de uso.
9. Filas de fichas e avaliações continuam independentes.
10. O estado visual das listas não é alterado pelo salvamento em segundo plano.
11. Logs e repositório não expõem dados pessoais ou segredos.
12. Há testes automatizados, relatório de reconciliação, backup e procedimento de rollback antes do corte.

## Fora do escopo desta migração

- Compra de domínio personalizado.
- Plano pago do Cloudflare.
- Agenda completa do aluno, além da preservação do campo reservado atual.
- Mudança das regras de negócio já aprovadas para permanência, fichas, avaliações e métricas.
- Exclusão imediata das estruturas Google após o corte.
- Armazenamento de bases reais ou arquivos pessoais no GitHub.

## Referências oficiais

- Workers Static Assets: <https://developers.cloudflare.com/workers/static-assets/>
- Cloudflare Access para Workers: <https://developers.cloudflare.com/workers/configuration/cloudflare-access/>
- Login Google no Cloudflare Access: <https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/>
- Migrações D1: <https://developers.cloudflare.com/d1/reference/migrations/>
- D1 Time Travel: <https://developers.cloudflare.com/d1/reference/time-travel/>
- Uploads no R2: <https://developers.cloudflare.com/r2/objects/upload-objects/>
- Preços e franquias Workers: <https://developers.cloudflare.com/workers/platform/pricing/>
