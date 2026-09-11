# Último professor no perfil do aluno — Plano de implementação

> **Para agentes:** Use `executing-plans` para executar tarefa por tarefa, com TDD.

**Objetivo:** Persistir vários últimos professores por aluno num único controle compacto e disponibilizar as etiquetas Performance e Coach.

**Arquitetura:** `ultimosProfessores` será uma lista de títulos, serializada em JSON na nova coluna `ultimos_professores` de `PERFIS_ALUNOS`. O PWA usará a lista de professores do catálogo correspondente ao status e enviará a lista no patch otimista. As etiquetas continuam a ser controladas pelo catálogo e validadas no servidor.

**Tecnologias:** Google Apps Script, JavaScript ES5, Node `node:test`.

## Restrições globais

- O modal continua fechando imediatamente após salvar.
- A lista de perfis preserva o estado aberto/recolhido escolhido pela pessoa usuária.
- Professor responsável continua único; último professor aceita zero ou mais opções.
- Perfis antigos sem a coluna nova devem ser lidos com lista vazia.

### Tarefa 1: Dados persistentes e catálogo

**Arquivos:** `apps-script/00_Config.gs`, `apps-script/18_DashboardPerfisAlunos.gs`, `tests/dashboard-configuracao.test.js`, `tests/dashboard-mutacoes.test.js`.

- [ ] Escrever testes que exijam o cabeçalho `ultimos_professores` após `professor_responsavel`, as chaves `performance` e `coach` no catálogo, e `['Aquiles','Cadu']` persistido como `"[\"Aquiles\",\"Cadu\"]"`.
- [ ] Executar `node --test tests/dashboard-configuracao.test.js tests/dashboard-mutacoes.test.js` e confirmar falha pelas propriedades ausentes.
- [ ] Atualizar `CONFIG.cabecalhos.perfisAlunos`, a migração legada, o leitor e o escritor de perfis. No escritor, validar `valores.ultimosProfessores || []` contra `professores` do grupo do aluno com `validarListaCatalogoPerfil_`, e inserir `JSON.stringify(ultimosProfessores)` antes de `perfilPagamento`.
- [ ] Incluir `['etiqueta', 'publico', 'performance', 'Performance', true, 60]` e `['etiqueta', 'comercial', 'coach', 'Coach', true, 40]` no catálogo padrão.
- [ ] Reexecutar os dois testes e confirmar sucesso.
- [ ] Commit: `feat: salvar ultimos professores no perfil`.

### Tarefa 2: Controle múltiplo compacto no PWA

**Arquivos:** `pwa/js/student-profiles.js`, `pwa/css/student-profiles.css`, `tests/student-profiles.test.js`.

- [ ] Escrever teste para `createProfilePatch(...).valores.ultimosProfessores` e para o controle `student-profile-multiselect` rotulado `Último professor`.
- [ ] Executar `node --test tests/student-profiles.test.js` e confirmar falha porque o patch e o controle ainda não existem.
- [ ] Criar uma função de campo múltiplo baseada em `<details>`: resumo `Sem histórico` quando vazio, nomes selecionados quando preenchido e checkboxes dentro da mesma lista expansível.
- [ ] Inserir o campo entre Professor responsável e Perfil de pagamento; preencher com `card.perfil.ultimosProfessores || []`; enviar `checkedValues` no patch; incluir `ultimosProfessores: []` no perfil padrão.
- [ ] Criar CSS para que o componente ocupe uma única célula, com resumo elipsado e painel de opções sem uma segunda lista fixa.
- [ ] Reexecutar `node --test tests/student-profiles.test.js` e confirmar sucesso.
- [ ] Commit: `feat: selecionar ultimos professores no perfil`.

### Tarefa 3: Cache, suíte e publicação

**Arquivos:** `pwa/sw.js`, `tests/pwa-shell.test.js`, este plano.

- [ ] Ajustar o teste de service worker para esperar `xsteam-static-v10` e observar sua falha.
- [ ] Alterar somente o nome do cache em `pwa/sw.js` para `xsteam-static-v10`.
- [ ] Executar `npm test` e confirmar toda a suíte verde.
- [ ] Commit: `chore: publicar perfil com ultimos professores`.
- [ ] Publicar em `main`, acompanhar GitHub Pages e confirmar que `sw.js` publicado anuncia `xsteam-static-v10`.
