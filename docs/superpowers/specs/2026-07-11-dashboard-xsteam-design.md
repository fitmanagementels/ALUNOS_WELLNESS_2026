# Dashboard XSTEAM — Especificação de Design

- Data: 11/07/2026
- Estado: aprovado para planejamento
- Fuso horário: `America/Fortaleza`
- Fonte: `Tecnofit_Base_Mestre`

## 1. Objetivo

Criar um dashboard de gestão da base TecnoFit com foco principal em desktop e uso ocasional no celular. A aplicação combinará análise estatística e acompanhamento operacional de vencimentos, fichas prescritas, avaliações físicas e planos dos alunos.

O primeiro ciclo será enxuto, mas a arquitetura permitirá evoluir cada página sem reorganizar toda a aplicação.

## 2. Direção visual

O design aprovado é inspirado na identidade da XSTEAM:

- fundo preto ou grafite e superfícies em cinza escuro;
- textos brancos de alto contraste;
- verde-limão para ações, navegação ativa e destaques;
- vermelho e âmbar somente para alertas;
- tipografia forte nos títulos e compacta nos dados;
- cartões, gráficos e tabelas com hierarquia clara.

O logotipo aparecerá no início da navegação sem disputar atenção com os indicadores.

## 3. Arquitetura

O dashboard será uma aplicação web única em Google Apps Script. As quatro páginas serão visões internas independentes, trocadas sem recarregar todo o documento.

Cada página terá funções próprias de transformação e apresentação. Permanecerão compartilhados:

- estrutura da aplicação e navegação;
- filtros e busca;
- cartões, gráficos e tabelas;
- estados de carregamento, vazio e erro;
- formatação de datas, números e moeda.

## 4. Navegação responsiva

### 4.1 Desktop

- menu lateral fixo com logotipo e quatro páginas;
- cabeçalho com nome da página, busca e última atualização;
- filtros antes dos indicadores;
- quatro indicadores por linha quando houver espaço;
- gráficos em duas colunas;
- tabela operacional em largura total.

### 4.2 Tablet

- menu lateral reduzido para ícones;
- indicadores em duas colunas;
- gráficos reorganizados segundo a largura disponível.

### 4.3 Celular

- navegação inferior fixa com quatro destinos;
- cabeçalho compacto;
- indicadores em carrossel horizontal;
- filtros roláveis ou recolhíveis;
- gráficos empilhados;
- cartões de aluno no lugar de tabelas inadequadas para telas estreitas;
- informações urgentes antes das análises secundárias.

## 5. Páginas

### 5.1 Vencimentos

Indicadores:

- contratos vencidos;
- contratos que vencem em até 7 dias;
- contratos que vencem em até 30 dias;
- soma dos valores que vencem em até 30 dias.

Gráficos:

- vencimentos por semana;
- distribuição entre vencido, até 7 dias, de 8 a 30 dias e posterior a 30 dias;
- análise complementar por polo.

Lista operacional: aluno, contato, frequência, polo, vencimento, situação, valor e acesso aos detalhes. A ordenação será por vencimento crescente, com vencidos primeiro.

### 5.2 Fichas prescritas

Indicadores:

- alunos distintos com ficha;
- alunos distintos sem ficha;
- alunos distintos com ficha desatualizada;
- cobertura de fichas.

Regras iniciais:

- `data_ficha` vazia significa ficha ausente;
- ficha anterior à data atual menos 30 dias significa ficha desatualizada;
- o limite de 30 dias será centralizado e configurável.

Gráficos: situação da ficha, faixas de tempo desde a prescrição e cobertura por polo, sempre deduplicando `id`.

Lista operacional: alunos sem ficha primeiro e, depois, fichas mais antigas. Exibirá aluno, contato, polo, última ficha e dias sem atualização.

### 5.3 Avaliações

Indicadores:

- alunos distintos com avaliação;
- alunos distintos sem avaliação;
- alunos distintos com avaliação desatualizada;
- cobertura de avaliações.

Regras iniciais:

- `data_avaliacao` vazia significa avaliação ausente;
- avaliação anterior à data atual menos 90 dias significa avaliação desatualizada;
- o limite de 90 dias será centralizado e configurável.

Gráficos: situação da avaliação, faixas de tempo desde a avaliação e cobertura por polo, sempre deduplicando `id`.

Lista operacional: alunos sem avaliação primeiro e, depois, avaliações mais antigas. Exibirá aluno, contato, polo, última avaliação e dias sem atualização.

Métricas corporais ficam fora desta fase porque a base contém apenas a data da avaliação.

### 5.4 Planos dos alunos

Indicadores:

