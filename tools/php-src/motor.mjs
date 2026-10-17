/* =====================================================================
   Motor do "Experimente" do Guia PHP — o MESMO código roda:
   - no navegador, dentro do Web Worker assets/php/php-worker.js
     (gerado por tools/construir-php.mjs a partir de tools/php-src/worker.mjs);
   - no Node, em tools/testar-missoes.js e tools/sim.js.
   Ele recebe pronto o PHP 8.5 em WebAssembly (@php-wasm, licença GPL) e
   sabe fazer duas coisas:
   1. rodarCli(): `php arquivo.php args` com um PHP novinho (estado limpo);
   2. novoSite(): um "php -S localhost:8000" em memória, para o modo web.
   ===================================================================== */

export const HOME = "/home/ana";
export const DOCROOT = "/home/ana/site";
export const URL_BASE = "http://localhost:8000";

// Variáveis de ambiente da máquina da Ana (nada da máquina real).
export const AMBIENTE = {
  USER: "ana",
  LOGNAME: "ana",
  HOME: HOME,
  PWD: HOME,
  PATH: "/usr/local/bin:/usr/bin:/bin",
  SHELL: "/bin/bash",
  LANG: "pt_BR.UTF-8",
  _: "/usr/bin/php",
};

// php.ini: o php-wasm traz um php.ini próprio; estes valores deixam o PHP do
// navegador igual ao PHP 8.5.8 do laboratório (que roda sem php.ini).
export const INI_COMUM = {
  auto_prepend_file: "",          // o php-wasm põe um arquivo próprio aqui
  ignore_repeated_errors: "0",    // o php-wasm esconde avisos repetidos; o PHP normal não
  log_errors: "0",                // senão cada aviso sai duas vezes (stderr "PHP Warning:" + stdout)
  display_errors: "1",
  error_reporting: "E_ALL",
  memory_limit: "128M",
  upload_max_filesize: "2M",
  post_max_size: "8M",
  "session.save_path": "",
  "opcache.enable_cli": "0",
  // Sem rede no navegador: abrir conexões derruba o PHP em WebAssembly (trap
  // "unreachable"). Desligadas, elas dão as mensagens normais do PHP.
  allow_url_fopen: "0",
  disable_functions: "fsockopen,pfsockopen,stream_socket_client,stream_socket_server,curl_exec,curl_multi_exec",
};
export const INI_CLI = { html_errors: "0" };
export const INI_WEB = { html_errors: "1" };

const PAGINA_404 = (caminho) =>
  '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 Not Found</title><style>\n' +
  "body { background-color: #fcfcfc; color: #333333; margin: 0; padding:0; }\n" +
  "h1 { font-size: 1.5em; font-weight: normal; background-color: #9999cc; min-height:2em; line-height:2em; border-bottom: 1px inset black; margin: 0; }\n" +
  "h1, p { padding-left: 10px; }\n" +
  "code.url { background-color: #eeeeee; font-family:monospace; padding:0 2px;}\n" +
  '</style>\n</head><body><h1>Not Found</h1><p>The requested resource <code class="url">' +
  caminho.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
  "</code> was not found on this server.</p></body></html>";

function dirDe(p) { const i = p.lastIndexOf("/"); return i <= 0 ? "/" : p.slice(0, i); }

/**
 * deps: { U: @php-wasm/universal, Ut: @php-wasm/util, loader: php_8_5.js (asyncify),
 *         modulo: WebAssembly.Module já compilado }
 */
