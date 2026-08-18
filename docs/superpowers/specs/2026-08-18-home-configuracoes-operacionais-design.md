# Home e configurações operacionais

Data: 18 de agosto de 2026

## Contexto

A Home atual apresenta contagens isoladas e mistura situações operacionalmente diferentes. Registros sem ficha, fichas com cerca de 100 dias e fichas com mais de 300 dias podem aparecer no mesmo recorte, o que dificulta identificar a próxima ação. A página de Configurações agrupa controles distintos em um formulário longo, com pouca hierarquia e sem mostrar o efeito das regras antes do salvamento.

As telas analisadas pertencem a uma versão com as áreas Home, Financeiro, Acompanhamento, Fluxo e Configurações. O código disponível nesta pasta ainda corresponde à versão anterior de Gestão de Agenda. A implementação depende de localizar ou trazer para esta pasta o código-fonte da versão exibida nas capturas.

## Objetivo

Transformar a Home em uma fila de prioridades para a operação diária e reorganizar as Configurações para que regras, limites e efeitos sejam fáceis de entender.

Ao abrir a Home, o gestor deve responder imediatamente: **o que precisa de ação hoje?**

## Princípios aprovados

- Fichas/prescrições e avaliações são processos independentes.
- Os dois processos não compartilham fila, contagem ou faixas.
- Dentro de cada fila, as categorias são mutuamente exclusivas.
- Um aluno pode aparecer uma vez na fila de fichas e uma vez na fila de avaliações, pois são necessidades diferentes.
- A ausência de registro tem a maior prioridade dentro de cada processo.
- As listas usam somente dados internos da planilha; não sugerem contato com o cliente.
- Informações financeiras ficam em uma seção secundária da Home.
- Valores monetários e contratos não aparecem nas listas de fichas ou avaliações quando não ajudam a decisão.

## Home

### Cabeçalho

O primeiro bloco contém:

- título `O que precisa de ação`;
- data e hora do último lote válido;
- aviso explícito quando a base estiver desatualizada ou incompleta.

### Fila de fichas/prescrições

Bloco próprio com:

- total que precisa de revisão;
- categorias ordenadas da maior para a menor prioridade;
- contagem por categoria;
- ação `Abrir fichas`;
- clique em cada categoria abrindo a lista já filtrada.

Categorias conceituais, sem exigir a mesma quantidade de faixas nos dois processos:

1. `Sem ficha`: não existe data ou registro válido de ficha/prescrição.
2. `Crítico`: ultrapassou o maior limite configurado.
3. `Muito atrasado`: está entre os dois maiores limites configurados.
4. `Atrasado`: ultrapassou um limite intermediário.
5. `Atenção`: faixa adicional quando o processo possuir mais pontos de corte.
6. `Em dia`: fica fora da fila de ação e aparece apenas como informação diagnóstica, se necessário.

Cada ponto de corte cria uma faixa exclusiva. Se avaliações possuírem quatro limites e fichas possuírem três, a Home respeita essa diferença; não inventa nem remove categorias para igualar os dois blocos.

### Fila de avaliações

Bloco visualmente equivalente, mas funcionalmente independente, com:

- total próprio;
- categorias e limites próprios;
- ação `Abrir avaliações`;
- rótulo `Sem avaliação` para ausência de registro;
- lista detalhada que nunca mistura fichas/prescrições.

### Financeiro

A agenda financeira aparece depois das duas filas operacionais, com menor peso visual. Pode resumir `Últimos 5 dias`, `Vencem hoje` e `Próximos 5 dias`, oferecendo a ação `Ver financeiro`.

## Classificação dos registros

Cada processo usa a data do seu registro mais recente e a configuração correspondente.

Para fichas/prescrições:

1. selecionar o registro válido mais recente do aluno;
2. se não houver registro ou data válida, classificar como `Sem ficha`;
3. calcular os dias desde o registro;
4. comparar o resultado com os limites de fichas, do maior para o menor;
5. atribuir exatamente uma categoria.

Para avaliações, repetir o mesmo algoritmo usando somente registros e limites de avaliações. Os limites dos dois processos podem ser diferentes.

As faixas devem ser derivadas automaticamente dos pontos de corte para impedir sobreposição. Exemplo para limites 90, 180 e 270 dias:

- até 90: em dia;
- 91 a 180: atrasado;
- 181 a 270: muito atrasado;
- acima de 270: crítico.

Os números do protótipo são ilustrativos e não devem virar valores fixos no código.

## Listas operacionais

`Abrir fichas` e `Abrir avaliações` levam a telas dedicadas, não a um modal genérico.

Cada tela contém:

