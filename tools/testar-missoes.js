#!/usr/bin/env node
/* Testa as caixas "Experimente" (.tryphp) das páginas no MESMO PHP 8.5.10
   (WebAssembly) que o navegador usa.

   node tools/testar-missoes.js                 todas as páginas *.html
   node tools/testar-missoes.js arrays.html …   só estas
   opções:
     -v, --verboso   mostra a saída de cada execução
     --nativo        roda também no PHP 8.5.8 nativo do laboratório e mostra diferenças
     --sem-cache     ignora tools/.cache-missoes.json

   Para cada missão (com data-goal):
     1. o código inicial NÃO pode cumprir a meta;
     2. a solução (pre.solucao) TEM de cumprir a meta.
   Caixas livres (sem data-goal): só roda o código e avisa se der Parse/Fatal error.
   Modo web: faz a primeira requisição (data-url / data-post), seguindo redirecionamentos.
   Sai com código 1 se alguma missão falhar. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Sim = require("../assets/phpsim.js");
const P = require("./php-node.js");

const RAIZ = path.resolve(__dirname, "..");
const CACHE = path.join(__dirname, ".cache-missoes.json");
const TEMPO_MAX = 30000;

/* ---------- leitura das páginas (sem navegador) ---------- */
function attrs(tag) {
  const r = {}, re = /([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  tag = tag.replace(/^<\w+/, "").replace(/\/?>$/, "");
  while ((m = re.exec(tag))) r[m[1].toLowerCase()] = Sim.decodificarEntidades(m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] !== undefined ? m[5] : "");
  return r;
}
function temClasse(a, c) { return (" " + (a["class"] || "") + " ").indexOf(" " + c + " ") >= 0; }
// devolve [{inicio, fim, abre, interno}] de cada <div class="tryphp">…</div> (com divs aninhadas)
function caixas(html) {
  const r = [], re = /<div\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const a = attrs(m[0]);
    if (!temClasse(a, "tryphp")) continue;
    let prof = 1, i = re.lastIndex;
    const t = /<\/?div\b[^>]*>/gi; t.lastIndex = i;
    let x;
    while ((x = t.exec(html))) { if (x[0][1] === "/") { if (--prof === 0) break; } else prof++; }
    const fim = x ? x.index : html.length;
    r.push({ linha: html.slice(0, m.index).split("\n").length, a, interno: html.slice(re.lastIndex, fim) });
    re.lastIndex = fim;
  }
  return r;
}
function pres(interno, classe) {
  const r = [], re = /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi;
  let m;
  while ((m = re.exec(interno))) {
    const a = attrs(/^<pre\b[^>]*>/i.exec(m[0])[0]);
    if (!temClasse(a, classe)) continue;
    r.push({ arquivo: a["data-file"] || null, bruto: m[1], codigo: Sim.decodificarEntidades(m[1]).replace(/^\n/, "") });
  }
  return r;
}

/* ---------- execução com limite de tempo ---------- */
function comLimite(p, rotulo) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error("passou de " + TEMPO_MAX / 1000 + " s (laço infinito?) em " + rotulo)), TEMPO_MAX); })])
    .finally(() => clearTimeout(t));
}
async function executar(cx, arquivos) {
  if (cx.web) {
    const r = await P.rodarWeb(arquivos, { url: cx.url, post: cx.post });
    return { modo: "web", out: r.html, err: r.err, exit: r.exit, status: r.status, url: r.url, texto: Sim.textoDeHtml(r.html) };
  }
  const r = await P.rodarCli(arquivos, { args: cx.args, stdin: cx.stdin });
  return { modo: "cli", out: r.saida, err: r.err, exit: r.exit, eventos: r.eventos, leuSemEntrada: r.leuSemEntrada, estourou: r.estourou };
}

function trecho(s, n) { s = String(s || ""); const l = s.split("\n"); return (l.length > n ? l.slice(0, n).concat(["… (" + (l.length - n) + " linhas a mais)"]) : l).map((x) => "        │ " + x).join("\n"); }

