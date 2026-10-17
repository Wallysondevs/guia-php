# Como escrever uma página do Guia PHP

O guia é uma **escola**, estilo W3Schools, para quem **nunca programou**. **Uma aula = um assunto** (o dono do projeto reclamou de outro guia que juntava vários comandos numa página). Nunca mostre código "seco": explique cada linha (anatomia), mostre a saída real, o que acontece quando dá errado (a mensagem real do PHP) e deixe o leitor praticar no editor do guia, que roda **o PHP de verdade** no navegador.

## 1. Esqueleto do arquivo
Igual ao do Guia Java (`/home/wallyson/guia-java/CONTRIBUINDO.md`, seção 1), com `<title>PHP TEMA — descrição | Guia PHP</title>` e `<h1>PHP <span class="hl">TEMA</span></h1>`. Menu, selo e Anterior/Próximo vêm de `assets/site.js` (`NIVEIS`) — **não mude a `NIVEIS`**; links internos só para páginas dela.

## 2. Ordem de uma aula
Intro → "Você vai aprender" → a ideia antes do código (comparação do dia a dia) → do simples ao completo, uma novidade por vez, com `dl.anatomy` ou tabela "linha → o que faz" → **saída real** depois de cada exemplo → **pelo menos dois "Experimente"** (`.tryphp`) por aula (um no meio, uma missão no fim) → formas diferentes + "qual usar" → **quando dá errado** (`div.cenario`: código, mensagem real do PHP, o que significa, como consertar) → referência (`table.ref`) → exercícios (3+: `.exercise`, `.mc`) → resumo.

## 3. Componentes

### Código PHP para ler
```html
<pre class="file" data-file="ola.php">&lt;?php
echo "Olá, mundo!";
</pre>
```
Dentro de `<pre>`, escape `&lt; &gt; &amp;` — **inclusive o `&lt;?php`**.

### Terminal (`pre.term`)
Igual aos outros guias (`$ ` = `ana@notebook:~$`, `> ` continuação, `«` anotação). Para `php`, `php -S`, `curl`, `composer`, `php -a`.

### Editor "Experimente" (`.tryphp`) — o "Try it Yourself" do guia, com PHP real
```html
<div class="tryphp" data-goal="out:Olá, Ana!">
<p class="try-task"><strong>Missão:</strong> troque "mundo" por "Ana" e clique em Rodar.</p>
<pre class="script">&lt;?php
echo "Olá, mundo!";
</pre>
<pre class="solucao">&lt;?php
echo "Olá, Ana!";
</pre>
</div>
```
- **Rodar** executa o código no **PHP 8.5 real** (compilado para WebAssembly, carregado na primeira vez que o leitor clica em Rodar) e mostra a saída, os avisos e erros do PHP (`Warning: …`, `Fatal error: …`) e o código de saída.
- **`data-modo="web"`**: o código é tratado como uma página web (`index.php` servida pelo PHP): o editor mostra duas abas, **Resultado** (o HTML renderizado, como no navegador — formulários funcionam e enviam GET/POST para o próprio PHP) e **Código-fonte HTML**. Use nas aulas de PHP dentro do HTML, formulários, sessões, cookies, redirecionamento. `data-url="/index.php?nome=Ana"` define a primeira requisição; `data-post="nome=Ana&idade=29"` faz a primeira requisição ser um POST.
- Padrão (`data-modo="cli"`): saída em texto, como `php arquivo.php` no terminal.
- **Vários arquivos** (para `include`, classes em arquivos separados, `.csv`, `.json`): vários `<pre class="script" data-file="…">` na mesma caixa (abas). O primeiro é o que roda.
- `data-stdin="…"` (entrada para `fgets(STDIN)`), `data-args="…"` (`$argv`). **`readline()` não existe no PHP do navegador** — nas caixas use sempre `fgets(STDIN)`; `readline()` só em `pre.term` (laboratório: `php-completo`).
- Sem `data-goal`: caixa livre. Com `data-goal`: missão, `pre.solucao` **obrigatório** (com várias abas, um `pre.solucao data-file="…"` por arquivo que muda).

