# Guia PHP

Site: https://wallysondevs.github.io/guia-php/

Curso de PHP 8.5 em português, do zero ao avançado, feito para quem **nunca programou**. Funciona como uma escola: uma aula para cada assunto, organizadas em **3 níveis + projetos + referência** (123 páginas).

Cada aula explica o código linha por linha (anatomia), mostra a saída real, o que acontece quando dá errado (com a mensagem verdadeira do PHP), formas diferentes de fazer e exercícios no fim. Todas as saídas foram conferidas num PHP de verdade, o **PHP 8.5.8** de linha de comando.

Para praticar, as páginas trazem o editor **Experimente** (`.tryphp`), que roda **o PHP de verdade** no seu navegador, em dois modos:

- **Modo cli** (padrão): como `php programa.php` no terminal. Você vê a saída, os avisos e erros em vermelho e o código de saída. Se o programa lê o teclado, ele para e espera você digitar.
- **Modo web**: como um `php -S localhost:8000`. A caixa mostra o **Resultado** da página e o **código-fonte HTML**, com barra de endereço; links, formulários, cookies e sessões funcionam.

Nas **missões**, a caixa confere se você chegou ao resultado pedido. O editor usa `assets/phpsim.js` com o **PHP 8.5.10 oficial compilado para WebAssembly** (`@php-wasm`, o motor do WordPress Playground). Não é uma imitação. Ele fica hospedado no próprio site (`assets/php/`), só é baixado no primeiro clique em **Rodar** (cerca de 7,9 MB) e roda num Web Worker: o botão **Parar** encerra um laço infinito sem travar a página.

Site 100% estático (HTML + CSS + JS, sem build e sem dependências externas): funciona no GitHub Pages. Para usar o editor no seu computador, sirva a raiz do site com um servidor local em vez de abrir o arquivo direto.

## Estrutura

```
index.html                 página inicial
<tema>.html                uma aula por tema
assets/style.css           visual
assets/site.js             níveis/menu (lista NIVEIS), Anterior/Próximo, anatomia, exercícios
assets/phpsim.js           o editor "Experimente" (caixas .tryphp)
assets/php/                o PHP 8.5 em WebAssembly e o Web Worker; veja assets/php/LEIA.md
tools/sim.js               roda um .php como o editor rodaria (modo cli ou web)
tools/testar-missoes.js    testa todas as caixas "Experimente" com o mesmo PHP do navegador
tools/php-node.js          carrega no Node o mesmo PHP do navegador
tools/lab-nativo.js        compara com o PHP nativo do laboratório
tools/construir-php.mjs    gera a pasta assets/php/
tools/php-src/             fontes do motor do editor
tools/demo.html            página de teste das caixas .tryphp
tools/package.json         dependências das ferramentas (@php-wasm)
CONTRIBUINDO.md            como escrever uma aula
.nojekyll                  faz o GitHub Pages servir os arquivos como estão
```

## Testes

As ferramentas usam Node 24. Instale as dependências uma vez com `cd tools && npm install`.

```bash
node tools/testar-missoes.js                 # todas as missões, com o mesmo PHP do navegador
node tools/testar-missoes.js pagina.html     # só estas páginas (-v mostra as saídas)
node tools/testar-missoes.js --nativo pagina.html   # compara também com o PHP nativo (precisa do laboratório)
node tools/sim.js programa.php               # roda um programa como o editor
node tools/sim.js index.php --web            # idem, no modo web
bash tools/checar-privacidade.sh             # páginas e histórico; lista extra: PROIBIDO=lista.txt
```

Para testar no navegador, sirva a raiz do site e abra `/tools/demo.html`.

## Publicar no GitHub Pages

Envie a pasta para um repositório e ative **Settings → Pages → Deploy from a branch → main / (root)**.

## Adicionar uma aula

Leia `CONTRIBUINDO.md` e inclua a página na lista `NIVEIS` de `assets/site.js`.
