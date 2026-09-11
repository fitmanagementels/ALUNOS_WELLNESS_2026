# Polimento visual do dashboard XSTEAM

**Data:** 28/07/2026
**Status:** aprovado para especificação; aguardando revisão do usuário antes da implementação.

## Objetivo

Evoluir o PWA operacional existente para uma interface contemporânea, premium e coerente com a marca XSTEAM, sem mudar as métricas, filtros, páginas, contratos de dados ou fluxos de gravação já implementados.

O dashboard continuará sendo uma ferramenta de acompanhamento diário. O acabamento visual deve aumentar legibilidade, conforto de uso e percepção de qualidade, sem virar uma página institucional ou comprometer velocidade.

## Diagnóstico atual

- A marca no PWA usa um `X` construído em CSS, diferente da marca oficial enviada.
- Cards, filtros e navegação usam contornos retos e fundo plano em excesso, com pouca hierarquia de superfície.
- O espaçamento entre grupos é curto e a tipografia não diferencia com clareza rótulos, números, textos auxiliares e ações.
- O destaque verde-limão ocupa estados ativos de forma abrupta, em vez de organizar o olhar com contraste e profundidade.

## Direção visual aprovada

**Tom:** operação premium, energética e precisa. Fundo escuro técnico, superfícies grafite, verde-limão XSTEAM reservado para foco, seleção e ação; cores semânticas continuam exclusivas dos alertas.

### Marca

- Adicionar o conteúdo de `User attachment.svg` ao arquivo HTML `XsteamLogo.html` como símbolo SVG local do Apps Script.
- Exibir a logo oficial no carregamento, topo da barra lateral e navegação móvel.
- A logo será renderizada como símbolo SVG reutilizável, com dimensões controladas; o antigo `.x-mark` CSS será removido.
- O nome `XSTEAM` permanece como texto acessível ao lado da marca na versão desktop; no mobile, a marca pode aparecer isolada onde o espaço for limitado.

### Sistema de superfícies

- Plano de fundo: preto-grafite com vinheta e iluminação verde-limão extremamente sutil, fixa e não interativa.
- Topbar: superfície translúcida com blur moderado e uma linha de separação de baixa opacidade.
- Cards e painéis: grafite em dois níveis, borda clara de baixa opacidade, raio consistente de 16px e sombra curta para separar camadas.
- A luz de fundo será feita apenas por gradientes CSS pouco contrastantes, sem blobs decorativos, imagens pesadas ou animações contínuas.

### Hierarquia e espaçamento

- Aplicar escala de 4/8/12/16/24/32px e limitar a largura de leitura no desktop.
- Títulos de página com tamanho e peso superiores; eyebrow mais discreta; data da base em um chip informativo.
- KPIs com valor maior, rótulo pequeno em alta legibilidade, nota contextual e área clicável inequívoca.
- Filtros agrupados em uma barra de contexto com rótulos e campos arredondados, sem molduras pesadas.
- Gráficos de barra, itens de detalhe e configurações recebem altura, alinhamento e áreas de toque mais confortáveis.

### Navegação

- Desktop: barra lateral escura com logo oficial, itens em cápsula arredondada, indicador ativo verde e estados hover/focus visíveis.
- Mobile: dock inferior elevada acima da área segura, quatro destinos equilibrados, ícone simples por destino e rótulo legível. O ativo recebe fundo e destaque, sem desperdiçar altura.
- Subabas de Financeiro e Acompanhamento: controle segmentado arredondado, com transição curta de cor e contraste, mantendo os mesmos destinos atuais.

### Estados e acessibilidade

- Preservar os nomes e as cores semânticas já definidos para prescrição e avaliação; não usar somente cor para comunicar um estado.
- Melhorar hover, foco de teclado, pressionado, desabilitado e erro de carregamento/salvamento.
- Modais terão fundo elevado, cabeçalho fixo, fechamento claro e leitura confortável no mobile.
- O carregamento inicial passa a usar a logo oficial, título “Gestão de alunos” e barra de progresso refinada.
- Respeitar `prefers-reduced-motion` para eliminar transições não essenciais.

## Componentes afetados

| Arquivo | Responsabilidade da mudança |
| --- | --- |
| `apps-script/XsteamLogo.html` | Símbolo SVG oficial incluído pelo template Apps Script. |
| `apps-script/DashboardComponents.html` | Substituir marca improvisada por SVG, introduzir ícones acessíveis de navegação e agrupamentos semânticos mínimos. |
| `apps-script/DashboardStyles.html` | Novo sistema de tokens, layout, superfícies, tipografia, responsividade, estados e motion reduzido. |
| `apps-script/DashboardClient.html` | Ajustar somente a criação de classes/ícones necessárias ao novo markup; não alterar regras de dados, filtros, cache ou fila. |
| `tests/dashboard-html.test.js` | Cobrir a presença da logo e estruturas/classes essenciais, além da verificação sintática existente. |

## Limites de escopo

Não faz parte desta entrega:

- novas métricas, gráficos ou abas;
- alteração nas regras de status, polo, alertas ou perfis de pagamento;
- alteração na API do dashboard, no cache, na fila de mutações ou nas abas da planilha;
- dependência externa de fontes, kits de ícones ou bibliotecas visuais;
- imagens de fundo, animações contínuas ou efeitos que aumentem de forma relevante o tempo de abertura.

## Dados e desempenho

- Todo polimento será client-side, em HTML/CSS/SVG local incluído pelo projeto Apps Script.
- A carga do SVG é pequena e embutida/servida junto ao PWA, sem nova chamada de dados ao Sheets.
- As funções `obterBootstrapDashboard`, cache local, revalidação e fila de mutações ficam inalteradas.
- Estilos não criarão reflow contínuo nem dependerão de canvas. Transições terão duração curta e serão desativadas para usuários que solicitarem menos movimento.

## Critérios de aceite

1. A logo oficial aparece corretamente na tela de carregamento, barra lateral desktop e dock mobile, sem distorção ou pixelização.
2. O dashboard preserva os dados, filtros, modais, páginas e salvamentos atuais.
3. Em desktop, a primeira área visível comunica página, data de atualização, filtros e KPIs sem aparência apertada.
4. Em mobile (até 720px), navegação, filtros e cards não causam rolagem horizontal e os botões têm área de toque mínima de 44px.
5. Todas as páginas possuem superfícies arredondadas, contraste adequado e estados interativos visíveis.
6. As classes de estado verde/laranja/vermelho/roxo/crítico continuam distinguíveis e legíveis.
7. O teste de frontend e a suíte completa do projeto continuam passando.

## Verificação manual

- Abrir Home, Financeiro/Planos, Financeiro/Vencimentos, Acompanhamento/Prescrições, Acompanhamento/Avaliações e Configurações no desktop.
- Alternar status e polo; abrir um KPI e confirmar que o modal continua mostrando a lista correta.
- Salvar um perfil de pagamento e uma configuração Home; confirmar feedback de fila/sucesso.
- Abrir a URL em uma viewport mobile e confirmar dock, subabas, modal e área segura inferior.
- Usar teclado para navegar entre filtros, botões e fechar o modal.