### Metas (`data-goal`, separadas por vírgula; `\,` = vírgula literal)
| Meta | Verdade quando… |
| --- | --- |
| `out:TEXTO` / `outre:REGEX` | a saída (texto; no modo web, o HTML gerado) contém / casa |
| `html:TEXTO` | (modo web) o **texto visível** da página renderizada contém |
| `erro:TEXTO` | a saída tem uma mensagem de erro/aviso do PHP contendo o texto (para missões "provoque o erro") |
| `semerro` | nenhum `Warning`/`Notice`/`Deprecated`/`Fatal` |
| `exit:N` | código de saída N |
| `src:REGEX` | o código do leitor casa com a regex (para exigir um recurso) |

### Outros blocos
`dl.anatomy`, `div.note/.tip/.warning/.cenario`, `ol.passo`, `div.table-wrap > table.ref`, `.exercise`, `.mc`, `figure`.
No `.exercise`, `data-answer="a|b"` aceita respostas alternativas; para uma barra vertical **dentro** da resposta (union types `int|string`, o pipe `|>`), escreva `\|`: `data-answer="int\|string|string\|int"`.

## 4. O "simulador": PHP real no navegador (`assets/phpsim.js`)
Não é uma imitação: é o **PHP 8.5.10 oficial compilado para WebAssembly** (`@php-wasm/web-8-5` 3.1.58, licença GPL, o motor do WordPress Playground), hospedado em `assets/php/` e rodando num Web Worker. O leitor só baixa o PHP no **primeiro clique em Rodar** (barra "Carregando o PHP (≈ 7,9 MB, só na primeira vez)…"; depois fica no cache). Cada Rodar começa **limpo**: PHP novo, arquivos da caixa recriados.

**Testar suas missões:** `node tools/testar-missoes.js suas-paginas.html` (sem nomes = todas). Ele usa o **mesmo PHP 8.5.10 em WebAssembly**, no Node, e confere: o código inicial **não** cumpre a meta, a solução **cumpre**, o `&lt;?php` está escapado, as metas existem, a regex é válida. `--nativo` roda também no PHP 8.5.8 do laboratório e mostra as diferenças; `-v` mostra as saídas. Para um `.php` solto: `node tools/sim.js arq.php [args] [--stdin "Ana\n29"] [--com outro.php] [--web --url "/?x=1" --post "a=1"] [--nativo]`. Se faltar `tools/node_modules`: `cd tools && npm install`.

### Modo cli (padrão)
- Mostra `ana@notebook:~$ php programa.php args`, a saída, os avisos/erros do PHP em vermelho e `[código de saída: N]`. Arquivo padrão: `programa.php` (ou `data-file` na `div`); roda em `/home/ana` (`getcwd()`), com as abas como arquivos ao lado (`require 'funcoes.php'`, `fopen('dados.csv')`).
- Erros como no laboratório (sem php.ini): `display_errors=1` na saída (`\nWarning: … in /home/ana/programa.php on line N`), **sem** a cópia `PHP Warning:` no stderr, avisos repetidos **não** são escondidos, `memory_limit=128M`.
- **Entrada (`STDIN`)**: o programa **para e espera** o leitor digitar no terminal (Enter envia, Ctrl+D = fim da entrada, Ctrl+C = parar). Com `data-stdin="Ana\n29"` (`\n` = Enter; um Enter final é acrescentado) a entrada já vem pronta, num campo "Entrada" editável, e cada linha aparece **em negrito no ponto em que o programa a leu**, como se a Ana digitasse. Use `data-stdin` em toda missão que lê `STDIN` (o testador não digita: sem ele o programa recebe fim de arquivo). **`readline()` não existe** (nem no `php` do laboratório): use `trim(fgets(STDIN))`.
- `data-args` preenche o campo "Argumentos" (`$argv`, separados como no bash, aspas valem).
- **Limites**: o editor para o programa depois de **30 s** rodando (sem contar a espera por entrada) ou de **2 MB** de saída; `set_time_limit`/`max_execution_time` **não** interrompem nada no WebAssembly. `sleep()`/`usleep()` funcionam (esperam de verdade). Recursão infinita dá o `Fatal error: Allowed memory size of 134217728 bytes exhausted` (com um stack trace enorme — o terminal mostra o começo e o fim).

