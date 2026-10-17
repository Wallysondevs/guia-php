#!/usr/bin/env node
/* Roda um .php como o "Experimente" do guia rodaria (mesmo PHP 8.5.10 em WebAssembly).

   node tools/sim.js programa.php [argumentos…]
   node tools/sim.js programa.php --stdin "Ana\n29" -- arg1 arg2
   node tools/sim.js programa.php --com funcoes.php --com dados.csv
   node tools/sim.js index.php --web [--url "/index.php?nome=Ana"] [--post "nome=Ana&idade=29"] [--cabecalhos]

   --stdin TEXTO   entrada do programa (como data-stdin; \n = Enter). Sem --stdin o
                   programa recebe "fim de arquivo" se ler STDIN (no navegador ele
                   esperaria o leitor digitar).
   --com ARQ       outro arquivo da caixa (aba), copiado ao lado do principal.
   --web           modo web (data-modo="web"): mostra o HTML gerado.
   --texto         (web) mostra também o texto visível (o que a meta html: vê).
   --nativo        roda também no PHP 8.5.8 nativo do laboratório e compara.
*/
"use strict";
const fs = require("fs");
const path = require("path");
const P = require("./php-node.js");
const Sim = require("../assets/phpsim.js");
const Lab = require("./lab-nativo.js");

function uso() { console.error(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^[\s\S]*?\n\n/, "")); process.exit(2); }

async function main() {
  const a = process.argv.slice(2);
  if (!a.length || a[0] === "-h" || a[0] === "--help") uso();
  let principal = null, stdin = null, web = false, url = null, post = null, cab = false, texto = false, nativo = false;
  const com = [], args = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === "--") { args.push(...a.slice(i + 1)); break; }
    else if (x === "--stdin") stdin = Sim.textoEntrada(a[++i] || "");
    else if (x === "--com") com.push(a[++i]);
    else if (x === "--web") web = true;
    else if (x === "--url") url = a[++i];
    else if (x === "--post") post = a[++i];
    else if (x === "--cabecalhos") cab = true;
    else if (x === "--texto") texto = true;
    else if (x === "--nativo") nativo = true;
    else if (!principal) principal = x;
    else args.push(x);
  }
  if (!principal) uso();
  const arquivos = [principal].concat(com).map((f) => ({ nome: path.basename(f), codigo: fs.readFileSync(f, "utf8") }));

  if (web) {
    const r = await P.rodarWeb(arquivos, { url, post });
    for (const x of r.respostas.slice(0, -1)) console.log("(" + x.metodo + " " + x.url.replace(/^https?:\/\//, "") + " → " + x.status + " " + ((x.headers.location || [])[0] || "") + ")");
    console.log("== " + (post !== null && r.respostas.length === 1 ? "POST " : "GET ") + r.url.replace(/^https?:\/\//, "") + " → HTTP " + r.status);
    if (cab) { for (const k of Object.keys(r.headers)) for (const v of r.headers[k]) console.log(k + ": " + v); console.log(""); }
    process.stdout.write(r.html + (r.html.endsWith("\n") ? "" : "\n"));
    if (r.err) console.log("== stderr:\n" + r.err);
    if (texto) console.log("== texto visível:\n" + Sim.textoDeHtml(r.html));
    if (nativo) {
      const n = Lab.rodarWeb(arquivos, { url, post });
      console.log("\n== PHP " + n.versao + " nativo (laboratório): HTTP " + n.status);
      Lab.mostrarDiferencas(r.html, n.html);
    }
    return;
  }

  const r = await P.rodarCli(arquivos, { args, stdin });
  console.log("$ php " + arquivos[0].nome + (args.length ? " " + args.map((x) => (/[\s'"$]/.test(x) ? "'" + x.replace(/'/g, "'\\''") + "'" : x)).join(" ") : ""));
  const cor = process.stdout.isTTY;
  for (const e of r.eventos) {
    if (e.t === "eco") process.stdout.write(cor ? "\x1b[1m" + e.s + "\x1b[0m" : e.s);
    else if (e.t === "err") process.stdout.write(cor ? "\x1b[31m" + e.s + "\x1b[0m" : e.s);
    else process.stdout.write(e.s);
  }
  if (r.saida && !r.saida.endsWith("\n")) process.stdout.write("\n");
  if (r.estourou) console.log("(o programa escreveu mais de 2 MB; o editor o interromperia)");
  if (r.leuSemEntrada) console.log("(o programa leu STDIN sem --stdin: recebeu fim de arquivo; no navegador ele esperaria o leitor digitar)");
  console.log("[código de saída: " + r.exit + "]");
  if (nativo) {
    const n = Lab.rodarCli(arquivos, { args, stdin });
    console.log("\n== PHP " + n.versao + " nativo (laboratório): [código de saída: " + n.exit + "]");
    Lab.mostrarDiferencas(r.saida, n.saida);
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
