/* Roda no PHP 8.5.8 NATIVO do laboratório (~/guia-php-lab/lab) para comparar
   com o PHP 8.5.10 em WebAssembly do navegador. Um processo por vez, timeout 60. */
"use strict";
const { spawnSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const LAB = path.join(os.homedir(), "guia-php-lab/lab");
const NOME = "phpsim-testes"; // pasta pessoal própria no laboratório

function b64(s) { return Buffer.from(s, "utf8").toString("base64"); }
function q(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function escreverArquivos(arquivos) {
  return arquivos.map((a) => 'mkdir -p "$(dirname ' + q(a.nome) + ')" && printf %s ' + q(b64(a.codigo)) + " | base64 -d > " + q(a.nome)).join("\n");
}
function rodarLab(script, rede) {
  if (!fs.existsSync(LAB)) throw new Error("laboratório não encontrado em " + LAB);
  const r = spawnSync("timeout", ["60", LAB, "-n", NOME].concat(rede ? ["-N"] : []).concat(["--", "bash", "-s"]), { input: script, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (r.error) throw r.error;
  return r.stdout + (r.stderr || "");
}
const LIMPAR = "cd /home/ana && rm -rf ./* ./.[!.]* 2>/dev/null; cd /home/ana";

function rodarCli(arquivos, opts) {
  opts = opts || {};
  const args = (opts.args || []).map(q).join(" ");
  const entrada = opts.stdin !== null && opts.stdin !== undefined ? "printf %s " + q(b64(opts.stdin)) + " | base64 -d > /tmp/entrada.txt" : ": > /tmp/entrada.txt";
  const script = [LIMPAR, escreverArquivos(arquivos), entrada,
    "echo @@INICIO@@", "php " + q(arquivos[0].nome) + " " + args + " < /tmp/entrada.txt 2>&1", 'echo "@@EXIT@@$?"', "php -r 'echo PHP_VERSION;'"].join("\n");
  const s = rodarLab(script);
  const m = /@@INICIO@@\n([\s\S]*?)@@EXIT@@(\d+)\n?([\d.]*)/.exec(s);
  if (!m) return { saida: s, exit: null, versao: "?" };
  return { saida: m[1], exit: +m[2], versao: m[3] || "8.5.8" };
}

function rodarWeb(arquivos, opts) {
  opts = opts || {};
  const caminho = opts.url || "/" + (arquivos[0].nome === "index.php" ? "" : arquivos[0].nome);
  const post = opts.post !== null && opts.post !== undefined ? "--data-binary " + q(opts.post) + " -H 'Content-Type: application/x-www-form-urlencoded'" : "";
  const script = [LIMPAR, "mkdir -p site && cd site", escreverArquivos(arquivos),
    "(php -S localhost:8000 >/tmp/srv.log 2>&1 &)",
    "for i in $(seq 1 30); do curl -s -o /dev/null localhost:8000/ && break; sleep 0.1; done",
    "curl -s -L -o /tmp/corpo -w '%{http_code}' " + post + " " + q("http://localhost:8000" + (caminho.startsWith("/") ? caminho : "/" + caminho)) + " > /tmp/status",
    'pkill -f "php -S" 2>/dev/null', "echo @@STATUS@@$(cat /tmp/status)", "echo @@CORPO@@", "cat /tmp/corpo", "echo", "echo @@FIM@@", "php -r 'echo PHP_VERSION;'"].join("\n");
  const s = rodarLab(script, true); // -N: localhost próprio (a porta 8000 não briga com os autores)
  const m = /@@STATUS@@(\d*)\n@@CORPO@@\n([\s\S]*)\n@@FIM@@\n?([\d.]*)/.exec(s);
  if (!m) return { html: s, status: null, versao: "?" };
  return { html: m[2], status: +m[1], versao: m[3] || "8.5.8" };
}

// Diferenças linha a linha (LCS simples), para mostrar no terminal.
function diferencas(a, b) {
  const A = String(a).replace(/\n$/, "").split("\n").slice(0, 600), B = String(b).replace(/\n$/, "").split("\n").slice(0, 600);
  const n = A.length, m = B.length, L = [];
  for (let i = 0; i <= n; i++) L.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const r = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { r.push("+ " + B[j]); j++; }
    else { r.push("- " + A[i]); i++; }
  }
  return r;
}
function mostrarDiferencas(wasm, nativo, prefixo) {
  prefixo = prefixo || "  ";
  const d = diferencas(wasm, nativo);
  if (!d.length) { console.log(prefixo + "saídas idênticas"); return 0; }
  console.log(prefixo + "diferenças (- navegador/wasm, + nativo):");
  d.slice(0, 20).forEach((l) => console.log(prefixo + "  " + l));
  if (d.length > 20) console.log(prefixo + "  … (" + (d.length - 20) + " linhas a mais)");
  return d.length;
}

module.exports = { rodarCli, rodarWeb, diferencas, mostrarDiferencas, LAB };