### Modo web (`data-modo="web"`)
- O primeiro `pre.script` vira `/home/ana/site/index.php` (ou o nome em `data-file`) de um "`php -S localhost:8000`" em memória (`PHP_SAPI` = `cli-server`); as outras abas ficam ao lado (`login.php`, `comum.php`…). A primeira requisição é `GET /` (ou `data-url="/x.php?a=1"`; com `data-post="a=1&amp;b=2"` vira POST urlencoded para essa URL).
- **Resultado** (iframe isolado) + **Código-fonte HTML** (com os cabeçalhos da resposta), barra de endereço editável (Enter faz GET), ← voltar, ⟳ recarregar. **Links e formulários funcionam**: GET, POST (urlencoded e `multipart/form-data` com upload → `$_FILES`), `header('Location: …')` é seguido como no navegador (o código 3xx aparece nos cabeçalhos), página 404 igual à do `php -S`. **Cookies e sessões persistem** entre as requisições da mesma caixa até o próximo Rodar.
- Erros no formato HTML do PHP (`<br />\n<b>Warning</b>:  …`).
- **Não funciona dentro do Resultado**: arquivos estáticos de outras abas (`<link href="estilo.css">`, `<img src="foto.png">`) — use `<style>` na própria página; `fetch()`/AJAX do JavaScript da página para o PHP; links para fora de `localhost:8000` (o editor avisa).
- As metas são conferidas **a cada página** que o leitor abre na caixa (uma missão pode pedir "entre e clique em…"). O testador só faz a **primeira** requisição (`data-url`/`data-post`): prefira missões que se cumpram nela, ou aceite o ✗ do testador e confira no navegador.

### Metas: detalhes
- `out:`/`outre:` no cli = tudo o que o terminal mostra (stdout + stderr, **sem** o eco da entrada digitada); no web = o HTML gerado (da página atual). `html:` = texto visível (sem tags, `<script>`, `<style>`, `<title>`; espaços e quebras de linha contam como um espaço só).
- `outre:` e `src:` usam a flag `m`: **`^` e `$` valem por linha**. Para "a saída **termina com** X" use `X\n?(?![\s\S])`; para "começa com", `^(?<![\s\S])X`. Sem flag `s`: `.` não pula linha (use `[\s\S]`).
- `erro:` procura em cada mensagem do PHP (a linha `Warning:/Fatal error:/Parse error:/Deprecated:/Notice:` + o `Stack trace` que vem junto); `semerro` = nenhuma dessas.

### O que roda e o que não roda
- **Extensões** (`get_loaded_extensions()` no navegador): Core, date, lexbor, uri, pcre, json, SPL, standard, random, Reflection, mbstring, iconv, ctype, filter, hash, session, tokenizer, calendar, bcmath, fileinfo, exif, gd, zlib, zip, Phar, openssl, curl (sem rede), dom, libxml, SimpleXML, xml, xmlreader, xmlwriter, soap, **PDO + pdo_sqlite, sqlite3**, OPcache. **Não tem**: intl (`NumberFormatter`, `IntlDateFormatter` — o laboratório também não), mysqli/pdo_mysql/mysqlnd, pdo_pgsql/pgsql, gmp, bz2, ftp, sockets, posix, pcntl, redis, readline.
- **Sem rede**: `allow_url_fopen=0` (`file_get_contents("https://…")` dá os dois `Warning` reais do PHP e devolve `false`), `curl_exec`, `curl_multi_exec`, `fsockopen`, `stream_socket_client/server` estão **desligadas** (`Call to undefined function curl_exec()`); `curl_init`/`curl_setopt` existem. MySQL: `new PDO('mysql:…')` → `could not find driver`. Nas aulas de rede, MySQL, Composer e `php -S` use saídas reais do laboratório em `pre.term`.
- **Sem sistema operacional**: `exec()`, `shell_exec()`, `system()`, `passthru()`, `proc_open()` não rodam comando nenhum (devolvem vazio/`false`, código 1); `mail()` → `Warning: mail(): Sendmail killed by signal 127`.
- **A "máquina"**: `getenv()` mostra a Ana (`HOME=/home/ana`, `USER=ana`, `LANG=pt_BR.UTF-8`), fuso **UTC** (como o laboratório), `PHP_OS` = `Linux`, mas `php_uname()` = `Emscripten emscripten 4.0.19 #1 wasm32` e `gethostname()` = `emscripten` — não mostre esses dois no editor. `PHP_VERSION` = `8.5.10` (laboratório: `8.5.8`). O sistema de arquivos é só da caixa (`/home/ana`, `/tmp`), em memória, e some no próximo Rodar.
- **Desempenho**: o PHP leva ~0,5–1 s para carregar do cache e ~0,1–0,2 s por Rodar; o WebAssembly é umas 2–3× mais lento que o nativo (`password_hash` ≈ 0,4 s). Use números pequenos.
- Só **um programa por vez** na página: rodar outra caixa interrompe o programa que estava esperando entrada.
- Navegadores: precisa de `DecompressionStream` (Chrome/Edge 80+, Firefox 113+, Safari 16.4+).

