# Upload semanal no PWA

Em Configurações → Importar dados, informe a data de referência e selecione os quatro arquivos originais do mesmo envio: vencimentos, fichas, avaliação física e clientes por permanência. Pode arrastá-los para a área de seleção. Os nomes não precisam seguir um padrão.

Esta versão lê os relatórios TecnoFit em HTML com extensão `.xls` (também `.html`/`.htm`). Não aceita XLS binário ou XLSX. Limites: 8 MB por arquivo, 20 mil linhas por relatório e 1,5 MB para a prévia consolidada. O navegador lê em uma tarefa separada, mantendo a navegação disponível. O envio é dividido em blocos de 100 registros.

## Conferir e aplicar

1. Clique em Preparar prévia. Os registros são preparados no D1, sem alterar a base ativa.
2. Confira mudanças, avisos, inconsistências e alunos ausentes. IDs com nomes divergentes bloqueiam a confirmação; ausência de ficha/avaliação/permanência é aviso. Contratos sem frequência/polo reconhecidos mantêm sua descrição original.
3. Baixe o backup criptografado usando senha de ao menos 12 caracteres. A senha não é enviada ao servidor. Guarde arquivo e senha; os arquivos XLS originais ficam no seu computador.
4. Confirme a atualização da base. As alterações entram juntas em uma transação. Uma falha desfaz todas as alterações dessa confirmação.
5. Baixe o relatório da importação. O histórico permite reabrir os resultados. Após uma interrupção no envio, selecione os mesmos arquivos e a mesma data para retomar.

Uma importação já aplicada não é repetida. Corrigir a data de um lote ainda não aplicado cria uma preparação nova. Datas anteriores à versão ativa são bloqueadas. Se a base mudar entre a prévia e a confirmação, gere outra prévia e outro backup.

## Preservação

- Alunos associados por ID; nenhum aluno é excluído por ausência no lote.
- Chaves de contrato seguem `ID|DESCRICAO-NORMALIZADA|DATA-INICIO`. Contratos históricos são conservados.
- Cadastro do lote usa o contrato com maior vencimento; ficha e avaliação nunca regridem por ausência ou data anterior.
- Telefone existente divergente é preservado e aparece no relatório.
- Professor responsável, últimos professores, etiquetas, perfil de pagamento e observações manuais não são escritos pelo importador.
- Permanência atualiza alunos já conhecidos e registra alterações de campos. Cadastros encontrados somente em permanência não viram automaticamente novos alunos ativos.
- Leads, churns e novos alunos oficiais continuam com fluxo independente. Ausência e vencimento não geram churn automaticamente.

## Publicação

Aplicar `0005_weekly_upload.sql` antes de publicar o Worker/PWA. A migração é aditiva. Novas tabelas: `weekly_uploads`, `weekly_upload_chunks`, `weekly_upload_guard`. A confirmação remove os blocos temporários do lote aplicado e conserva seu relatório.

Os testes de integração usam SQLite em Node 24, além dos testes do projeto. O teste manual em Chrome utilizou os quatro arquivos reais contra banco temporário; não houve importação desses arquivos na produção.
