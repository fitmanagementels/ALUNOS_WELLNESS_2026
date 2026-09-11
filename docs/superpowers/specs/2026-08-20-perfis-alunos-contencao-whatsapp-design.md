# Bloco retrátil, contenção dos cartões e WhatsApp nos perfis

## Objetivo

Organizar a Home com o bloco de perfis inicialmente recolhido, corrigir cartões que deixam nomes ou etiquetas de status ultrapassarem seus limites e oferecer acesso rápido ao WhatsApp ao lado do telefone no pop-up do aluno.

## Bloco retrátil na Home

- O cabeçalho **Perfis dos alunos** permanecerá visível na Home.
- Um botão com ícone de seta ficará no canto superior direito do cabeçalho.
- O bloco sempre iniciará recolhido quando a Home for renderizada, inclusive ao retornar de outra página ou aplicar filtros.
- Busca, quantidade no recorte, grade de cartões e botão **Mostrar mais** ficarão dentro do painel controlado e serão ocultados enquanto ele estiver recolhido.
- A preferência não será gravada em `localStorage` nem na planilha.
- O controle será um botão associado ao painel por `aria-controls`, com `aria-expanded` e rótulo acessível atualizado entre **Expandir perfis dos alunos** e **Recolher perfis dos alunos**.
- O ícone indicará o estado e acompanhará a transição sem impedir o uso quando a redução de movimento estiver ativada.

## Escopo visual

- Manter a grade atual: quatro colunas em desktop, duas em telas intermediárias e uma no celular.
- Conter todo o conteúdo dentro de cada cartão, inclusive nomes e status longos.
- Preservar o nome em uma linha com reticências quando não houver espaço.
- Manter o status legível dentro do cartão, sem invadir a coluna seguinte.
- Exibir o botão do WhatsApp somente ao lado do telefone na aba **Informações** do pop-up. O botão não será repetido nos cartões da Home.

## Comportamento do WhatsApp

- O link usará `https://wa.me/<numero>` para funcionar como universal link: abre o aplicativo quando disponível e mantém fallback para o WhatsApp Web.
- O telefone será reduzido apenas a dígitos.
- Telefones brasileiros com 10 ou 11 dígitos receberão o prefixo `55`.
- Telefones com 12 ou 13 dígitos que já comecem por `55` serão preservados.
- Valores fora dessas regras não exibirão o atalho, evitando um link incorreto.
- O link abrirá em nova aba com `rel="noopener noreferrer"` e terá rótulo acessível com o nome do aluno.

## Arquitetura e fluxo

- `pwa/js/student-profiles.js` concentrará a normalização do telefone, a geração da URL e a renderização específica do contato.
- `pwa/js/student-profiles.js` também controlará o botão retrátil e o painel de perfis, sempre criado no estado recolhido.
- `pwa/css/student-profiles.css` receberá as regras de contenção do cartão, o estado retrátil e o alinhamento do telefone com o botão.
- O estilo visual do botão reutilizará o padrão `.whatsapp-button` já usado no módulo de Leads.
- O HTML base continuará carregando os mesmos módulos; somente a versão do cache estático em `pwa/sw.js` será incrementada para distribuir os arquivos corrigidos.
- Não haverá mudança na planilha, no contrato do Apps Script ou na persistência dos perfis.

## Tratamento de erro

- Telefone ausente ou inválido permanece visível como dado não informado ou texto original, mas sem ação de WhatsApp.
- A correção de layout não ocultará o status: nomes são truncados, enquanto a etiqueta de status permanece acessível no cartão.

## Testes e validação

- Testes unitários para telefones brasileiros formatados, já prefixados e inválidos.
- Teste do estado inicial recolhido e dos atributos acessíveis durante expansão e recolhimento.
- Teste estrutural para garantir as regras de contenção e a atualização do cache do PWA.
- Suíte completa do projeto após a alteração.
- Inspeção visual em desktop e celular com nomes e status longos, além do pop-up com o atalho ao lado do telefone.

## Fora de escopo

- Envio automático de mensagem ou texto pré-preenchido.
- Botão de WhatsApp diretamente nos cartões da Home.
- Persistência da preferência de expansão entre renderizações da Home.
- Alterações na planilha, no cadastro do aluno ou no número armazenado.
