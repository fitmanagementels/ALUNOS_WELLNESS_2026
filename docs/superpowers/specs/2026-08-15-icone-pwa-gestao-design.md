# Ícone do PWA XSTEAM Gestão

## Objetivo

Substituir o ícone simplificado exibido na instalação do PWA por uma versão da marca oficial XSTEAM, distinguindo o aplicativo de Gestão com duas barras diagonais finas no canto inferior direito.

## Desenho aprovado

- Base quadrada verde-limão, com cantos arredondados.
- Símbolo oficial XSTEAM em preto, centralizado e preservado sem alteração.
- Duas barras diagonais pretas, curtas e finas, separadas do símbolo principal e posicionadas no canto inferior direito.
- O marcador diferencia somente o ícone de instalação; logos exibidos no dashboard permanecem inalterados.

## Limites

- Não alterar dados, Apps Script, Worker, backend, autenticação ou telas do PWA.
- Manter o manifesto apontando para um único SVG maskable, sem adicionar bibliotecas ou imagens raster.

## Verificação

- O manifesto deve referenciar o novo SVG.
- O SVG deve conter o desenho oficial e exatamente duas barras do marcador.
- O teste do shell PWA deve assegurar o novo ativo no manifesto.