export function criarMotor(deps) {
  const { U, Ut, loader } = deps;
  let modulo = deps.modulo;

  async function novoPHP(entrada) {
    let falhou;
    const id = await U.loadPHPRuntime(loader, {
      ENV: Object.assign({}, AMBIENTE), // cópia: o carregador do PHP altera o objeto
      // Leitura de STDIN parada à espera do leitor: o PHP fica "dormindo"
      // (Asyncify) até a entrada chegar. Ver construir-php.mjs.
      fdReadTimeoutMs: 24 * 3600 * 1000,
      instantiateWasm(imports, ok) {
        WebAssembly.instantiate(modulo, imports).then((inst) => ok(inst, modulo), (e) => { falhou = e; console.error(e); });
        return {};
      },
      ...(entrada ? { stdin: entrada } : { stdin: () => null }),
    });
    if (falhou) throw falhou;
    const php = new U.PHP(id);
    // exec(), shell_exec(), system(), proc_open()…: não há sistema operacional
    // de verdade no navegador; o comando "não existe".
    await php.setSpawnHandler(
      Ut.createSpawnHandler(async (argv, api) => {
        await new Promise((r) => setTimeout(r, 1));
        const cmd = Array.isArray(argv) ? argv.join(" ") : String(argv);
        api.stderr("sh: " + cmd + ": comando não disponível no PHP do navegador\n");
        api.exit(127);
      })
    );
    return php;
  }

  function escreverArquivos(php, base, arquivos) {
    php.mkdirTree(base);
    for (const a of arquivos) {
      const caminho = a.nome.startsWith("/") ? a.nome : base + "/" + a.nome;
      php.mkdirTree(dirDe(caminho));
      php.writeFile(caminho, a.codigo);
    }
  }

  // Intercepta a saída do PHP no momento em que ela é escrita (na ordem certa
  // em relação às leituras de STDIN), sem guardar cópias.
  function ligarSaida(php, aoSaida) {
    const rt = php[U.__private__dont__use];
    for (const [prop, tipo] of [["onStdout", "out"], ["onStderr", "err"]]) {
      Object.defineProperty(rt, prop, {
        configurable: true,
        get: () => (p) => aoSaida(tipo, p.slice()),
        set: () => {},
      });
    }
  }

  /**
   * opts: { arquivos: [{nome, codigo}], principal, args: [], entrada: () => byte|null|undefined,
   *         aoSaida: (tipo "out"|"err", Uint8Array) => void, iniExtra }
   * Retorna o código de saída. Cada chamada usa um PHP novo (estado limpo).
   */
  async function rodarCli(opts) {
    const php = await novoPHP(opts.entrada);
    escreverArquivos(php, HOME, opts.arquivos);
    await U.setPhpIniEntries(php, Object.assign({}, INI_COMUM, INI_CLI, opts.iniExtra || {}));
    php.chdir(HOME);
    ligarSaida(php, opts.aoSaida);
    const r = await php.cli(["php", opts.principal].concat(opts.args || []), { cwd: HOME, env: Object.assign({}, AMBIENTE) });
    // os fluxos ficam vazios (a saída foi interceptada); é só esvaziá-los
    r.stdout.cancel && r.stdout.cancel().catch(() => {});
    r.stderr.cancel && r.stderr.cancel().catch(() => {});
    return await r.exitCode;
  }

  /** Um "php -S localhost:8000" em memória, com os arquivos da caixa em /home/ana/site. */
  async function novoSite(arquivos, iniExtra) {
    const php = await novoPHP(() => null);
    await php.setSapiName("cli-server");
    escreverArquivos(php, DOCROOT, arquivos);
    await U.setPhpIniEntries(php, Object.assign({}, INI_COMUM, INI_WEB, iniExtra || {}));
    php.chdir(DOCROOT);
    const enc = new TextEncoder();
    const handler = new U.PHPRequestHandler({
      php,
      documentRoot: DOCROOT,
      absoluteUrl: URL_BASE,
      getFileNotFoundAction: (caminho) => ({
        type: "response",
        response: new U.PHPResponse(404, { "content-type": ["text/html; charset=UTF-8"] }, enc.encode(PAGINA_404(caminho))),
      }),
    });
    return {
      php,
      /** req: { method, url, headers, body (Uint8Array) } */
      async pedir(req) {
        const r = await handler.request({
          method: req.method || "GET",
          url: req.url || "/",
          headers: req.headers || {},
          body: req.body,
        });
        return { status: r.httpStatusCode, headers: r.headers, body: r.bytes, errors: r.errors || "", exit: r.exitCode };
      },
      lerArquivo(caminho) { return php.readFileAsBuffer(caminho); },
    };
  }

  return { rodarCli, novoSite, novoPHP, trocarModulo(m) { modulo = m; } };
}

/**
 * Entrada (STDIN) do programa, entregue LINHA POR LINHA: cada leitura do PHP
 * recebe no máximo uma linha, então a saída e o eco do que foi "digitado"
 * aparecem na ordem certa. Sem linha disponível:
 *   - se a entrada já acabou (texto fixo, ou Ctrl+D) → fim de arquivo;
 *   - senão → "ainda não" (o PHP espera; aoEspera() avisa a interface).
 * opts: { texto: string|null, aoEco(linha), aoEspera() }
 */
export function criarEntrada(opts) {
  const enc = new TextEncoder();
  const fila = [];
  let atual = null, k = 0, eof = false, esperando = false;
  function adicionar(texto, digitada) {
    const partes = String(texto).split(/(?<=\n)/);
    for (const p of partes) if (p !== "") fila.push({ linha: p, digitada: !!digitada });
  }
  if (opts.texto !== null && opts.texto !== undefined) { adicionar(opts.texto, false); eof = true; }
  function input() {
    if (atual && k < atual.length) return atual[k++];
    if (atual) { atual = null; return undefined; } // fim da linha: termina esta leitura
    if (fila.length) {
      const it = fila.shift();
      atual = enc.encode(it.linha); k = 0; esperando = false;
      if (!it.digitada && opts.aoEco) opts.aoEco(it.linha);
      return atual[k++];
    }
    if (eof) return null;
    if (!esperando) { esperando = true; if (opts.aoEspera) opts.aoEspera(); }
    return undefined;
  }
  return {
    input,
    adicionar(texto) { adicionar(texto, true); },
    fim() { eof = true; },
  };
}
