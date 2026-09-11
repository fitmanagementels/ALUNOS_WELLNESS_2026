# WhatsApp adaptativo no perfil do aluno

## Objetivo

Abrir a conversa do aluno no destino mais adequado sem passar pela página intermediária de `api.whatsapp.com`: WhatsApp Web/PWA no desktop e aplicativo do WhatsApp no celular.

## Causa confirmada

O atalho atual usa `https://wa.me/<telefone>`. No desktop, esse endereço responde com um redirecionamento para `https://api.whatsapp.com/send/...`, cuja página tenta acionar o protocolo nativo do sistema. No ambiente Linux do usuário isso produz a confirmação “Abrir xdg-open?” e não entrega diretamente a conversa ao PWA instalado do WhatsApp Web.

A rota `https://web.whatsapp.com/send?phone=<telefone>` responde diretamente no domínio controlado pelo PWA do WhatsApp Web. Navegações dentro do escopo de um PWA instalado podem ser capturadas pelo Chrome conforme a versão e a preferência de abertura de links do usuário.

## Comportamento aprovado

- No desktop, o ícone usa `https://web.whatsapp.com/send?phone=<telefone>`.
- Em celular ou tablet móvel, o ícone mantém `https://wa.me/<telefone>`.
- O visual, o ícone e a posição ao lado do telefone não mudam.
- O destino abre separadamente para preservar o contexto do XSTEAM.
- Se o Chrome estiver configurado para capturar links do WhatsApp Web, a navegação é entregue ao PWA instalado.
- Se a captura não estiver ativa, o fallback é abrir diretamente o WhatsApp Web em uma aba, sem a página intermediária de `api.whatsapp.com`.
- Telefones inválidos continuam sem exibir o atalho.

## Detecção de ambiente

A seleção do destino ocorre no navegador quando o perfil é renderizado:

1. usar `navigator.userAgentData.mobile` quando disponível;
2. aplicar fallback por identificadores móveis conhecidos no `navigator.userAgent`;
3. tratar ambientes sem evidência móvel como desktop.

A normalização do telefone permanece independente da seleção de destino: números brasileiros de 10 ou 11 dígitos recebem o DDI `55`; números já iniciados por `55` não recebem o DDI novamente.

## Estrutura do código

- Separar a normalização do telefone da construção da URL.
- Manter uma função pura para escolher a URL a partir do número normalizado e do sinal `mobile`.
- Obter o sinal de ambiente apenas na camada que cria o link do contato.
- Não alterar Apps Script, planilha, Worker ou contratos de dados.

## Segurança e acessibilidade

- Manter `target="_blank"` e `rel="noopener noreferrer"`.
- Preservar o rótulo acessível “Abrir WhatsApp com <aluno>”.
- Não inserir o nome do aluno nem outros dados pessoais na URL.

## Testes e validação

- Testar telefone nacional e telefone já acompanhado do DDI.
- Testar URL de desktop apontando para `web.whatsapp.com`.
- Testar URL móvel apontando para `wa.me`.
- Testar telefone inválido sem link.
- Confirmar que o link renderizado usa o ambiente do navegador.
- Executar a suíte completa.
- Validar no navegador desktop que o clique não passa por `api.whatsapp.com`.
- Validar em viewport móvel que o destino permanece `wa.me`.
- Incrementar a versão do cache do service worker para publicar os arquivos novos imediatamente.

## Fora de escopo

- Configurar as preferências do Chrome ou do PWA do WhatsApp no computador do usuário.
- Instalar ou substituir o PWA do WhatsApp.
- Criar menu com múltiplos destinos.
- Adicionar mensagem inicial automática.

## Referência

- Chrome for Developers, “Navigation management into installed PWAs”: https://developer.chrome.com/docs/capabilities/pwa-navigation-management
