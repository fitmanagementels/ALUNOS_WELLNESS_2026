# Filtros de Leads e dock móvel — design

## Objetivo

Transformar os indicadores de Leads em filtros diretos da lista e reduzir a navegação móvel para uma única linha de ícones.

## Filtros de Leads

- Cinco cartões clicáveis: Todos, Convertidos, Perdidos, Perdendo e Em trabalho.
- Perdidos contém apenas `Perdido`; Perdendo, apenas `Esfriando`; Convertidos, apenas `Convertido`.
- Em trabalho contém todos os demais status: Novo, Em contato, Experimental agendado e Experimental realizado.
- O cartão ativo usa destaque visual e `aria-pressed`; Todos remove o filtro.
- A lista informa o recorte ativo, continua ordenada por primeiro contato e não altera os dados persistidos.

## Status e ações

- Convertido: verde; Experimental realizado/agendado e estados restantes: amarelo; Esfriando: laranja; Perdido: vermelho; Novo: azul.
- WhatsApp é um botão circular discreto, com SVG de balão/telefone e nome acessível. Continua abrindo a conversa em outra aba.

## Responsividade

- Desktop: cartões de filtro em cinco colunas; leads em grade de duas colunas.
- Mobile: filtros em grade 2 + 2 + 1, sendo o último cartão largura completa; lista em uma coluna.
- A dock móvel usa cinco ícones, uma única linha, com nomes acessíveis e sem rótulos visuais.
- Estados ativos preservam contraste e alvos de toque de ao menos 44 px.
