/* Carrega no Node o MESMO PHP 8.5.10 (WebAssembly, build asyncify) e o mesmo
   motor (tools/php-src/motor.mjs) que o navegador usa.
   Precisa de tools/node_modules:  cd tools && npm install  */
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const NM = path.join(__dirname, "node_modules");
const LIMITE_SAIDA = 2 * 1024 * 1024; // igual ao navegador

let cache = null;
async function carregar() {
  if (cache) return cache;
  const exige = (p) => { if (!fs.existsSync(p)) { console.error("Falta " + path.relative(process.cwd(), p) + ". Rode:  cd tools && npm install"); process.exit(3); } return p; };
  const imp = (p) => import(pathToFileURL(exige(p)).href);
  const U = await imp(path.join(NM, "@php-wasm/universal/index.js"));
  const Ut = await imp(path.join(NM, "@php-wasm/util/index.js"));
  const loader = await imp(path.join(NM, "@php-wasm/node-8-5/asyncify/php_8_5.js"));
  const M = await imp(path.join(__dirname, "php-src/motor.mjs"));
  const modulo = await WebAssembly.compile(fs.readFileSync(exige(path.join(NM, "@php-wasm/node-8-5/asyncify/8_5_10/php_8_5.wasm"))));
  const motor = M.criarMotor({ U, Ut, loader, modulo });
  cache = { motor, M };
  return cache;
}

/** Roda como o modo cli do editor. arquivos: [{nome, codigo}] (o 1º roda).
 *  stdin: string (entrada fixa) ou null (sem entrada: o programa recebe fim de arquivo).
 *  Retorna { saida (stdout+stderr na ordem), err, exit, eventos: [{t:"out"|"err"|"eco", s}], leuSemEntrada, estourou } */
async function rodarCli(arquivos, opts) {
  opts = opts || {};
  const { motor, M } = await carregar();
  const eventos = [];
  let saida = "", err = "", total = 0, estourou = false, leuSemEntrada = false;
  const dec = { out: new TextDecoder(), err: new TextDecoder() };
  const temEntrada = opts.stdin !== null && opts.stdin !== undefined;
  const entrada = M.criarEntrada({
    texto: temEntrada ? opts.stdin : "",
    aoEco: (l) => eventos.push({ t: "eco", s: l }),
  });
  const entradaFn = () => {
    const r = entrada.input();
    if (r === null && !temEntrada) leuSemEntrada = true;
    return r;
  };
  const exit = await motor.rodarCli({
    arquivos,
    principal: arquivos[0].nome,
    args: opts.args || [],
    entrada: entradaFn,
    aoSaida(t, b) {
      if (estourou) return;
      total += b.length;
      if (total > LIMITE_SAIDA) { estourou = true; return; }
      const s = dec[t].decode(b, { stream: true });
      saida += s; if (t === "err") err += s;
      const u = eventos[eventos.length - 1];
      if (u && u.t === t) u.s += s; else eventos.push({ t, s });
    },
  });
  return { saida, err, exit, eventos, leuSemEntrada, estourou };
}

/** Modo web: cria o site e faz a primeira requisição (data-url / data-post),
 *  seguindo redirecionamentos como o editor. */
async function rodarWeb(arquivos, opts) {
  opts = opts || {};
  const { motor } = await carregar();
  const site = await motor.novoSite(arquivos);
  const Sim = require("../assets/phpsim.js");
  let url = Sim.urlCompleta(opts.url || "/" + (arquivos[0].nome === "index.php" ? "" : arquivos[0].nome));
  let req = opts.post !== null && opts.post !== undefined
    ? { method: "POST", url, headers: { "content-type": "application/x-www-form-urlencoded" }, body: new TextEncoder().encode(opts.post) }
    : { method: "GET", url, headers: {} };
  const respostas = [];
  for (let i = 0; i <= 10; i++) {
    const r = await site.pedir({ method: req.method, url: Sim.caminhoDe(req.url), headers: req.headers, body: req.body });
    respostas.push({ url: req.url, metodo: req.method, ...r });
    const loc = (r.headers.location || [])[0];
    if (r.status >= 300 && r.status < 400 && loc && i < 10) {
      const prox = Sim.urlCompleta(loc, req.url);
      const met = r.status === 307 || r.status === 308 ? req.method : "GET";
      req = { method: met, url: prox, headers: met === "GET" ? {} : req.headers, body: met === "GET" ? undefined : req.body };
      continue;
    }
    break;
  }
  const fim = respostas[respostas.length - 1];
  const html = new TextDecoder().decode(fim.body);
  return { html, status: fim.status, headers: fim.headers, err: fim.errors || "", exit: fim.exit, url: fim.url, respostas, site };
}

module.exports = { carregar, rodarCli, rodarWeb, LIMITE_SAIDA };