async function main() {
  const argv = process.argv.slice(2);
  const verboso = argv.includes("-v") || argv.includes("--verboso");
  const nativo = argv.includes("--nativo");
  const semCache = argv.includes("--sem-cache") || nativo || verboso;
  let paginas = argv.filter((x) => !x.startsWith("-"));
  if (!paginas.length) paginas = fs.readdirSync(RAIZ).filter((f) => f.endsWith(".html")).sort();
  const Lab = nativo ? require("./lab-nativo.js") : null;

  const versaoMotor = crypto.createHash("sha1").update(["../assets/phpsim.js", "php-src/motor.mjs", "php-node.js", "testar-missoes.js"].map((f) => fs.readFileSync(path.join(__dirname, f), "utf8")).join("\0") + require("./package.json").dependencies["@php-wasm/node-8-5"]).digest("hex");
  let cache = {};
  try { const c = JSON.parse(fs.readFileSync(CACHE, "utf8")); if (c.versao === versaoMotor) cache = c.itens || {}; } catch (e) { /* sem cache */ }
  const novoCache = {};

  let nMissoes = 0, nLivres = 0, nFalhas = 0, nAvisos = 0, nCache = 0;
  for (const pag of paginas) {
    const arq = path.isAbsolute(pag) ? pag : fs.existsSync(pag) ? pag : path.join(RAIZ, pag);
    if (!fs.existsSync(arq)) { console.log("✗ " + pag + ": arquivo não encontrado"); nFalhas++; continue; }
    const html = fs.readFileSync(arq, "utf8");
    const lista = caixas(html);
    if (!lista.length) continue;
    const saidaPag = [];
    let falhasPag = 0;
    for (const c of lista) {
      const a = c.a;
      const web = (a["data-modo"] || "cli").toLowerCase() === "web";
      const padrao = a["data-file"] || (web ? "index.php" : "programa.php");
      const scripts = pres(c.interno, "script"), sols = pres(c.interno, "solucao");
      const meta = a["data-goal"] || "";
      const rot = "linha " + c.linha + (meta ? " missão [" + meta + "]" : " (livre)") + (web ? " web" : "");
      const problemas = [], avisos = [];
      // conferências do contrato
      for (const p of scripts.concat(sols)) if (/<\?/.test(p.bruto)) problemas.push("há \"<?\" sem escapar dentro do <pre> (escreva &lt;?php)");
      if (!scripts.length) problemas.push("caixa sem <pre class=\"script\">");
      if (meta && !sols.length) problemas.push("missão sem <pre class=\"solucao\">");
      const metas = Sim.dividirMetas(meta);
      metas.forEach((g) => { if (!/^(out|outre|html|erro|semerro|exit|src)(:|$)/.test(g)) problemas.push("meta desconhecida: \"" + g + "\""); });
      metas.forEach((g) => { if (/^(outre|src):/.test(g)) { try { new RegExp(g.slice(g.indexOf(":") + 1), "m"); } catch (e) { problemas.push("regex inválida em \"" + g + "\": " + e.message); } } });
      if (!web && metas.some((g) => /^html:/.test(g))) problemas.push("meta html: só vale no modo web (data-modo=\"web\")");
      if (problemas.length) {
        nFalhas++; falhasPag++;
        saidaPag.push("  ✗ " + rot + "\n" + problemas.map((p) => "      " + p).join("\n"));
        continue;
      }
      const abas = scripts.map((p, i) => ({ nome: p.arquivo || (i === 0 ? padrao : "arquivo" + i + ".php"), codigo: p.codigo }));
      const solucao = abas.map((x) => ({ nome: x.nome, codigo: x.codigo }));
      sols.forEach((s, i) => {
        const nome = s.arquivo || (abas[i] ? abas[i].nome : padrao);
        const alvo = solucao.find((x) => x.nome === nome);
        if (alvo) alvo.codigo = s.codigo; else solucao.push({ nome, codigo: s.codigo });
      });
      const cx = {
        web,
        url: a["data-url"] || null,
        post: a["data-post"] !== undefined ? a["data-post"] : null,
        stdin: a["data-stdin"] !== undefined ? Sim.textoEntrada(a["data-stdin"]) : null,
        args: Sim.dividirArgs(a["data-args"] || ""),
      };
      const chave = crypto.createHash("sha1").update(JSON.stringify([cx, meta, abas, solucao])).digest("hex");
      if (!semCache && cache[chave]) {
        novoCache[chave] = cache[chave]; nCache++;
        if (meta) nMissoes++; else nLivres++;
        if (cache[chave].aviso) { nAvisos++; saidaPag.push("  ! " + rot + "\n      " + cache[chave].aviso); }
        continue;
      }
      const src = (arqs) => arqs.map((x) => x.codigo).join("\n");
      const ctx = (r, arqs) => ({ modo: r.modo, out: r.out, err: r.err, exit: r.exit, html: r.texto, src: src(arqs) });
      let linha = "";
      try {
        if (meta) {
          nMissoes++;
          const ini = await comLimite(executar(cx, abas), rot + " (código inicial)");
          const fIni = Sim.checarMeta(meta, ctx(ini, abas));
          const sol = await comLimite(executar(cx, solucao), rot + " (solução)");
          const fSol = Sim.checarMeta(meta, ctx(sol, solucao));
          const erros = [];
          if (!fIni.length) erros.push("o código inicial JÁ cumpre a meta (a missão começa resolvida)");
          if (fSol.length) erros.push("a solução NÃO cumpre: " + fSol.join(" | ") + (web ? "\n      (o testador só faz a primeira requisição — data-url/data-post; uma missão de vários cliques não dá para conferir aqui)" : ""));
          if (sol.leuSemEntrada) avisos.push("a solução lê STDIN mas a caixa não tem data-stdin (no navegador o leitor digita; aqui recebeu fim de arquivo)");
          if (sol.estourou) avisos.push("a solução escreve mais de 2 MB (o editor interrompe)");
          if (erros.length) {
            nFalhas++; falhasPag++;
            linha = "  ✗ " + rot + "\n" + erros.map((e) => "      " + e).join("\n") + "\n      saída da solução" + (web ? " (HTTP " + sol.status + ", texto visível)" : " [exit " + sol.exit + "]") + ":\n" + trecho(web ? sol.texto : sol.out, 15);
            if (!fIni.length) linha += "\n      saída do código inicial:\n" + trecho(web ? ini.texto : ini.out, 8);
          } else {
            linha = verboso ? "  ✓ " + rot + "\n" + trecho(web ? sol.texto : sol.out, 30) : "";
            novoCache[chave] = { ok: true, aviso: avisos.join("; ") || undefined };
          }
          if (nativo) linha += comparar(Lab, cx, solucao, sol);
        } else {
          nLivres++;
          const r = await comLimite(executar(cx, abas), rot);
          const erros = Sim.errosNoTexto(r.out, web).concat(Sim.errosNoTexto(r.err, false)).filter((e) => /^(PHP )?(Parse error|Fatal error)/.test(e));
          if (erros.length) avisos.push("dá " + erros[0].split("\n")[0].slice(0, 160) + " (se for de propósito, ignore)");
          if (r.leuSemEntrada) avisos.push("lê STDIN sem data-stdin: no navegador o leitor digita a entrada");
          linha = verboso ? "  · " + rot + "\n" + trecho(web ? r.texto : r.out, 30) : "";
          novoCache[chave] = { ok: true, aviso: avisos.join("; ") || undefined };
          if (nativo) linha += comparar(Lab, cx, abas, r);
        }
      } catch (e) {
        nFalhas++; falhasPag++;
        linha = "  ✗ " + rot + "\n      erro ao rodar: " + ((e && e.message) || e);
      }
      if (avisos.length) { nAvisos++; linha = (linha || "") + (linha ? "\n" : "") + "  ! " + rot + "\n" + avisos.map((x) => "      " + x).join("\n"); }
      if (linha) saidaPag.push(linha);
    }
    console.log((falhasPag ? "✗ " : "✓ ") + path.basename(arq) + " — " + lista.length + " caixa" + (lista.length > 1 ? "s" : ""));
    saidaPag.forEach((l) => console.log(l));
  }
  try { fs.writeFileSync(CACHE, JSON.stringify({ versao: versaoMotor, itens: Object.assign({}, nativo || verboso ? cache : {}, novoCache) })); } catch (e) { /* ok */ }
  console.log("\n" + nMissoes + " missões, " + nLivres + " caixas livres" + (nCache ? " (" + nCache + " do cache)" : "") + " — " + (nFalhas ? nFalhas + " com problema" : "tudo certo") + (nAvisos ? ", " + nAvisos + " aviso(s)" : "") + ". PHP 8.5.10 (WebAssembly).");
  process.exit(nFalhas ? 1 : 0);
}

function comparar(Lab, cx, arquivos, r) {
  try {
    if (cx.web) {
      const n = Lab.rodarWeb(arquivos, { url: cx.url, post: cx.post });
      const d = Lab.diferencas(r.out, n.html);
      return "\n      nativo " + n.versao + " (HTTP " + n.status + "): " + (d.length ? d.length + " linha(s) diferente(s)\n" + d.slice(0, 12).map((l) => "        " + l).join("\n") : "igual");
    }
    const n = Lab.rodarCli(arquivos, { args: cx.args, stdin: cx.stdin });
    const d = Lab.diferencas(r.out, n.saida);
    return "\n      nativo " + n.versao + " [exit " + n.exit + (n.exit !== r.exit ? " ≠ " + r.exit : "") + "]: " + (d.length ? d.length + " linha(s) diferente(s)\n" + d.slice(0, 12).map((l) => "        " + l).join("\n") : "igual");
  } catch (e) { return "\n      nativo: não consegui rodar (" + e.message + ")"; }
}

main().catch((e) => { console.error(e); process.exit(2); });
