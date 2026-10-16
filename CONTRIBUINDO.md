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
- `data-stdin="…"` (entrada para `fgets(STDIN)`/`readline`), `data-args="…"` (`$argv`).
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

## 4. O "simulador": PHP real no navegador (`assets/phpsim.js`) — sendo montado em paralelo
Não é uma imitação: é o **PHP 8.5.10 oficial compilado para WebAssembly** (pacote `@php-wasm/web-8-5`, licença GPL, o mesmo motor do WordPress Playground), hospedado no próprio site e carregado só quando o leitor roda algo. Tem as extensões comuns (mbstring, json, ctype, PDO + **pdo_sqlite**, sqlite3, date, pcre, session, filter…). Funciona: tudo da linguagem, arquivos num sistema de arquivos em memória, SQLite, sessões e cookies entre requisições da mesma caixa (modo web), `$_GET`/`$_POST`/`$_FILES`. **Não funciona** no navegador: rede de verdade (`curl` para fora, `file_get_contents("https://…")`), MySQL/servidores externos, `exec`/`shell_exec` reais, Composer — essas aulas usam saídas reais do laboratório em `pre.term`. (Confira esta seção quando o agente do simulador terminar: ele vai documentar exatamente o que roda.)

Testar suas missões (quando existir): `node tools/testar-missoes.js suas-paginas.html` — roda a solução no mesmo PHP 8.5 (WebAssembly, no Node) e confere as metas.

## 5. Fidelidade: o laboratório (`~/guia-php-lab/lab`)
A máquina da Ana do Guia Bash (usuária `ana`, `notebook`, `/home/ana`, pt_BR) com **PHP 8.5.8** (static-php-cli, perfil "common" — o PHP do navegador é o 8.5.10; diferenças de correção entre eles quase nunca mudam saídas) e **Composer 2.10.3**, em `/opt/php/bin` (no `PATH`).
```bash
L=~/guia-php-lab/lab
printf '%s\n' 'mkdir -p site && cd site' "cat > ola.php <<'FIM'" '<?php' 'echo "Olá, mundo!\n";' 'FIM' 'php ola.php' | $L -n SEUNOME -i
$L -n SEUNOME -- bash -c 'cd site && (php -S localhost:8000 >/tmp/srv.log 2>&1 &) && sleep 1 && curl -s localhost:8000/ola.php; pkill -f "php -S"'
```
- `-n SEUNOME` (pasta própria), `-r` (recomeça), `-t` (terminal de verdade).
- **Dois binários do mesmo PHP 8.5.8:** `php` (perfil "common": tem `pdo_sqlite`, **sem readline**) e `php-completo` (perfil "bulk": **com readline** e mais extensões, sem `pdo_sqlite`). Para sessões do modo interativo `php -a` e para `readline()`, rode `php-completo` com `-t` e mostre o comando como `php -a` (no PHP instalado pelo apt/dnf/pacman, o `php` normal tem readline). Não confunda: o `php` do laboratório dá `Interactive shell (-a) requires the readline extension.`, o que **não** acontece numa instalação comum.
- Fatos já conferidos: **`printf("%.2f")` ignora o idioma** (sai `3.14`, com ponto — diferente do Java); `number_format(1234.5, 2, ",", ".")` → `1.234,50`; `echo 10/3` → `3.3333333333333`; `var_dump(0.1+0.2 == 0.3)` → `bool(false)`.
- No CLI os erros saem como `PHP Warning:  …` no stderr **e** `Warning: …` no stdout, conforme `display_errors`/`log_errors` — confira e explique o que o leitor vê no terminal × no navegador.
- Um processo por vez, `timeout 60`; **sempre** encerre o `php -S` que você abrir.
- **Privacidade:** nada da máquina real (redes, IPs, usuário real). Só a máquina fictícia da Ana.

### Versões
O guia ensina o **PHP 8.5**. Marque recursos novos com `<span class="versao">PHP 8.4+</span>` etc. e diga a alternativa: `match`, named arguments, nullsafe `?->`, union types, atributos (8.0); enums, readonly, `never`, first-class callables (8.1); readonly classes (8.2); `#[\Override]`, typed class constants (8.3); property hooks, visibilidade assimétrica, `new` sem parênteses, `array_find` (8.4); **operador pipe `|>`**, `clone with`, `#[\NoDiscard]`, `array_first`/`array_last`, extensão `uri` (8.5 — confira cada um no laboratório).

## 6. Escrita
Português do Brasil, frases curtas, "você"; o leitor nunca programou. Nomes em inglês ganham tradução (`echo` = ecoar; `isset` = "está definido?"). Exemplos com a vida da Ana (lista de compras, notas de alunos, uma lojinha, um blog). Toda mensagem de erro é a real. Segurança desde o começo: sempre `htmlspecialchars` na saída e prepared statements no banco, com o porquê.