- busca por nome ou matrícula;
- filtros por categoria e status do aluno;
- total do recorte ativo;
- nome e matrícula;
- situação e quantidade exata de dias;
- data do último registro;
- ação para abrir o detalhe correspondente.

A ordenação padrão é:

1. ausência de registro;
2. maior quantidade de dias de atraso;
3. nome do aluno.

O detalhe completo fica sob demanda. A lista não repete contratos, valores ou histórico que não alterem a decisão.

## Configurações

A página deixa de ser um formulário contínuo e passa a ter navegação interna por assunto:

1. `Prazos das fichas`;
2. `Prioridades da Home`;
3. `Perfil de pagamento`.

### Prazos das fichas

Contém abas internas para `Fichas/prescrições` e `Avaliações`. Cada aba mostra:

- nome e significado de cada categoria;
- ponto de corte editável;
- intervalo resultante, calculado automaticamente;
- ordem de prioridade;
- prévia das contagens da Home antes de salvar.

O sistema impede salvamento quando os limites estiverem duplicados, fora de ordem, negativos ou incompletos. Alterar limites de fichas nunca altera avaliações, e vice-versa.

### Prioridades da Home

Controla visibilidade e ordem dos blocos da Home por meio de uma lista compacta. Não usa caixas de seleção grandes nem campos numéricos ambíguos. Cada controle possui rótulo, explicação curta e estado claro.

As filas de fichas e avaliações continuam separadas mesmo quando sua ordem visual é alterada.

### Perfil de pagamento

Permanece como área própria, sem dividir o mesmo cartão ou fluxo de salvamento com alertas e regras da Home.

### Salvamento

Cada área tem um único botão `Salvar alterações`. A interface diferencia os estados:

- sem alterações;
- alterações não salvas;
- salvando;
- salvo;
- erro ao salvar.

Ao sair com alterações pendentes, a interface solicita confirmação.

## Estados e recuperação

- Carregamento: usar estrutura de esqueleto sem exibir zero temporário.
- Lista vazia: comunicar que não há pendências naquele recorte e oferecer retorno à Home.
- Base desatualizada: mostrar a data do último lote válido e um alerta; não interpretar falta de dados como ausência de pendência.
- Erro de leitura: manter a mensagem no contexto do bloco afetado e permitir nova tentativa.
- Configuração inválida: preservar os valores digitados e explicar o ajuste necessário ao lado do campo.
- Salvamento concluído: atualizar a prévia e a Home sem recarregamento integral quando possível.

## Responsividade e acessibilidade

- Em desktop, as duas filas aparecem lado a lado.
- Em telas menores, fichas aparecem primeiro e avaliações em seguida.
- Listas tabulares viram cartões empilhados no celular, sem rolagem horizontal obrigatória.
- Alvos interativos têm pelo menos 44 pixels.
- Cor não é o único indicador de prioridade; todos os estados têm rótulo textual.
- Foco, navegação por teclado, contraste e mensagens de erro devem permanecer visíveis.

## Critérios de aceitação

- A primeira tela mostra claramente duas filas independentes: fichas e avaliações.
- Um clique em qualquer categoria abre uma lista filtrada do processo correto.
- Nenhuma lista mistura fichas/prescrições com avaliações.
- Dentro de cada processo, um aluno ocupa somente uma categoria de prioridade.
- Ausência de registro é distinguida de qualquer faixa de atraso.
- Registros de 100 e mais de 300 dias aparecem em categorias diferentes quando os limites configurados assim determinarem.
- Alterar um ponto de corte atualiza a prévia sem gerar intervalos sobrepostos.
- Dados financeiros não competem visualmente com as prioridades de fichas e avaliações.
- Estados de carregamento, vazio, erro e base desatualizada não apresentam contagens enganosas.
- A Home e as Configurações funcionam sem rolagem horizontal em desktop e celular.

## Verificação

- Testar ausência de registro, datas nos limites exatos e um dia antes/depois de cada limite.
- Testar aluno com múltiplos registros e confirmar o uso do mais recente.
- Testar o mesmo aluno com ficha atrasada e avaliação em dia, e também o inverso.
- Confirmar que a soma das categorias de uma fila corresponde ao total dessa fila.
- Confirmar que nenhum registro aparece em duas categorias da mesma fila.
- Testar alteração, salvamento, erro e recuperação das configurações.
- Validar desktop, tablet e celular com textos e contagens reais.

## Fora do escopo

- Criar contato ou cobrança automática de clientes.
- Misturar informações financeiras nas filas de fichas e avaliações.
- Criar um sistema de tarefas persistentes ou marcar itens como concluídos sem uma fonte de dados definida.
- Alterar a estrutura da planilha antes de localizar e revisar o código da versão atualmente implantada.
