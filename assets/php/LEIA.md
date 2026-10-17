# assets/php — o PHP 8.5 do "Experimente"

Estes arquivos fazem o editor das aulas (`assets/phpsim.js`) rodar o **PHP 8.5.10 oficial,
compilado para WebAssembly**, dentro do navegador do leitor. Nada roda num servidor.

| Arquivo | O que é | Tamanho |
| --- | --- | --- |
| `php_8_5.wasm.gz` | o PHP 8.5.10 (build *asyncify*, que funciona em todos os navegadores modernos), comprimido com gzip -9 | 7,9 MB (21 MB descomprimido) |
| `php-worker.js` | Web Worker: `@php-wasm/universal` + carregador do PHP + o motor do guia (`tools/php-src/`), minificado | 283 KB (~85 KB com gzip) |
| `LICENSE` | GPL-2.0-or-later, a licença do php-wasm | |

## Origem

- [`@php-wasm/web-8-5`](https://www.npmjs.com/package/@php-wasm/web-8-5) **3.1.58** (PHP 8.5.10) e
  [`@php-wasm/universal`](https://www.npmjs.com/package/@php-wasm/universal) **3.1.58** (com `@php-wasm/util`,
  `@php-wasm/logger`, `@php-wasm/progress`, `@php-wasm/stream-compression` e `ini`), do projeto
  [WordPress Playground](https://github.com/WordPress/wordpress-playground) — licença **GPL-2.0-or-later** (ver `LICENSE`).
- Gerado por `tools/construir-php.mjs` (`cd tools && npm install && node construir-php.mjs`); as versões
  exatas estão em `tools/package.json`. O código-fonte do motor do guia está em `tools/php-src/`.
- **Uma única mudança** no código do php-wasm (feita na hora de juntar, pelo `construir-php.mjs`): no
  carregador do PHP, a leitura que "ainda não tem dados" desistia depois de 5 s; agora o tempo vem de
  `Module.fdReadTimeoutMs`. É o que deixa o programa esperar o leitor digitar a entrada (`fgets(STDIN)`).

## Download e cache

- Só é baixado quando o leitor clica em **Rodar** pela primeira vez; depois fica no cache do navegador.
- O arquivo já vai comprimido (`.gz`) e é descomprimido no navegador (`DecompressionStream`), então o
  tamanho transferido é **≈ 7,9 MB** em qualquer hospedagem — o GitHub Pages não precisa (nem vai)
  comprimi-lo de novo. O `php-worker.js` o Pages comprime (≈ 85 KB transferidos).
- Todos os arquivos ficam bem abaixo do limite de 100 MB por arquivo do GitHub.
