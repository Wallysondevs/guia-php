#!/usr/bin/env node
/* =====================================================================
   Gera assets/php/ (o PHP 8.5 em WebAssembly do "Experimente"):
     assets/php/php-worker.js      worker: @php-wasm/universal + carregador do PHP + tools/php-src/*
     assets/php/php_8_5.wasm.gz    o PHP 8.5 (build "asyncify") comprimido com gzip -9
     assets/php/LICENSE            GPL-2.0-or-later (do @php-wasm)
   e atualiza o tamanho do download em assets/phpsim.js.

   Uso:  cd tools && npm install && node construir-php.mjs
   (as versões exatas estão em tools/package.json)
   ===================================================================== */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const SAIDA = path.join(RAIZ, "assets/php");
const NM = path.join(AQUI, "node_modules");
const WEB = path.join(NM, "@php-wasm/web-8-5");
const require = createRequire(import.meta.url);
const esbuild = require(path.join(NM, "esbuild"));

fs.mkdirSync(SAIDA, { recursive: true });

// 1. o PHP (wasm) comprimido
const wasm = fs.readFileSync(path.join(WEB, "asyncify/8_5_10/php_8_5.wasm"));
const gz = zlib.gzipSync(wasm, { level: 9 });
fs.writeFileSync(path.join(SAIDA, "php_8_5.wasm.gz"), gz);
console.log("php_8_5.wasm:", wasm.length, "bytes → php_8_5.wasm.gz:", gz.length, "bytes");

// 2. o worker
// Única mudança no carregador do php-wasm: a leitura que "ainda não tem dados"
// (STDIN esperando o leitor digitar) desistia depois de 5 s; agora o tempo vem
// de Module.fdReadTimeoutMs (o motor usa 24 h; o botão Parar encerra antes).
const remendo = {
  name: "remendo-stdin",
  setup(b) {
    b.onLoad({ filter: /php_8_5\.js$/ }, (args) => {
      let src = fs.readFileSync(args.path, "utf8");
      const antes = "var timeout = 5e3;";
      if (src.split(antes).length !== 2) throw new Error("remendo-stdin: trecho não encontrado (versão nova do php-wasm?)");
      src = src.replace(antes, "var timeout = Module['fdReadTimeoutMs'] || 5e3;");
      return { contents: src, loader: "js" };
    });
  },
};
const r = await esbuild.build({
  entryPoints: [path.join(AQUI, "php-src/worker.mjs")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "eof",
  nodePaths: [NM],
  alias: { "php85-asyncify": path.join(WEB, "asyncify/php_8_5.js") },
  define: {
    __TAMANHO_GZ__: String(gz.length),
    "import.meta.url": "self.location.href",
  },
  external: ["fs", "path", "os", "http", "https", "net", "crypto", "child_process", "url", "events", "stream", "util", "worker_threads", "module", "tls", "zlib", "ws"],
  banner: { js: "/* Guia PHP — PHP 8.5.10 em WebAssembly (@php-wasm/universal 3.1.58 + @php-wasm/web-8-5 3.1.58, GPL-2.0-or-later). Gerado por tools/construir-php.mjs; fonte em tools/php-src/. */" },
  plugins: [remendo],
  outfile: path.join(SAIDA, "php-worker.js"),
  logLevel: "warning",
  metafile: true,
});
console.log("php-worker.js:", fs.statSync(path.join(SAIDA, "php-worker.js")).size, "bytes");

// 3. licença
fs.copyFileSync(path.join(WEB, "LICENSE"), path.join(SAIDA, "LICENSE"));

// 4. tamanho do download no phpsim.js
const sim = path.join(RAIZ, "assets/phpsim.js");
if (fs.existsSync(sim)) {
  const s = fs.readFileSync(sim, "utf8");
  const novo = s.replace(/var PHP_GZ_BYTES = \d+;/, "var PHP_GZ_BYTES = " + gz.length + ";");
  if (novo !== s) { fs.writeFileSync(sim, novo); console.log("assets/phpsim.js: PHP_GZ_BYTES =", gz.length); }
}
