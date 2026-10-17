/* =====================================================================
   Web Worker do "Experimente" do Guia PHP (fonte).
   tools/construir-php.mjs junta este arquivo + @php-wasm/universal +
   o carregador do PHP 8.5 (asyncify) em assets/php/php-worker.js.
   O PHP roda aqui, fora da página: um laço infinito não trava a aba e o
   botão "Parar" simplesmente encerra o worker.

   Mensagens  página → worker: {op: "carregar"|"cli"|"entrada"|"eof"|"site"|"pedir", ...}
              worker → página: {ev: "progresso"|"pronto"|"saida"|"eco"|"espera"|"fim"|"falha"|"limite"|"site-ok"|"resp", ...}
   ===================================================================== */
import * as U from "@php-wasm/universal";
import * as Ut from "@php-wasm/util";
import * as loader from "php85-asyncify"; // = @php-wasm/web-8-5/asyncify/php_8_5.js (apelido no construir-php.mjs)
import { criarMotor, criarEntrada } from "./motor.mjs";

/* global __TAMANHO_GZ__ */
const URL_WASM = new URL("php_8_5.wasm.gz", self.location.href).href;
const TAMANHO_GZ = __TAMANHO_GZ__;
const LIMITE_SAIDA = 2 * 1024 * 1024; // 2 MB de saída: depois disso a página para o programa
const MAX_SITES = 4;

let motor = null;
let carregando = null;

async function compilar() {
  if (typeof DecompressionStream === "undefined") throw new Error("Este navegador é antigo demais (falta DecompressionStream). Atualize-o para rodar o PHP.");
  const resp = await fetch(URL_WASM);
  if (!resp.ok) throw new Error("Não consegui baixar o PHP (" + resp.status + " " + URL_WASM + ")");
  let lidos = 0, ultimo = 0;
  const total = +resp.headers.get("content-length") || TAMANHO_GZ;
  const contador = new TransformStream({
    transform(chunk, ctl) {
      lidos += chunk.byteLength;
      const agora = Date.now();
      if (agora - ultimo > 100) { ultimo = agora; postMessage({ ev: "progresso", lidos, total }); }
      ctl.enqueue(chunk);
    },
  });
  const wasm = resp.body.pipeThrough(contador).pipeThrough(new DecompressionStream("gzip"));
  let modulo;
  if (WebAssembly.compileStreaming) {
    modulo = await WebAssembly.compileStreaming(new Response(wasm, { headers: { "content-type": "application/wasm" } }));
  } else {
    modulo = await WebAssembly.compile(await new Response(wasm).arrayBuffer());
  }
  postMessage({ ev: "progresso", lidos: total, total });
  return modulo;
}

function garantir(moduloPronto) {
  if (!carregando) {
    carregando = (async () => {
      const modulo = moduloPronto || (await compilar());
      motor = criarMotor({ U, Ut, loader, modulo });
      postMessage({ ev: "pronto", modulo: moduloPronto ? null : modulo });
    })();
    carregando.catch((e) => { carregando = null; postMessage({ ev: "falha", msg: String((e && e.message) || e) }); });
  }
  return carregando;
}

/* ---------- saída em lotes (na ordem em que o PHP escreveu) ---------- */
let pendente = [], pendenteBytes = 0, totalBytes = 0, idAtual = null, agendado = false, estourou = false;
function despejar() {
  agendado = false;
  if (!pendente.length) return;
  const partes = [];
  for (const p of pendente) {
    const u = partes[partes.length - 1];
    if (u && u.t === p.t) u.l.push(p.b); else partes.push({ t: p.t, l: [p.b] });
  }
  const msg = partes.map((p) => {
    let n = 0; for (const b of p.l) n += b.length;
    const b = new Uint8Array(n); let o = 0; for (const x of p.l) { b.set(x, o); o += x.length; }
    return { t: p.t, b };
  });
  pendente = []; pendenteBytes = 0;
  postMessage({ ev: "saida", id: idAtual, partes: msg }, msg.map((p) => p.b.buffer));
}
function aoSaida(t, b) {
  if (estourou) return;
  totalBytes += b.length;
  if (totalBytes > LIMITE_SAIDA) { estourou = true; despejar(); postMessage({ ev: "limite", id: idAtual }); return; }
  pendente.push({ t, b }); pendenteBytes += b.length;
  if (pendenteBytes > 32768) despejar();
  else if (!agendado) { agendado = true; setTimeout(despejar, 0); }
}

/* ---------- modo web: um site por caixa ---------- */
const sites = new Map();

let entrada = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.op === "carregar") { await garantir(m.modulo); return; }
    if (m.op === "entrada") { if (entrada) entrada.adicionar(m.texto); return; }
    if (m.op === "eof") { if (entrada) entrada.fim(); return; }
    await garantir();
    if (m.op === "cli") {
      idAtual = m.id; totalBytes = 0; estourou = false; pendente = []; pendenteBytes = 0;
      entrada = criarEntrada({
        texto: m.stdin,
        aoEco: (linha) => { despejar(); postMessage({ ev: "eco", id: m.id, texto: linha }); },
        aoEspera: () => { despejar(); postMessage({ ev: "espera", id: m.id }); },
      });
      let exit;
      try {
        exit = await motor.rodarCli({ arquivos: m.arquivos, principal: m.principal, args: m.args, entrada: entrada.input, aoSaida });
      } finally { despejar(); entrada = null; }
      postMessage({ ev: "fim", id: m.id, exit });
    } else if (m.op === "site") {
      sites.delete(m.caixa);
      sites.set(m.caixa, await motor.novoSite(m.arquivos));
      while (sites.size > MAX_SITES) sites.delete(sites.keys().next().value);
      postMessage({ ev: "site-ok", id: m.id });
    } else if (m.op === "pedir") {
      const s = sites.get(m.caixa);
      if (!s) { postMessage({ ev: "resp", id: m.id, semSite: true }); return; }
      sites.delete(m.caixa); sites.set(m.caixa, s); // mais recente
      const r = await s.pedir(m.req);
      const body = r.body.slice();
      postMessage({ ev: "resp", id: m.id, status: r.status, headers: r.headers, body, errors: r.errors, exit: r.exit }, [body.buffer]);
    }
  } catch (err) {
    postMessage({ ev: "falha", id: m.id, msg: String((err && err.message) || err) });
  }
};
