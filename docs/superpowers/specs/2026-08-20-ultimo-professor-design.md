# Último professor no perfil do aluno

## Objetivo

Permitir registrar um ou mais últimos professores de cada aluno sem ampliar a configuração visual com duas listas, além de disponibilizar as etiquetas `Performance` (Público) e `Coach` (Comercial).

## Experiência no PWA

Na aba **Configuração** do perfil, a primeira linha passa a conter, nesta ordem: **Professor responsável**, **Último professor** e **Perfil de pagamento**. Em telas estreitas, os campos continuam se reorganizando em colunas conforme o espaço disponível.

**Último professor** será um único controle compacto de seleção múltipla. Ao abri-lo, a pessoa usuária marca ou desmarca professores da mesma lista já usada em **Professor responsável**. O campo fechado resume a escolha com os nomes selecionados; sem seleção, mostra `Sem histórico`. Assim, não há dois seletores paralelos nem duplicação de espaço.

## Dados e compatibilidade

A aba `PERFIS_ALUNOS` receberá a coluna `ultimos_professores` logo após `professor_responsavel`. O valor persistido será JSON de uma lista de nomes, por exemplo `["Elohim","Cadu"]`.

Leituras de planilhas já existentes aceitam a ausência da nova coluna e retornam uma lista vazia. Na primeira gravação de qualquer perfil, a rotina garante que o cabeçalho atualizado exista antes de salvar. O campo `professor_responsavel` continua sendo uma escolha única e independente.

## Catálogo de etiquetas

O catálogo padrão em `CONFIG_PERFIS_ALUNOS` passa a incluir:

- Público: `Performance`, após `Corrida`.
- Comercial: `Coach`, após `Elohim`.

As duas etiquetas usam o fluxo existente: são carregadas no bootstrap, exibidas nos grupos corretos e validadas no servidor antes da gravação.

## Fluxo de gravação e falhas

O patch de perfil passa a transportar `ultimosProfessores` como lista. A atualização continua otimista: o modal fecha imediatamente, a lista de alunos preserva o estado aberto/recolhido escolhido pela pessoa usuária e a fila global exibe tentativa de repetição se a gravação remota falhar.

## Verificação

Os testes devem cobrir a migração de cabeçalho, leitura da lista armazenada, validação e persistência do novo campo, as duas novas etiquetas e o contrato do seletor múltiplo no PWA. A suíte completa existente deve permanecer verde.
