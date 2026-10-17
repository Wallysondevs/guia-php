/* =====================================================================
   phpsim.js — o "Experimente" do Guia PHP, com o PHP 8.5 DE VERDADE.
   O PHP oficial compilado para WebAssembly (@php-wasm, licença GPL) fica em
   assets/php/ e só é baixado no primeiro clique em "Rodar"; ele roda num
   Web Worker (assets/php/php-worker.js), então um laço infinito não trava a
   página — o botão "Parar" encerra o worker.

   Monta as caixas  <div class="tryphp" data-goal="…" data-modo="cli|web" …>
   (contrato: CONTRIBUINDO.md, seções 3 e 4).
   Também roda no Node (tools/testar-missoes.js usa as funções puras daqui).
   ===================================================================== */
(function () {
  "use strict";
  var PHP_GZ_BYTES = 7932891; // tamanho de assets/php/php_8_5.wasm.gz (atualizado por tools/construir-php.mjs)
  var TEMPO_MAX = 30000;      // ms rodando sem parar (sem contar a espera por entrada)
  var MAX_LINHAS = 3000;      // linhas mostradas no terminal (o resto é resumido)
  var URL_BASE = "http://localhost:8000";
  var PhpSim = { versao: "8.5.10" };

  /* =====================================================================
     1. Funções puras (navegador e Node)
     ===================================================================== */
  function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  var ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bull: "•", middot: "·", deg: "°", times: "×", divide: "÷", euro: "€", pound: "£", cent: "¢", sect: "§", para: "¶", ordf: "ª", ordm: "º", larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔", rArr: "⇒", check: "✓", aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú", atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ", ccedil: "ç", Ccedil: "Ç", acirc: "â", Acirc: "Â", ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô", agrave: "à", Agrave: "À", uuml: "ü", Uuml: "Ü", ntilde: "ñ", Ntilde: "Ñ", le: "≤", ge: "≥", ne: "≠", shy: "\u00ad", zwj: "\u200d", thinsp: "\u2009", ensp: "\u2002", emsp: "\u2003" };
  function decodificarEntidades(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, function (t, n) {
      if (n.charAt(0) === "#") {
        var c = n.charAt(1).toLowerCase() === "x" ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10);
        try { return String.fromCodePoint(c); } catch (e) { return t; }
      }
      return Object.prototype.hasOwnProperty.call(ENTIDADES, n) ? ENTIDADES[n] : t;
    });
  }
  PhpSim.decodificarEntidades = decodificarEntidades;
  PhpSim.ENTIDADES = ENTIDADES;

  // Texto VISÍVEL de uma página HTML (meta html:). Igual no navegador e no Node.
  var BLOCOS = "address|article|aside|blockquote|br|caption|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|option|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul|label|legend|select|textarea|button";
  var RE_BLOCO = new RegExp("<\\/?(?:" + BLOCOS + ")\\b[^>]*>", "gi");
  function textoDeHtml(html) {
    var s = String(html)
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|template|noscript|title|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<input\b([^>]*)>/gi, function (t, a) {
        var tipo = /\btype\s*=\s*["']?(\w+)/i.exec(a), v = /\bvalue\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(a);
        tipo = tipo ? tipo[1].toLowerCase() : "text";
        if (tipo === "hidden" || tipo === "password" || tipo === "checkbox" || tipo === "radio" || tipo === "file") return " ";
        return " " + (v ? (v[2] !== undefined ? v[2] : v[3] !== undefined ? v[3] : v[4]) : "") + " ";
      })
      .replace(RE_BLOCO, " ")
      .replace(/<[^>]*>/g, "");
    return decodificarEntidades(s).replace(/[\s\u00a0]+/g, " ").trim();
  }
  PhpSim.textoDeHtml = textoDeHtml;
  function normalizarEspacos(s) { return String(s).replace(/[\s\u00a0]+/g, " ").trim(); }

  // Mensagens de erro/aviso do PHP (texto do terminal, ou HTML com html_errors)
  var RE_ERRO = /^(?:PHP )?(?:Fatal error|Parse error|Warning|Notice|Deprecated|Recoverable fatal error|Strict Standards|Unknown error):\s/;
  var RE_CONT = /^(?:Stack trace:|#\d+ |\s+thrown in |Next )/;
  function errosNoTexto(txt, ehHtml) {
    if (ehHtml) txt = decodificarEntidades(String(txt).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
    var blocos = [], atual = null;
    String(txt).split("\n").forEach(function (l) {
      if (RE_ERRO.test(l)) { atual = [l]; blocos.push(atual); }
      else if (atual && RE_CONT.test(l)) atual.push(l);
      else atual = null;
    });
    return blocos.map(function (b) { return b.join("\n"); });
  }
  PhpSim.errosNoTexto = errosNoTexto;
  PhpSim.RE_ERRO = RE_ERRO;

  var META_TIPOS = /^(out|outre|html|erro|semerro|exit|src)(:|\s*$|\s*,)/;
  function dividirMetas(meta) {
    var r = [], cur = "";
    meta = String(meta || "");
    for (var i = 0; i < meta.length; i++) {
      if (meta[i] === "\\" && meta[i + 1] === ",") { cur += ","; i++; continue; }
      if (meta[i] === "," && META_TIPOS.test(meta.slice(i + 1).replace(/^\s+/, ""))) { r.push(cur); cur = ""; continue; }
      cur += meta[i];
    }
    r.push(cur);
    return r.map(function (x) { return x.replace(/^\s+/, ""); }).filter(Boolean);
  }
  PhpSim.dividirMetas = dividirMetas;

  /* ctx: { modo: "cli"|"web", out: saída (cli: stdout+stderr; web: o HTML gerado),
            err: stderr, exit: código de saída, src: código do leitor (todas as abas),
            html: (web) texto visível — calculado se faltar } */
  function checarMeta(meta, ctx) {
    var falhas = [];
    var web = ctx.modo === "web";
    var erros = null;
    function listaErros() {
      if (!erros) erros = errosNoTexto(ctx.out || "", web).concat(errosNoTexto(ctx.err || "", false));
      return erros;
    }
    dividirMetas(meta).forEach(function (g) {
      var i = g.indexOf(":"), tipo = (i < 0 ? g : g.slice(0, i)).trim(), val = i < 0 ? "" : g.slice(i + 1), ok = false;
      try {
        switch (tipo) {
          case "out": ok = (ctx.out || "").indexOf(val) >= 0; break;
          case "outre": ok = new RegExp(val, "m").test(ctx.out || ""); break;
          case "html":
            if (ctx.html === undefined) ctx.html = textoDeHtml(ctx.out || "");
            ok = normalizarEspacos(ctx.html).indexOf(normalizarEspacos(val)) >= 0; break;
          case "erro": ok = listaErros().some(function (e) { return e.indexOf(val) >= 0; }); break;
          case "semerro": ok = listaErros().length === 0; break;
          case "exit": ok = ctx.exit !== null && ctx.exit !== undefined && String(ctx.exit) === val.trim(); break;
          case "src": ok = new RegExp(val, "m").test(ctx.src || ""); break;
          default: ok = false;
        }
      } catch (e) { ok = false; }
      if (!ok) falhas.push(g);
    });
    return falhas;
  }
  PhpSim.checarMeta = checarMeta;

  function decodificarAttr(s) { return String(s).replace(/\\n/g, "\n").replace(/\\t/g, "\t"); }
  PhpSim.decodificarAttr = decodificarAttr;
  // data-stdin → texto entregue ao programa (termina com Enter, como quem digita)
  function textoEntrada(s) { s = decodificarAttr(s); return s === "" || /\n$/.test(s) ? s : s + "\n"; }
  PhpSim.textoEntrada = textoEntrada;
  // "a 'b c' \"d\"" → ["a", "b c", "d"] (como o bash separa os argumentos)
  function dividirArgs(s) {
    var r = [], cur = null, i = 0;
    s = String(s || "");
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { if (cur !== null) { r.push(cur); cur = null; } i++; continue; }
      if (cur === null) cur = "";
      if (c === "'") { var f = s.indexOf("'", i + 1); if (f < 0) f = s.length; cur += s.slice(i + 1, f); i = f + 1; continue; }
      if (c === '"') { i++; while (i < s.length && s[i] !== '"') { if (s[i] === "\\" && /["\\$`]/.test(s[i + 1] || "")) i++; cur += s[i]; i++; } i++; continue; }
      if (c === "\\" && i + 1 < s.length) { cur += s[i + 1]; i += 2; continue; }
      cur += c; i++;
    }
    if (cur !== null) r.push(cur);
    return r;
  }
  PhpSim.dividirArgs = dividirArgs;
  // "/index.php?x=1" ou "index.php" → URL completa em localhost:8000
  function urlCompleta(u, base) {
    u = String(u || "/").trim();
    if (/^localhost(:\d+)?(\/|$)/i.test(u)) u = "http://" + u;
    try { return new URL(u, base || URL_BASE + "/").href; } catch (e) { return URL_BASE + "/"; }
  }
  PhpSim.urlCompleta = urlCompleta;
  function ehDoSite(u) { return u.indexOf(URL_BASE + "/") === 0 || u === URL_BASE; }
  // caminho relativo usado pelo PHP: "/index.php?x=1"
  function caminhoDe(u) { return u.slice(URL_BASE.length) || "/"; }
  PhpSim.caminhoDe = caminhoDe;
  PhpSim.URL_BASE = URL_BASE;
  // Corpo de formulário urlencoded (como o navegador faz)
  function urlencoded(campos) {
    return campos.map(function (c) {
      var v = c[1]; if (typeof v !== "string") v = v && v.name !== undefined ? v.name : String(v);
      return encodeURIComponent(c[0]).replace(/%20/g, "+") + "=" + encodeURIComponent(v).replace(/%20/g, "+");
    }).join("&");
  }
  PhpSim.urlencoded = urlencoded;

  if (typeof module === "object" && module.exports) { module.exports = PhpSim; }
  if (typeof document === "undefined") return;
  window.PhpSim = PhpSim;

  /* =====================================================================
     2. O PHP no Web Worker (um por página, compartilhado pelas caixas)
     ===================================================================== */
  var base = (function () {
    var s = document.querySelectorAll("script[src]");
    for (var i = 0; i < s.length; i++) { var src = s[i].getAttribute("src"); if (/phpsim\.js(\?|$)/.test(src)) return src.replace(/phpsim\.js.*$/, ""); }
    return "assets/";
  })();
  var worker = null, modulo = null, pronto = null, ouvintes = {}, seq = 0, aoProgresso = [];
  var geracao = 0; // muda quando o worker é encerrado (os sites do modo web somem)
  var dono = null; // caixa que está rodando um programa (modo cli)

  function mb(bytes) { return (bytes / 1e6).toFixed(1).replace(".", ","); }
  PhpSim.tamanhoDownload = function () { return mb(PHP_GZ_BYTES) + " MB"; };

  function carregarPHP(progresso) {
    if (progresso) aoProgresso.push(progresso);
    if (pronto) return pronto;
    pronto = new Promise(function (ok, falha) {
      try { worker = new Worker(base + "php/php-worker.js"); }
      catch (e) { falha(e); return; }
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.ev === "progresso") { aoProgresso.forEach(function (f) { try { f(m.lidos, m.total); } catch (x) {} }); return; }
        if (m.ev === "pronto") { if (m.modulo) modulo = m.modulo; aoProgresso = []; ok(); return; }
        if (m.ev === "falha" && !m.id) { aoProgresso = []; pronto = null; falha(new Error(m.msg)); return; }
        var f = ouvintes[m.id];
        if (f) f(m);
        else if (m.ev === "falha") console.error("phpsim:", m.msg);
      };
      worker.onerror = function (e) {
        var msg = (e && e.message) || "o worker do PHP falhou";
        if (pronto && !modulo) { pronto = null; falha(new Error(msg)); }
        console.error("phpsim:", msg);
      };
      worker.postMessage({ op: "carregar", modulo: modulo });
    });
    pronto.catch(function () { pronto = null; if (worker) { worker.terminate(); worker = null; } });
    return pronto;
  }
  function encerrarWorker() {
    if (worker) worker.terminate();
    worker = null; pronto = null; geracao++;
    var os = ouvintes; ouvintes = {};
    Object.keys(os).forEach(function (k) { try { os[k]({ ev: "morto", id: +k }); } catch (e) {} });
  }
  function enviar(msg, ouvinte, transferir) {
    var id = ++seq; msg.id = id;
    if (ouvinte) ouvintes[id] = ouvinte;
    worker.postMessage(msg, transferir || []);
    return id;
  }
  function esquecer(id) { delete ouvintes[id]; }

  /* =====================================================================
     3. Interface
     ===================================================================== */
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function lerPre(pre) { return pre.textContent.replace(/^\n/, "").replace(/\n$/, ""); }
  var nCaixa = 0;

  function montar(box) {
    if (box.getAttribute("data-montado")) return;
    box.setAttribute("data-montado", "1");
    var idCaixa = ++nCaixa;
    var web = (box.getAttribute("data-modo") || "cli").toLowerCase() === "web";
    var meta = box.getAttribute("data-goal") || "";
    var stdinAttr = box.getAttribute("data-stdin");
    var argsIni = box.getAttribute("data-args") || "";
    var padrao = box.getAttribute("data-file") || (web ? "index.php" : "programa.php");
    var scripts = Array.prototype.slice.call(box.querySelectorAll("pre.script"));
    var sols = Array.prototype.slice.call(box.querySelectorAll("pre.solucao"));
    var abas = scripts.map(function (p, i) { return { nome: p.getAttribute("data-file") || (i === 0 ? padrao : "arquivo" + i + ".php"), original: lerPre(p), atual: lerPre(p) }; });
    if (!abas.length) abas.push({ nome: padrao, original: "<?php\n", atual: "<?php\n" });
    var solucao = sols.length ? sols.map(function (p, i) { return { nome: p.getAttribute("data-file") || (abas[i] ? abas[i].nome : padrao), codigo: lerPre(p) }; }) : null;
    scripts.concat(sols).forEach(function (p) { p.style.display = "none"; });
    var ativa = 0;

    var w = el("div", { "class": "ts tp" + (web ? " tp-web" : "") });
    var tabsHtml = abas.map(function (a, i) {
      return '<button type="button" class="tp-tab' + (i === 0 ? " on" : "") + '" data-i="' + i + '" aria-pressed="' + (i === 0) + '">' + escHtml(a.nome) + "</button>";
    }).join("");
    var entradaHtml = (!web && stdinAttr !== null)
      ? '<label class="tp-entrada-l">Entrada: <textarea class="tp-entrada" rows="' + Math.min(4, Math.max(1, textoEntrada(stdinAttr).replace(/\n$/, "").split("\n").length)) + '" spellcheck="false" autocomplete="off" autocapitalize="off" title="O que o programa vai ler do teclado (STDIN), uma linha por Enter"></textarea></label>' : "";
    w.innerHTML =
      '<div class="ts-bar"><span class="tp-tabs">' + tabsHtml + '</span><span class="ts-sp"></span>' +
      (solucao ? '<button type="button" class="sim-btn ts-sol">Ver solução</button>' : "") +
      '<button type="button" class="sim-btn ts-rest" title="Volta ao código original">Restaurar</button></div>' +
      '<div class="ts-confirma" hidden><span>Trocar o seu código pela solução?</span> <button type="button" class="sim-btn2 ts-sim">Sim, mostrar</button> <button type="button" class="sim-btn2 secundario ts-nao">Cancelar</button></div>' +
      '<div class="ts-editor"><pre class="ts-nums" aria-hidden="true"></pre><textarea class="ts-code" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="Código PHP"></textarea></div>' +
      '<div class="ts-run">' +
      (web ? '<span class="tp-dica">O código vira a página <code>' + escHtml(abas[0].nome) + '</code> de um site em <code>localhost:8000</code>.</span>'
           : '<label class="ts-args-l">Argumentos: <input class="ts-args" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="(nenhum)"></label>' + entradaHtml) +
      '<button type="button" class="ts-rodar">▶ Rodar</button></div>' +
      '<div class="tp-carga" hidden><span class="tp-carga-txt"></span><span class="tp-barra"><i></i></span></div>' +
      (web
        ? '<div class="tp-nav" hidden>' +
            '<div class="tp-nav-bar"><button type="button" class="sim-btn tp-voltar" title="Voltar" aria-label="Voltar" disabled>←</button>' +
            '<button type="button" class="sim-btn tp-recarregar" title="Recarregar (pede a página de novo)" aria-label="Recarregar">⟳</button>' +
            '<input class="tp-url" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Endereço"><span class="tp-codigo-http"></span></div>' +
            '<div class="tp-vistas" role="tablist"><button type="button" class="tp-vista on" data-v="res" role="tab" aria-selected="true">Resultado</button><button type="button" class="tp-vista" data-v="src" role="tab" aria-selected="false">Código-fonte HTML</button></div>' +
            '<div class="tp-res"><iframe class="tp-frame" sandbox="allow-scripts allow-forms allow-modals" title="Resultado da página PHP" referrerpolicy="no-referrer"></iframe></div>' +
            '<div class="tp-src" hidden><details class="tp-cab"><summary>Cabeçalhos da resposta</summary><pre class="tp-cab-txt"></pre></details><pre class="tp-src-txt"></pre></div>' +
            '<pre class="tp-stderr" hidden></pre>' +
          "</div>"
        : '<div class="sim ts-saida" hidden><div class="sim-bar"><span class="sim-dots"><i></i><i></i><i></i></span><span class="sim-title">Terminal — ana@notebook: ~</span></div><div class="sim-screen ts-tela"><div class="sim-out"></div></div></div>');
    box.appendChild(w);
    var status = null;
    if (meta) { status = el("p", { "class": "sim-status", "aria-live": "polite" }, "Missão em andamento…"); box.appendChild(status); }

    var ta = w.querySelector(".ts-code"), nums = w.querySelector(".ts-nums"), btn = w.querySelector(".ts-rodar");
    var carga = w.querySelector(".tp-carga"), cargaTxt = w.querySelector(".tp-carga-txt"), barra = w.querySelector(".tp-barra i");
    ta.value = abas[0].atual;
    var cumprida = false;

    /* ---------- editor ---------- */
    function ajustar() {
      var n = ta.value.split("\n").length, t = "";
      for (var i = 1; i <= n; i++) t += i + "\n";
      nums.textContent = t;
      ta.style.height = "auto";
      ta.style.height = Math.max(ta.scrollHeight, 60) + "px";
    }
    function salvarAba() { abas[ativa].atual = ta.value; }
    function desenharAbas() {
      var cont = w.querySelector(".tp-tabs");
      cont.innerHTML = abas.map(function (a, i) { return '<button type="button" class="tp-tab' + (i === ativa ? " on" : "") + '" data-i="' + i + '" aria-pressed="' + (i === ativa) + '">' + escHtml(a.nome) + "</button>"; }).join("");
      Array.prototype.forEach.call(cont.querySelectorAll(".tp-tab"), function (b) { b.addEventListener("click", function () { trocarAba(+b.getAttribute("data-i")); }); });
    }
    function trocarAba(i) { salvarAba(); ativa = i; ta.value = abas[i].atual; ajustar(); desenharAbas(); }
    desenharAbas();
    function inserir(txt, a, b) {
      ta.setRangeText ? ta.setRangeText(txt, a, b, "end") : (ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b));
      if (!ta.setRangeText) ta.selectionStart = ta.selectionEnd = a + txt.length;
      salvarAba(); ajustar();
    }
    ta.addEventListener("input", function () { salvarAba(); ajustar(); });
    ta.addEventListener("keydown", function (e) {
      var a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        var ini = v.lastIndexOf("\n", a - 1) + 1;
        if (e.shiftKey) {
          var tira = /^ {1,4}|^\t/.exec(v.slice(ini));
          if (tira) { ta.value = v.slice(0, ini) + v.slice(ini + tira[0].length); ta.selectionStart = Math.max(ini, a - tira[0].length); ta.selectionEnd = Math.max(ini, b - tira[0].length); salvarAba(); ajustar(); }
        } else if (a !== b && v.slice(a, b).indexOf("\n") >= 0) {
          var bloco = v.slice(ini, b).replace(/^/gm, "    ");
          ta.value = v.slice(0, ini) + bloco + v.slice(b); ta.selectionStart = ini; ta.selectionEnd = ini + bloco.length; salvarAba(); ajustar();
        } else inserir("    ", a, b);
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); rodar(); }
      else if (e.key === "Enter" && !e.shiftKey) {
        var ini2 = v.lastIndexOf("\n", a - 1) + 1, antes = v.slice(ini2, a), ind = /^[ \t]*/.exec(antes)[0];
        if (/[{(\[:]\s*$/.test(antes) && !/^\s*(\/\/|#|\*)/.test(antes)) ind += "    ";
        if (ind) { e.preventDefault(); inserir("\n" + ind, a, b); }
      } else if (e.key === "Escape") { ta.blur(); }
    });
    w.querySelector(".ts-rest").addEventListener("click", function () { abas.forEach(function (a) { a.atual = a.original; }); abas = abas.filter(function (a) { return !a.extra; }); ativa = Math.min(ativa, abas.length - 1); ta.value = abas[ativa].atual; ajustar(); desenharAbas(); });
    var conf = w.querySelector(".ts-confirma");
    if (solucao) {
      w.querySelector(".ts-sol").addEventListener("click", function () { conf.hidden = false; });
      w.querySelector(".ts-sim").addEventListener("click", function () {
        solucao.forEach(function (sl) {
          var a = abas.filter(function (x) { return x.nome === sl.nome; })[0];
          if (a) a.atual = sl.codigo; else abas.push({ nome: sl.nome, original: "", atual: sl.codigo, extra: true });
        });
        ta.value = abas[ativa].atual; ajustar(); desenharAbas(); conf.hidden = true;
      });
      w.querySelector(".ts-nao").addEventListener("click", function () { conf.hidden = true; });
    }
    ajustar();

    function arquivos() { salvarAba(); return abas.map(function (a) { return { nome: a.nome, codigo: a.atual }; }); }
    function fonte() { return abas.map(function (a) { return a.atual; }).join("\n"); }
    function verificar(ctx) {
      if (!status || cumprida) return;
      ctx.src = fonte();
      var f = checarMeta(meta, ctx);
      if (!f.length) { cumprida = true; status.textContent = "✔ Missão cumprida!"; status.className = "sim-status ok"; }
      else if (f.every(function (x) { return /^(src|exit)/.test(x); })) status.textContent = "Missão em andamento… (ainda falta: " + f.join(", ") + ")";
      else if (f.some(function (x) { return /^semerro/.test(x); }) && f.length === 1) status.textContent = "Missão em andamento… (ainda há avisos ou erros do PHP)";
      else status.textContent = "Missão em andamento… (a saída ainda não é a esperada)";
    }

    /* ---------- carregamento do PHP (só na primeira vez) ---------- */
    function garantirPHP() {
      if (pronto && modulo) return pronto;
      carga.hidden = false;
      cargaTxt.textContent = modulo ? "Reiniciando o PHP…" : "Carregando o PHP (≈ " + mb(PHP_GZ_BYTES) + " MB, só na primeira vez)…";
      barra.style.width = "0%";
      var p = carregarPHP(function (lidos, total) {
        var pct = Math.min(100, Math.round(lidos * 100 / (total || PHP_GZ_BYTES)));
        barra.style.width = pct + "%";
        cargaTxt.textContent = (pct >= 100 ? "Preparando o PHP 8.5…" : "Carregando o PHP (≈ " + mb(PHP_GZ_BYTES) + " MB, só na primeira vez)… " + pct + "%");
      });
      return p.then(function () { carga.hidden = true; }, function (e) {
        carga.hidden = false; barra.style.width = "0%";
        cargaTxt.textContent = "Não consegui carregar o PHP: " + ((e && e.message) || e) + " Confira a internet e clique em Rodar de novo.";
        throw e;
      });
    }

    if (web) montarWeb(); else montarCli();

    /* =================================================================
       Modo cli: `php programa.php` num terminal
       ================================================================= */
    function montarCli() {
      var argsIn = w.querySelector(".ts-args"), entradaIn = w.querySelector(".tp-entrada");
      var saidaBox = w.querySelector(".ts-saida"), out = w.querySelector(".sim-out"), tela = w.querySelector(".ts-tela");
      argsIn.value = argsIni;
      if (entradaIn) entradaIn.value = textoEntrada(stdinAttr).replace(/\n$/, "");
      var sessao = null;

      function linhaCmd(cmd) { out.appendChild(el("div", { "class": "sim-cmd" }, '<span class="c-u">ana@notebook</span>:<span class="c-d">~</span>$ ' + escHtml(cmd))); }
      function info(txt, cls) { var d = el("div", { "class": cls || "sim-info" }); d.textContent = txt; out.appendChild(d); rolar(); return d; }
      function rolar() { tela.scrollTop = tela.scrollHeight; }

      // Terminal: texto chega em pedaços; cada linha completa é classificada
      // (erros do PHP em destaque). Segmentos: {t: "out"|"err"|"eco", s: texto}
      function Terminal() {
        this.linha = null; this.segs = []; this.erroAntes = false; this.n = 0; this.omitidas = 0; this.cauda = [];
      }
      Terminal.prototype.escrever = function (t, s) {
        var partes = s.split("\n");
        for (var i = 0; i < partes.length; i++) {
          if (partes[i]) this.seg(t, partes[i]);
          if (i < partes.length - 1) this.fechar();
        }
      };
      Terminal.prototype.seg = function (t, s) {
        var u = this.segs[this.segs.length - 1];
        if (u && u.t === t) u.s += s; else this.segs.push({ t: t, s: s });
        this.desenhar(false);
      };
      Terminal.prototype.classe = function (completa) {
        var txt = this.segs.filter(function (x) { return x.t === "out"; }).map(function (x) { return x.s; }).join("");
        if (!completa) return "";
        var erro = RE_ERRO.test(txt) || (this.erroAntes && RE_CONT.test(txt));
        return erro ? "sim-err" : "";
      };
      Terminal.prototype.desenhar = function (completa) {
        if (this.n >= MAX_LINHAS) return;
        if (!this.linha) { this.linha = el("div"); out.appendChild(this.linha); }
        var cl = this.classe(completa);
        this.linha.innerHTML = this.segs.map(function (x) {
          var c = x.t === "err" ? "sim-err" : x.t === "eco" ? "sim-digitado" : cl;
          return c ? '<span class="' + c + '">' + escHtml(x.s) + "</span>" : escHtml(x.s);
        }).join("");
      };
      Terminal.prototype.fechar = function () {
        var cl = this.classe(true);
        if (this.n < MAX_LINHAS) { this.desenhar(true); if (this.linha && !this.linha.innerHTML) this.linha.innerHTML = "<br>"; }
        else {
          this.omitidas++;
          this.cauda.push({ segs: this.segs, cl: cl });
          if (this.cauda.length > 40) this.cauda.shift();
        }
        this.erroAntes = cl === "sim-err";
        this.n++; this.linha = null; this.segs = [];
      };
      Terminal.prototype.terminar = function () {
        if (this.segs.length) this.fechar();
        if (this.omitidas) {
          var mostrar = this.cauda.length, pulo = this.omitidas - mostrar;
          if (pulo > 0) info("(… mais " + pulo.toLocaleString("pt-BR") + " linhas — o editor mostra só o começo e o fim …)");
          this.cauda.forEach(function (c) {
            out.appendChild(el("div", null, c.segs.map(function (x) {
              var k = x.t === "err" ? "sim-err" : x.t === "eco" ? "sim-digitado" : c.cl;
              return k ? '<span class="' + k + '">' + escHtml(x.s) + "</span>" : escHtml(x.s);
            }).join("") || "<br>"));
          });
        }
      };
      // devolve o elemento da linha atual (para pôr o campo de entrada no fim dela)
      Terminal.prototype.linhaAtual = function () {
        if (!this.linha) { this.linha = el("div"); out.appendChild(this.linha); this.desenhar(false); }
        return this.linha;
      };

      function parar(motivo) {
        if (!sessao || !sessao.rodando) return;
        var s = sessao;
        s.motivo = motivo || "^C";
        encerrarWorker(); // avisa s.ouvinte com {ev: "morto"}
        finalizar(s, null, s.motivo);
      }

      function finalizar(s, exit, motivo) {
        if (s.fim) return;
        s.fim = true;
        clearInterval(s.relogio);
        if (s.campo && s.campo.parentNode) s.campo.parentNode.removeChild(s.campo);
        esquecer(s.id);
        if (motivo === "^C") { s.term.escrever("eco", "^C"); }
        s.term.terminar();
        if (motivo && motivo !== "^C") info(motivo, "sim-info");
        var codigo = exit === null || exit === undefined ? (motivo === "^C" ? 130 : null) : exit;
        out.appendChild(el("div", { "class": "ts-codigo" + (codigo ? " ts-erro" : "") }, codigo === null ? "[programa interrompido]" : "[código de saída: " + codigo + "]"));
        rolar();
        sessao = null; if (dono === parar) dono = null;
        btn.textContent = "▶ Rodar"; btn.disabled = false;
        if (exit !== null && exit !== undefined) verificar({ modo: "cli", out: s.texto, err: s.textoErr, exit: exit });
      }

      function pedirEntrada(s) {
        if (s.campo || !worker) return;
        var campo = el("input", { "class": "ts-campo", type: "text", spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-label": "Entrada do programa (Enter envia, Ctrl+D encerra a entrada)" });
        s.term.linhaAtual().appendChild(campo);
        s.campo = campo; s.esperando = true;
        campo.focus({ preventScroll: true });
        rolar();
        campo.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            var v = campo.value;
            campo.parentNode.removeChild(campo); s.campo = null; s.esperando = false; s.desde = Date.now();
            s.term.escrever("eco", v + "\n");
            if (worker) worker.postMessage({ op: "entrada", texto: v + "\n" });
            rolar();
          } else if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
            e.preventDefault();
            campo.parentNode.removeChild(campo); s.campo = null; s.esperando = false; s.desde = Date.now();
            if (worker) worker.postMessage({ op: "eof" });
          } else if (e.ctrlKey && (e.key === "c" || e.key === "C") && !campo.value.slice(campo.selectionStart, campo.selectionEnd)) {
            e.preventDefault(); parar();
          }
        });
      }

      function rodar() {
        if (sessao) { parar(); return; }
        var arqs = arquivos();
        saidaBox.hidden = false;
        out.innerHTML = "";
        var args = dividirArgs(argsIn.value);
        linhaCmd("php " + arqs[0].nome + (argsIn.value.trim() ? " " + argsIn.value.trim() : ""));
        var s = sessao = { term: new Terminal(), texto: "", textoErr: "", dec: { out: new TextDecoder(), err: new TextDecoder() }, gasto: 0, desde: 0, esperando: false, fim: false, rodando: false };
        btn.textContent = "…"; btn.disabled = true;
        garantirPHP().then(function () {
          if (sessao !== s) return;
          if (dono && dono !== parar) dono("(outro programa foi iniciado nesta página)");
          s.rodando = true; dono = parar;
          btn.textContent = "■ Parar"; btn.disabled = false;
          s.desde = Date.now();
          s.relogio = setInterval(function () {
            if (s.esperando || s.fim) return;
            var agora = Date.now(); s.gasto += agora - s.desde; s.desde = agora;
            if (s.gasto > TEMPO_MAX) parar("(o editor parou o programa: ele rodou mais de " + TEMPO_MAX / 1000 + " segundos sem terminar — laço infinito?)");
          }, 500);
          var stdin = entradaIn ? textoEntrada(entradaIn.value) : null;
          s.ouvinte = function (m) {
            if (s.fim) return;
            if (m.ev === "saida") {
              m.partes.forEach(function (p) {
                var txt = s.dec[p.t === "err" ? "err" : "out"].decode(p.b, { stream: true });
                s.texto += txt; if (p.t === "err") s.textoErr += txt;
                s.term.escrever(p.t === "err" ? "err" : "out", txt);
              });
              rolar();
            } else if (m.ev === "eco") { s.term.escrever("eco", m.texto); rolar(); }
            else if (m.ev === "espera") { s.gasto += Date.now() - s.desde; pedirEntrada(s); }
            else if (m.ev === "fim") finalizar(s, m.exit);
            else if (m.ev === "limite") { s.motivo = "(o programa escreveu mais de 2 MB; o editor o interrompeu)"; encerrarWorker(); }
            else if (m.ev === "falha") { s.motivo = "(o PHP do navegador falhou: " + m.msg + ")"; encerrarWorker(); }
            else if (m.ev === "morto") finalizar(s, null, s.motivo || "(o PHP foi reiniciado)");
          };
          s.id = enviar({ op: "cli", arquivos: arqs, principal: arqs[0].nome, args: args, stdin: stdin }, s.ouvinte);
        }, function () {
          if (sessao !== s) return;
          sessao = null; btn.textContent = "▶ Rodar"; btn.disabled = false;
        });
      }
      btn.addEventListener("click", rodar);
    }

    /* =================================================================
       Modo web: o código é a index.php de um site em localhost:8000
       ================================================================= */
    function montarWeb() {
      var nav = w.querySelector(".tp-nav"), urlIn = w.querySelector(".tp-url"), frame = w.querySelector(".tp-frame");
      var codHttp = w.querySelector(".tp-codigo-http"), srcTxt = w.querySelector(".tp-src-txt"), cabTxt = w.querySelector(".tp-cab-txt");
      var stderrBox = w.querySelector(".tp-stderr"), voltar = w.querySelector(".tp-voltar");
      var vRes = w.querySelector(".tp-res"), vSrc = w.querySelector(".tp-src");
      var siteGeracao = -1, ocupado = false, historico = [], atual = null, arqsSite = null;
      Array.prototype.forEach.call(w.querySelectorAll(".tp-vista"), function (b) {
        b.addEventListener("click", function () {
          var src = b.getAttribute("data-v") === "src";
          vRes.hidden = src; vSrc.hidden = !src;
          Array.prototype.forEach.call(w.querySelectorAll(".tp-vista"), function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); });
        });
      });
      function primeiraUrl() { return urlCompleta(box.getAttribute("data-url") || "/" + (abas[0].nome === "index.php" ? "" : abas[0].nome)); }

      function pedir(req) {
        // req: { method, url (completa), headers, body }
        return new Promise(function (ok, falha) {
          function tentar(recriar) {
            var feito = function () {
              var id = enviar({ op: "pedir", caixa: idCaixa, req: { method: req.method, url: caminhoDe(req.url), headers: Object.assign({ "user-agent": navigator.userAgent }, req.headers || {}), body: req.body } }, function (m) {
                esquecer(id);
                if (m.ev === "resp" && m.semSite && !recriar) { tentar(true); return; }
                if (m.ev === "resp" && !m.semSite) ok(m);
                else falha(new Error(m.ev === "morto" ? "o PHP foi reiniciado" : m.msg || "sem resposta"));
              });
            };
            if (recriar || siteGeracao !== geracao) criarSite(arqsSite).then(feito, falha);
            else feito();
          }
          garantirPHP().then(function () { tentar(false); }, falha);
        });
      }
      function criarSite(arqs) {
        return new Promise(function (ok, falha) {
          var id = enviar({ op: "site", caixa: idCaixa, arquivos: arqs }, function (m) {
            esquecer(id);
            if (m.ev === "site-ok") { siteGeracao = geracao; ok(); } else falha(new Error(m.msg || "o PHP foi reiniciado"));
          });
        });
      }

      // Navega: segue redirecionamentos (Location) como o navegador.
      function navegar(req, origem) {
        if (ocupado) return;
        if (!ehDoSite(req.url)) { mostrarFora(req.url); return; }
        ocupado = true; btn.disabled = true;
        var saltos = 0;
        function passo(r) {
          return pedir(r).then(function (resp) {
            var loc = (resp.headers.location || resp.headers.Location || [])[0];
            if (resp.status >= 300 && resp.status < 400 && loc && saltos < 10) {
              saltos++;
              var prox = urlCompleta(loc, r.url);
              if (!ehDoSite(prox)) { mostrarFora(prox); return null; }
              var met = (resp.status === 307 || resp.status === 308) ? r.method : "GET";
              return passo({ method: met, url: prox, headers: met === "GET" ? {} : r.headers, body: met === "GET" ? undefined : r.body });
            }
            return { req: r, resp: resp };
          });
        }
        passo(req).then(function (fim) {
          ocupado = false; btn.disabled = false;
          if (!fim) return;
          if (atual && origem !== "voltar" && origem !== "recarregar") { historico.push(atual); }
          voltar.disabled = !historico.length;
          mostrar(fim.req, fim.resp, saltos);
        }, function (e) {
          ocupado = false; btn.disabled = false;
          stderrBox.hidden = false; stderrBox.textContent = "(o PHP do navegador falhou: " + ((e && e.message) || e) + ")";
        });
      }
      function mostrarFora(u) {
        nav.hidden = false;
        frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font:15px system-ui,sans-serif;padding:12px;color:#333">' +
          "<p>Este link leva para fora do site de exemplo:</p><p><code>" + escHtml(u) + "</code></p><p>O navegador do guia só abre páginas do site desta caixa (<code>localhost:8000</code>).</p>";
      }
      function mostrar(req, resp, saltos) {
        var html = new TextDecoder().decode(resp.body);
        var tipo = ((resp.headers["content-type"] || [])[0] || "text/html").toLowerCase();
        atual = { req: req, resp: resp, html: html };
        nav.hidden = false;
        urlIn.value = req.url.replace(/^https?:\/\//, "");
        codHttp.textContent = resp.status === 200 ? "" : String(resp.status);
        codHttp.className = "tp-codigo-http" + (resp.status >= 400 ? " ruim" : "");
        var ehHtml = tipo.indexOf("html") >= 0;
        frame.style.height = "";
        frame.srcdoc = ehHtml ? injetar(html, req.url) : '<!doctype html><meta charset="utf-8"><pre style="white-space:pre-wrap;word-break:break-word;margin:8px;font:13px/1.5 ui-monospace,monospace">' + escHtml(html) + "</pre>";
        srcTxt.textContent = html;
        var cab = ["HTTP/1.1 " + resp.status + " " + (TEXTOS_HTTP[resp.status] || "")];
        Object.keys(resp.headers).forEach(function (k) { resp.headers[k].forEach(function (v) { cab.push(nomeCabecalho(k) + ": " + v); }); });
        if (saltos) cab.push("", "(o navegador seguiu " + saltos + " redirecionamento" + (saltos > 1 ? "s" : "") + " até chegar aqui)");
        cabTxt.textContent = cab.join("\n");
        stderrBox.hidden = !resp.errors; stderrBox.textContent = resp.errors || "";
        verificar({ modo: "web", out: html, err: resp.errors || "", exit: resp.exit });
      }
      function nomeCabecalho(k) { return k.replace(/(^|-)([a-z])/g, function (t, a, b) { return a + b.toUpperCase(); }); }

      function rodar() {
        if (ocupado) return;
        if (dono) dono("(outro programa foi iniciado nesta página)");
        arqsSite = arquivos();
        historico = []; atual = null; voltar.disabled = true;
        siteGeracao = -1;
        nav.hidden = false; stderrBox.hidden = true;
        frame.srcdoc = '<!doctype html><meta charset="utf-8"><body style="font:15px system-ui,sans-serif;color:#777;padding:12px">Carregando…';
        var post = box.getAttribute("data-post");
        var u = primeiraUrl();
        ocupado = true; btn.disabled = true;
        garantirPHP().then(function () { return criarSite(arqsSite); }).then(function () {
          ocupado = false; btn.disabled = false;
          if (post !== null) navegar({ method: "POST", url: u, headers: { "content-type": "application/x-www-form-urlencoded" }, body: new TextEncoder().encode(post) });
          else navegar({ method: "GET", url: u });
        }, function () { ocupado = false; btn.disabled = false; });
      }
      btn.addEventListener("click", rodar);
      urlIn.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (!arqsSite) { rodar(); return; }
        navegar({ method: "GET", url: urlCompleta(urlIn.value) });
      });
      voltar.addEventListener("click", function () {
        if (!historico.length || ocupado) return;
        var ant = historico.pop(); voltar.disabled = !historico.length;
        mostrar(ant.req, ant.resp, 0);
      });
      w.querySelector(".tp-recarregar").addEventListener("click", function () {
        if (!atual) { rodar(); return; }
        navegar(atual.req, "recarregar");
      });

      // Mensagens do iframe (links, formulários, altura)
      window.addEventListener("message", function (e) {
        if (e.source !== frame.contentWindow || !e.data || e.data.phpsim !== 1) return;
        var m = e.data;
        if (m.tipo === "altura") { frame.style.height = Math.max(120, Math.min(600, (+m.h || 0) + 4)) + "px"; return; }
        if (!atual) return;
        if (m.tipo === "ir") { navegar({ method: "GET", url: urlCompleta(m.url, atual.req.url) }); return; }
        if (m.tipo === "form") {
          var destino = m.url ? urlCompleta(m.url, atual.req.url) : atual.req.url;
          var campos = m.campos || [];
          if (m.metodo !== "post") {
            var q = urlencoded(campos), semQ = destino.replace(/[?#].*$/, "");
            navegar({ method: "GET", url: semQ + "?" + q });
            return;
          }
          if (/multipart\/form-data/i.test(m.enctype || "")) {
            multipart(campos).then(function (r) { navegar({ method: "POST", url: destino, headers: { "content-type": "multipart/form-data; boundary=" + r.fronteira }, body: r.corpo }); });
          } else {
            navegar({ method: "POST", url: destino, headers: { "content-type": "application/x-www-form-urlencoded" }, body: new TextEncoder().encode(urlencoded(campos)) });
          }
        }
      });
    }
  }

  var TEXTOS_HTTP = { 200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found", 303: "See Other", 304: "Not Modified", 307: "Temporary Redirect", 308: "Permanent Redirect", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 418: "I'm a teapot", 422: "Unprocessable Content", 500: "Internal Server Error", 503: "Service Unavailable" };

  function multipart(campos) {
    var fronteira = "----GuiaPHPFormBoundary" + Math.random().toString(36).slice(2, 12);
    var enc = new TextEncoder(), partes = [];
    campos.forEach(function (c) {
      var nome = String(c[0]).replace(/"/g, "%22").replace(/\r?\n/g, " ");
      var v = c[1];
      if (typeof v === "string") {
        partes.push(Promise.resolve(enc.encode("--" + fronteira + "\r\nContent-Disposition: form-data; name=\"" + nome + "\"\r\n\r\n" + v.replace(/\r?\n/g, "\r\n") + "\r\n")));
      } else {
        var cab = "--" + fronteira + "\r\nContent-Disposition: form-data; name=\"" + nome + "\"; filename=\"" + String(v.name || "").replace(/"/g, "%22") + "\"\r\nContent-Type: " + (v.type || "application/octet-stream") + "\r\n\r\n";
        partes.push(v.arrayBuffer().then(function (ab) {
          var a = enc.encode(cab), b = new Uint8Array(ab), f = enc.encode("\r\n"), r = new Uint8Array(a.length + b.length + 2);
          r.set(a, 0); r.set(b, a.length); r.set(f, a.length + b.length); return r;
        }));
      }
    });
    return Promise.all(partes).then(function (ps) {
      ps.push(enc.encode("--" + fronteira + "--\r\n"));
      var n = 0; ps.forEach(function (p) { n += p.length; });
      var corpo = new Uint8Array(n), o = 0; ps.forEach(function (p) { corpo.set(p, o); o += p.length; });
      return { fronteira: fronteira, corpo: corpo };
    });
  }

  // Script colocado no começo da página gerada: links e formulários viram
  // mensagens para o editor, que faz a requisição ao PHP (GET/POST).
  var SCRIPT_IFRAME = "(" + function () {
    var P = parent;
    function msg(m) { m.phpsim = 1; P.postMessage(m, "*"); }
    addEventListener("click", function (e) {
      if (e.defaultPrevented) return;
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      var h = a.getAttribute("href") || "";
      if (/^\s*javascript:/i.test(h)) return;
      e.preventDefault();
      if (h.charAt(0) === "#") {
        var id = decodeURIComponent(h.slice(1)), t = id ? (document.getElementById(id) || document.getElementsByName(id)[0]) : null;
        if (t) t.scrollIntoView(); else if (!id) scrollTo(0, 0);
        return;
      }
      msg({ tipo: "ir", url: a.href });
    });
    addEventListener("submit", function (e) {
      if (e.defaultPrevented) return;
      e.preventDefault();
      var f = e.target, s = e.submitter || null, fd;
      try { fd = new FormData(f, s); } catch (x) { fd = new FormData(f); if (s && s.name) fd.append(s.name, s.value); }
      var campos = []; fd.forEach(function (v, k) { campos.push([k, v]); });
      var met = ((s && s.getAttribute("formmethod")) || f.getAttribute("method") || "get").toLowerCase();
      var act = s && s.getAttribute("formaction") ? s.formAction : (f.getAttribute("action") ? f.action : null);
      var enc = (s && s.getAttribute("formenctype")) || f.getAttribute("enctype") || "application/x-www-form-urlencoded";
      msg({ tipo: "form", metodo: met, url: act, enctype: enc, campos: campos });
    });
    function alt() { var d = document.documentElement, b = document.body; msg({ tipo: "altura", h: Math.max(d ? d.scrollHeight : 0, b ? b.scrollHeight : 0) }); }
    addEventListener("load", alt);
    if (window.ResizeObserver) addEventListener("DOMContentLoaded", function () { new ResizeObserver(alt).observe(document.documentElement); });
  }.toString() + ")();";
  function injetar(html, url) {
    var ins = '<base href="' + escHtml(url) + '"><script>' + SCRIPT_IFRAME + "<\/script>";
    var m = /^(\s*<!doctype[^>]*>)/i.exec(html);
    return m ? m[1] + ins + html.slice(m[1].length) : ins + html;
  }
  PhpSim._injetar = injetar;

  function montarTudo() {
    Array.prototype.forEach.call(document.querySelectorAll(".tryphp"), function (b) {
      try { montar(b); } catch (e) { console.error("phpsim:", e); }
    });
  }
  PhpSim.montarTudo = montarTudo;
  PhpSim._estado = function () { return { carregado: !!modulo, worker: !!worker }; };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarTudo); else montarTudo();
})();