## 5. Fidelidade: o laboratório (`~/guia-php-lab/lab`)
A máquina da Ana do Guia Bash (usuária `ana`, `notebook`, `/home/ana`, pt_BR) com **PHP 8.5.8** (static-php-cli, perfil "common" — o PHP do navegador é o 8.5.10; diferenças de correção entre eles quase nunca mudam saídas) e **Composer 2.10.3**, em `/opt/php/bin` (no `PATH`).
```bash
L=~/guia-php-lab/lab
printf '%s\n' 'mkdir -p site && cd site' "cat > ola.php <<'FIM'" '<?php' 'echo "Olá, mundo!\n";' 'FIM' 'php ola.php' | $L -n SEUNOME -i
$L -n SEUNOME -- bash -c 'cd site && (php -S localhost:8000 >/tmp/srv.log 2>&1 &) && sleep 1 && curl -s localhost:8000/ola.php; pkill -f "php -S"'
```
- `-n SEUNOME` (pasta própria), `-r` (recomeça), `-t` (terminal de verdade).
- **Dois binários do mesmo PHP 8.5.8:** `php` (perfil "common": tem `pdo_sqlite`, **sem readline**) e `php-completo` (perfil "bulk": **com readline e intl** — `Collator`, `NumberFormatter`, `IntlDateFormatter` — e mais extensões, sem `pdo_sqlite`; o PHP do navegador **não** tem intl, então intl só em `pre.term`). Para sessões do modo interativo `php -a` e para `readline()`, rode `php-completo` com `-t` e mostre o comando como `php -a` (no PHP instalado pelo apt/dnf/pacman, o `php` normal tem readline). Não confunda: o `php` do laboratório dá `Interactive shell (-a) requires the readline extension.`, o que **não** acontece numa instalação comum.
- Fatos já conferidos: **`printf("%.2f")` ignora o idioma** (sai `3.14`, com ponto — diferente do Java); `number_format(1234.5, 2, ",", ".")` → `1.234,50`; `echo 10/3` → `3.3333333333333`; `var_dump(0.1+0.2 == 0.3)` → `bool(false)`.
- No CLI os erros saem como `PHP Warning:  …` no stderr **e** `Warning: …` no stdout, conforme `display_errors`/`log_errors` — confira e explique o que o leitor vê no terminal × no navegador.
- Um processo por vez, `timeout 60`; **sempre** encerre o `php -S` que você abrir. **Use `-N` em toda sessão com `php -S`** (`$L -n SEUNOME -N -- bash -c …`): a caixa ganha um `localhost` só dela, e vários autores podem usar a porta 8000 ao mesmo tempo sem um pegar o servidor do outro (com `-N` não há internet — para Composer, rode sem `-N`).
- **Privacidade:** nada da máquina real (redes, IPs, usuário real). Só a máquina fictícia da Ana.

### Versões
O guia ensina o **PHP 8.5**. Marque recursos novos com `<span class="versao">PHP 8.4+</span>` etc. e diga a alternativa: `match`, named arguments, nullsafe `?->`, union types, atributos (8.0); enums, readonly, `never`, first-class callables (8.1); readonly classes (8.2); `#[\Override]`, typed class constants (8.3); property hooks, visibilidade assimétrica, `new` sem parênteses, `array_find` (8.4); **operador pipe `|>`**, `clone with`, `#[\NoDiscard]`, `array_first`/`array_last`, extensão `uri` (8.5 — confira cada um no laboratório).

## 6. Escrita
Português do Brasil, frases curtas, "você"; o leitor nunca programou. Nomes em inglês ganham tradução (`echo` = ecoar; `isset` = "está definido?"). Exemplos com a vida da Ana (lista de compras, notas de alunos, uma lojinha, um blog). Toda mensagem de erro é a real. Segurança desde o começo: sempre `htmlspecialchars` na saída e prepared statements no banco, com o porquê.
