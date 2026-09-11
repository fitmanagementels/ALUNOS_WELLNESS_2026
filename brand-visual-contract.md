# Contrato visual XSTEAM — Perfis de alunos

## Orquestração BRAND
- Pedido e contexto detectado: adaptar a Home operacional existente para incluir cartões de alunos e um diálogo de perfil/configuração.
- Rota escolhida e justificativa: frontend existente → auditoria e alinhamento; a navegação, os filtros e os tokens atuais já estão implementados e precisam ser preservados.
- Skills executadas: `brand-orquestrar-fluxo-visual`, `brand-auditar-e-alinhar-frontend`.
- Skills não usadas e motivo: `brand-organizar-informacao-visual` não é necessária porque a hierarquia aprovada já define a seção abaixo das filas; `brand-criar-navegacao-interacao` não é necessária porque o padrão de diálogo, foco e feedback já existe; `brand-aplicar-marca-e-acabamento` não é necessária como etapa separada porque os novos componentes reutilizarão integralmente os tokens e estados existentes.
- Premissas assumidas: a Home operacional incorporada no merge `f6a51dc` é a baseline visual; os dados reais continuam protegidos pelo fluxo atual do PWA.
- Pergunta pendente, se houver: nenhuma.

## Auditoria e contrato de adaptação

### Inventário e evidências
- Rotinas críticas: filtros globais; filas independentes de fichas e avaliações; agenda financeira; navegação para acompanhamento; configuração de prazos e prioridades; fila de mutações com feedback e nova tentativa.
- Estrutura, componentes e integrações: `dashboard.js` compõe a Home e mantém estado/cache; `dashboard.css` define superfícies dark, lime, foco e breakpoints; `detailDialog` fornece overlay existente; Apps Script entrega bootstrap e mutações idempotentes.
- Estados e viewports verificados: código e testes cobrem loading, vazio, erro de salvamento, sucesso, desabilitado, desktop e breakpoints de 860/720/520 px; baseline automatizada com 20/20 testes.
- Limitações da auditoria: antes da implementação, a prévia local não possui API configurada; a validação visual com bootstrap controlado será feita na etapa final.

### Preservar
- Filas operacionais independentes — presentes em `renderHomeQueue` e cobertas por testes — não substituir `renderHome`, apenas anexar a nova seção.
- Filtros globais e interseção aluno/contrato — presentes em `filtered()` — fornecer ao módulo somente o recorte resultante.
- Tema dark, superfícies e acento lime — tokens em `dashboard.css` — consumir variáveis existentes sem redefinir a marca.
- Feedback de salvamento e retry — `enqueue`, `aplicarMutacaoOtimista` e `reverterMutacaoOtimista` — integrar o novo patch ao mesmo pipeline.

### Diagnóstico priorizado
| Prioridade | Achado | Evidência | Impacto | Mudança mínima | Verificação |
|---|---|---|---|---|---|
| Alto impacto | A Home não oferece acesso ao perfil individual | `renderHome` retorna somente introdução e grade operacional | Configurações manuais ficam dispersas | Anexar seção secundária de perfis após a grade atual | Teste de render e fluxo no navegador |
| Alto impacto | Pagamento individual está em Configurações | `renderPaymentSettings` seleciona aluno | Mistura catálogo global e dado individual | Mover edição para o diálogo e manter somente catálogo na página | Teste estrutural e funcional |
| Alto impacto | O diálogo atual não separa leitura e edição | `detailDialog` tem um único conteúdo genérico | Maior risco de edição acidental | Criar diálogo próprio com abas Informações/Configuração | Teclado, foco, mobile e submit |
| Polimento | Cartões precisam conviver com a densidade operacional | Home já usa mosaico de duas colunas | Excesso de destaque competiria com filas | Grade de quatro colunas com superfície neutra e lime apenas em foco/CTA | Capturas em 1440, 1024, 768 e 390 px |

### Sequência de adaptação
1. Persistir perfis e catálogos sem tocar nas abas importadas.
2. Entregar dados normalizados pelo bootstrap e validar mutações no servidor.
3. Criar módulo cliente testável e estilos isolados.
4. Anexar a seção depois da Home operacional e integrar a fila de mutações.
5. Verificar estados, teclado e responsividade com bootstrap controlado.

### Encaminhamento seletivo
| Skill | Usar? | Evidência que justifica | Resultado esperado |
|---|---|---|---|
| `brand-organizar-informacao-visual` | Não | Hierarquia e composição já aprovadas e a Home atual é funcional | Preservar a composição existente |
| `brand-criar-navegacao-interacao` | Não | Diálogo, tabs, foco e feedback têm contrato explícito no plano | Implementar com os padrões existentes |
| `brand-aplicar-marca-e-acabamento` | Não | Tokens, contraste e motion já existem e serão reutilizados | Evitar nova camada estética e manter consistência |