- alunos distintos;
- contratos distintos por `_chave_contrato`;
- soma de `valor`;
- ticket médio por contrato.

Gráficos:

- contratos por polo;
- contratos por `contrato_x_sem`;
- contratos por modalidade;
- contratos por `status_contrato`;
- valor contratado por polo.

Tabela: aluno, status do aluno, frequência, modalidade, polo, início corrente, vencimento, status do contrato e valor.

## 6. Fontes e integridade

- `BASE_ALUNOS`: fonte efetivamente lida para dados únicos do aluno, contagens e coberturas;
- `CONTRATOS`: fonte efetivamente lida para contratos, datas, polos, modalidades, frequências, status e valores;
- `VISAO_MESTRE`: visão consolidada disponível na planilha para conferência e integrações futuras, mas não lida pela API atual do dashboard;
- `IMPORTACOES`: última atualização, resultado e mensagens da carga.

Regras contra duplicidade:

- alunos são contados por `id` distinto;
- contratos são contados por `_chave_contrato` distinta;
- cada contrato contribui uma vez para as somas financeiras;
- um aluno pode aparecer em mais de um polo se tiver contratos distintos;
- cobertura por polo deduplica `id` dentro de cada polo.

Datas serão exibidas em `dd/MM/yyyy` e calculadas no fuso `America/Fortaleza`.

## 7. Filtros e interação

Filtros compartilhados:

- polo;
- status do aluno;
- período de referência.

Filtros específicos aparecerão apenas quando forem úteis: situação do vencimento, frequência, modalidade ou status do contrato.

Os filtros permanecerão ativos durante a sessão. A busca localizará alunos por nome ou ID. Uma mudança de filtro atualizará cartões, gráficos e lista da página de forma consistente.

## 8. Fluxo de dados

1. O navegador solicita os dados da página ativa.
2. O Apps Script lê somente as abas e colunas necessárias.
3. O servidor normaliza datas, números e identificadores.
4. Funções puras calculam indicadores, séries e linhas operacionais.
5. O navegador recebe um objeto específico da página.
6. Os componentes renderizam o resultado.
7. Filtros reaplicam os cálculos ou solicitam nova consulta quando necessário.

O cliente não receberá colunas técnicas ou dados desnecessários à página atual.

## 9. Estados e erros

Cada página terá quatro estados:

- carregando: esqueletos nos cartões, gráficos e lista;
- pronto: dados e última atualização visíveis;
- vazio: mensagem contextual e ação para limpar filtros;
- erro: mensagem clara, nova tentativa e navegação preservada.

Se a última importação falhar, o dashboard exibirá a última base válida e um aviso com a data da falha. Datas de ficha ou avaliação vazias serão classificadas como ausentes, sem impedir a abertura da página.

## 10. Privacidade

- acesso restrito a usuários autorizados;
- contatos ausentes de gráficos e registros técnicos;
- contatos parcialmente ocultos no celular até a abertura do detalhe;
- mensagens de erro sem nomes, telefones ou linhas completas;
- logs com IDs e contagens sempre que possível.

## 11. Desempenho

- carregamento apenas dos dados necessários à página;
- componentes compartilhados carregados uma vez;
- cache curto para agregações repetidas;
- reutilização dos dados válidos da sessão;
- paginação ou carregamento incremental nas listas longas.

## 12. Testes e aceitação

### 12.1 Cálculos

- um aluno com dois contratos conta como um aluno e dois contratos;
- cada contrato contribui uma vez para o valor total;
- limites de vencimento de 7 e 30 dias são classificados corretamente;
- limites exatos de 30 dias para ficha e 90 dias para avaliação são consistentes;
- datas vazias são classificadas como ausentes;
- cálculos respeitam `America/Fortaleza`.

### 12.2 Interface

- quatro páginas acessíveis pelo menu lateral no desktop;
- quatro páginas acessíveis pela barra inferior no celular;
- filtros atualizam todos os componentes da página;
- carregamento, vazio e erro são visíveis;
- tabelas não criam rolagem horizontal na aplicação móvel;
- contraste e alvos de toque permitem uso confortável.

### 12.3 Integração

- leitura das quatro abas pelos nomes definitivos;
- última atualização obtida em `IMPORTACOES`;
- falha de leitura não quebra a navegação;
- cálculos independem da ordem física das linhas;
- informações pessoais não aparecem em logs de erro.

## 13. Fora do escopo inicial

- edição da base pelo dashboard;
- mensagens automáticas aos alunos;
- registro de contatos ou tarefas comerciais;
- análises de evolução corporal;
- perfis de acesso com permissões diferentes;
- exportações avançadas.

Esses recursos poderão ser avaliados futuramente sem alterar a arquitetura principal.
