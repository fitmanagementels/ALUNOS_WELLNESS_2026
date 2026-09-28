# Upload semanal no PWA

**Objetivo:** importar os quatro relatórios HTML/XLS enviados pelo administrador em Configurações, com prévia e promoção explícita no D1, sem R2.

**Arquitetura:** leitura em Web Worker; tabelas textuais enviadas em blocos autenticados; validação repetida no servidor; prévia imutável vinculada à versão atual; promoção transacional. Preservar cadastros ausentes, dados manuais e históricos. Arquivos originais permanecem locais.

## Entregas

- [x] Modelo compartilhado `pwa/js/import-model.mjs`: reconhecer colunas, normalizar datas/IDs, consolidar contratos pela chave existente, detectar conflitos, ausências e avisos. Testar com fixtures sintéticas e conferir os quatro arquivos reais sem versioná-los.
- [x] `worker/src/services/import-service.js` e migração aditiva: início, blocos idempotentes, prévia, confirmação e histórico. Verificar promoção atômica, concorrência, repetição e preservação dos perfis em SQLite/D1 local.
- [x] `pwa/js/import-ui.js` e worker de leitura: seleção/arraste, data, progresso não bloqueante, backup criptografado obrigatório antes da confirmação, prévia e download do relatório. Integrar em Configurações e atualizar cache.
- [x] Documentar operação e limites; executar testes existentes e novo fluxo. Publicar apenas se houver credenciais e validar a implantação. A aplicação dos arquivos reais exige confirmação da prévia pelo usuário.

## Verificação

250 testes passaram em Node 24. Teste Chrome com os quatro arquivos reais em banco temporário: 332 alunos, 340 contratos, navegação durante o fluxo, backup e confirmação concluídos, sem erros de JavaScript e sem transbordamento a 390 px. Migração 0005 aplicada localmente e no D1 remoto. Deploy com preservação das variáveis existentes. Arquivos reais não aplicados em produção.

## Regras aprovadas

- Identificação por ID. Nome divergente bloqueia o lote para revisão, sem associação por aproximação.
- Contrato de referência: maior vencimento; conservar todas as chaves de contrato anteriores.
- Ficha/avaliação: maior data; não regredir nem apagar por ausência.
- Telefone existente divergente é preservado e aparece em aviso.
- Professores manuais, pagamento, etiquetas, observações, leads e churns não são escritos pela importação.
- Data de referência explícita; lote antigo bloqueado; revisão automática quando a data é a mesma.
- Relatórios HTML com extensão XLS reconhecidos pelo conteúdo; outros formatos recebem mensagem clara.
- Limites: quatro arquivos, 8 MiB por arquivo, 20 mil linhas por relatório, 100 linhas por bloco.
- Banco alterado entre prévia e confirmação: solicitar nova prévia. Falha de promoção desfaz toda a transação.
