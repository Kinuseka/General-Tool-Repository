/**
 * Save files from SharePoint / OneDrive shared links (viewer read, not download API).
 * Folder or direct file link; PDFs, videos, Office docs, images, etc.
 *
 * Usage:
 *   node scrape-shr.mjs "<share-or-viewer-url>"
 *   node scrape-shr.mjs --url "<url>" [--out dir] [--types pdf,mp4] [--segment|--no-segment]
 *     [--segment-threshold-mb 100] [--segment-threads 6] [--headless] [--verbose]
 *
 * Default: all file types with an extension. Use --types pdf,mp4 to filter.
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadSharePointStreamVideo } from "./stream-transcode.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROFILE_DIR = path.join(__dirname, ".browser-profile");
const AUTH_STATE_PATH = path.join(__dirname, "auth-state.json");

/** @type {{ inputUrl: string, spHost: string, mode: "file"|"folder"|"auto", folderPath: string|null, fileName: string|null, outDir: string, typesAll: boolean, typesSet: Set<string>|null, verbose: boolean, segmentMode: "auto"|"on"|"off", segmentThresholdBytes: number, segmentThreads: number }} */
let runCtx;

const MB = 1024 * 1024;
const DEFAULT_SEGMENT_THRESHOLD_MB = 100;
const DEFAULT_SEGMENT_THREADS = 6;

const VIDEO_EXT = new Set(["mp4", "mov", "mkv", "webm", "avi", "wmv", "m4v", "mpeg", "mpg"]);
const LARGE_MEDIA_EXT = new Set([...VIDEO_EXT, "mp3", "wav", "m4a", "flac", "zip", "rar", "7z", "iso"]);

/** @type {Map<string, { name: string, webUrl?: string, viewerUrl?: string, driveId?: string, itemId?: string, serverPath?: string, sizeBytes?: number, downloadUrl?: string, listItemUniqueId?: string }>} */
const itemsById = new Map();

/** @type {Promise<unknown>|null} */
let shareRootPromise = null;

function parseArgs(argv) {
  const flags = new Set();
  let url = null;
  let outDir = null;
  let types = null;
  let segmentThresholdMb = DEFAULT_SEGMENT_THRESHOLD_MB;
  let segmentThreads = DEFAULT_SEGMENT_THREADS;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      flags.add("help");
      continue;
    }
    if (a === "--headless" || a === "-headless") {
      flags.add("headless");
      continue;
    }
    if (a.startsWith("--headless=")) {
      const v = a.slice("--headless=".length).toLowerCase();
      if (v !== "0" && v !== "false" && v !== "no") flags.add("headless");
      continue;
    }
    if (a === "--url" && argv[i + 1]) {
      url = argv[++i];
      continue;
    }
    if (a === "--url-file" && argv[i + 1]) {
      flags.add("url-file");
      url = argv[++i];
      continue;
    }
    if (a === "--out" && argv[i + 1]) {
      outDir = argv[++i];
      continue;
    }
    if (a === "--types" && argv[i + 1]) {
      types = argv[++i];
      continue;
    }
    if (a === "--segment-threshold-mb" && argv[i + 1]) {
      segmentThresholdMb = Number(argv[++i]);
      continue;
    }
    if (a === "--segment-threads" && argv[i + 1]) {
      segmentThreads = Number(argv[++i]);
      continue;
    }
    if (a.startsWith("--")) {
      flags.add(a.slice(2));
      continue;
    }
    if (!url && /^https?:\/\//i.test(a)) url = a;
  }

  if (process.env.SCRAPE_SHR_HEADLESS === "1") flags.add("headless");

  let segmentMode = "auto";
  if (flags.has("no-segment")) segmentMode = "off";
  if (flags.has("segment")) segmentMode = "on";

  const typesAll = flags.has("all") || !types;
  const typesSet = typesAll
    ? null
    : new Set(
        types
          .split(",")
          .map((t) => t.trim().toLowerCase().replace(/^\./, ""))
          .filter(Boolean)
      );

  return {
    url,
    urlFromFile: flags.has("url-file"),
    outDir,
    typesAll,
    typesSet,
    showHelp: flags.has("help"),
    headless: flags.has("headless"),
    verbose: flags.has("verbose"),
    segmentMode,
    segmentThresholdMb,
    segmentThreads,
  };
}

function readUrlFromFile(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath), "utf8");
  const line = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  if (!line) throw new Error(`No URL in file: ${filePath}`);
  return line;
}

/** SharePoint stream.aspx links are often cut at the first & when the shell is not quoted. */
function isLikelyShellTruncatedSharePointUrl(url) {
  if (!url) return false;
  if (/stream\.aspx/i.test(url) && /\bid=/i.test(url) && !/referrer/i.test(url)) return true;
  if (
    /sharepoint\.com/i.test(url) &&
    /\?[^#]*=/.test(url) &&
    !url.includes("&") &&
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(url)
  ) {
    return /stream\.aspx|Doc\.aspx|WopiFrame/i.test(url);
  }
  return false;
}

function resolveInputUrl(cli) {
  let url = cli.url;
  if (cli.urlFromFile) {
    if (!url) {
      console.error("Missing path after --url-file");
      process.exit(1);
    }
    url = readUrlFromFile(url);
  }

  const envUrl = (process.env.SCRAPE_SHR_URL || "").trim();
  if (envUrl) {
    if (!url) {
      url = envUrl;
    } else if (isLikelyShellTruncatedSharePointUrl(url) && envUrl.length > url.length) {
      console.warn(
        "Note: CLI URL looked shell-truncated; using longer SCRAPE_SHR_URL from the environment."
      );
      url = envUrl;
    }
  }

  if (url && isLikelyShellTruncatedSharePointUrl(url)) {
    console.error(`
ERROR: The URL passed to the script looks truncated (common on Windows when & is not quoted).
CMD/PowerShell may run extra "commands" after the script exits, e.g.:
  'referrer' is not recognized as an internal or external command

Fix — use one of these (full stream.aspx URL with referrer=…):

  node scrape-shr.mjs --url-file url.txt
  (Put the entire URL on one line in url.txt)

  set SCRAPE_SHR_URL=<paste full URL here>
  node scrape-shr.mjs --verbose

  node scrape-shr.mjs "--url" "https://…stream.aspx?id=…&referrer=…&referrerScenario=…"

Received URL (${url.length} chars):
  ${url}
`);
    process.exit(1);
  }

  return url;
}

function printUsage() {
  console.log(`scrape-shr — save files from SharePoint / OneDrive shared links (viewer read)

Usage:
  node scrape-shr.mjs "<sharepoint-or-onedrive-url>"
  node scrape-shr.mjs --url "<url>" [options]
  node scrape-shr.mjs --url-file path.txt [options]

Options:
  -h, --help                 Show this help
  --url <url>                Share link or direct :b:/r/ viewer file URL
  --url-file <path>          Read URL from file (one line; # comments allowed) — best on Windows
  --out <dir>                Output directory (default: ~/Downloads/sharepoint-files/…)

  Environment:
  SCRAPE_SHR_URL             Full share URL if --url would contain & (avoids CMD splitting)

  --types <exts>             Comma-separated extensions (e.g. pdf,mp4,pptx)
  --all                      All files with an extension (default if --types omitted)

  --headless                 No window (uses auth-state.json; run once visibly first to sign in)
  --verbose                  Step timings, probe results, MiB/s per download part

  --segment                  Always use parallel HTTP Range downloads when supported
  --no-segment               Disable parallel ranges (single stream only)
  --segment-threshold-mb N   Auto-segment when size >= N MiB (default: 100)
  --segment-threads N        Parallel range requests (default: 6)

Windows (URLs with & — quote or use --url-file / SCRAPE_SHR_URL):
  node scrape-shr.mjs --url-file .\\share-url.txt --verbose
  set SCRAPE_SHR_URL=https://…/stream.aspx?id=…^&referrer=…^&referrerScenario=…
  node scrape-shr.mjs --verbose

Examples:
  node scrape-shr.mjs "https://tenant-my.sharepoint.com/shared?id=…"
  node scrape-shr.mjs --url "https://…/file.mp4?web=1" --types mp4 --headless
  node scrape-shr.mjs --url "https://…" --segment --segment-threads 8 --verbose
`);
}

function fileExtension(name) {
  const base = path.posix.basename(name || "");
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

function matchesFileFilter(name) {
  const ext = fileExtension(name);
  if (!ext) return false;
  if (runCtx.typesAll) return true;
  return runCtx.typesSet.has(ext);
}

function isFileServerPath(serverPath) {
  return !!fileExtension(path.posix.basename(serverPath || ""));
}

function captureTimeoutMs(item) {
  const ext = fileExtension(item.name);
  if (VIDEO_EXT.has(ext)) return 45000;
  if (LARGE_MEDIA_EXT.has(ext)) return 60000;
  return 120000;
}

function isMediaExt(ext) {
  return VIDEO_EXT.has(ext) || ["mp3", "wav", "m4a", "flac"].includes(ext);
}

function vlog(...args) {
  if (runCtx?.verbose) console.warn("[verbose]", ...args);
}

function formatMiB(bytes) {
  return `${(bytes / MB).toFixed(2)} MiB`;
}

function formatMbps(bytes, ms) {
  if (ms <= 0) return "?";
  const sec = ms / 1000;
  return `${((bytes / MB) / sec).toFixed(2)} MiB/s`;
}

async function timeStep(label, fn) {
  const t0 = Date.now();
  vlog(`→ ${label}…`);
  const result = await fn();
  vlog(`← ${label} (${Date.now() - t0} ms)`);
  return result;
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_");
}

/** Strip SharePoint :b:/r / :f:/r link prefixes to get /personal/… path. */
function normalizeServerPath(pathname) {
  let p = decodeURIComponent(pathname || "");
  p = p.replace(/^\/:b:\/r(?=\/)/, "").replace(/^\/:f:\/r(?=\/)/, "");
  if (!p.startsWith("/")) p = `/${p}`;
  return p.replace(/\/$/, "") || "/";
}

function classifyShareLink(inputUrl) {
  const u = new URL(inputUrl);
  const spHost = u.origin;

  const idParam = u.searchParams.get("id");
  if (idParam) {
    const serverPath = decodeURIComponent(idParam).replace(/\/$/, "");
    if (isFileServerPath(serverPath)) {
      return {
        inputUrl,
        spHost,
        mode: "file",
        folderPath: path.posix.dirname(serverPath),
        fileName: path.posix.basename(serverPath),
        serverPath,
      };
    }
    return {
      inputUrl,
      spHost,
      mode: "folder",
      folderPath: serverPath,
      fileName: null,
      serverPath,
    };
  }

  const serverPath = normalizeServerPath(u.pathname);
  if (isFileServerPath(serverPath)) {
    return {
      inputUrl,
      spHost,
      mode: "file",
      folderPath: path.posix.dirname(serverPath),
      fileName: path.posix.basename(serverPath),
      serverPath,
    };
  }

  const looksLikeFolder =
    u.pathname.includes("/shared") ||
    u.pathname.includes("/:f:/r/") ||
    u.searchParams.has("listurl") ||
    u.searchParams.has("FolderCTID") ||
    (serverPath !== "/" && !isFileServerPath(serverPath));

  if (looksLikeFolder) {
    return {
      inputUrl,
      spHost,
      mode: "folder",
      folderPath: serverPath !== "/" ? serverPath : null,
      fileName: null,
      serverPath: serverPath !== "/" ? serverPath : null,
    };
  }

  return {
    inputUrl,
    spHost,
    mode: "auto",
    folderPath: null,
    fileName: null,
    serverPath: null,
  };
}

function defaultOutDir(ctx) {
  const base = path.join(process.env.USERPROFILE || ".", "Downloads", "sharepoint-files");
  if (ctx.mode === "file" && ctx.fileName) {
    const stem = ctx.fileName.replace(/\.[^.]+$/, "");
    return path.join(base, sanitizeFilename(stem));
  }
  const leaf =
    ctx.folderPath?.split("/").filter(Boolean).pop() ||
    new URL(ctx.inputUrl).hostname.split(".")[0] ||
    "folder";
  return path.join(base, sanitizeFilename(leaf));
}

function applyViewerQueryParams(targetUrl, ...sources) {
  const out = new URL(targetUrl);
  out.searchParams.set("csf", "1");
  out.searchParams.set("web", "1");
  for (const src of sources) {
    if (!src) continue;
    try {
      const u = new URL(src);
      for (const key of ["d", "e"]) {
        if (u.searchParams.has(key)) out.searchParams.set(key, u.searchParams.get(key));
      }
    } catch {
      /* ignore */
    }
  }
  return out.toString();
}

function toSharePointViewerUrl(webUrl, ...paramSources) {
  if (!webUrl) return null;
  const u = new URL(webUrl);
  if (!u.pathname.includes("/:b:/r/")) {
    const p = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    u.pathname = `/:b:/r${p}`;
  }
  return applyViewerQueryParams(u.toString(), webUrl, ...paramSources);
}

function viewerUrlFromFileName(fileName, ...paramSources) {
  if (!runCtx.folderPath) return null;
  const pathPart = runCtx.folderPath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const filePart = encodeURIComponent(fileName);
  const base = `${runCtx.spHost}/:b:/r/${pathPart}/${filePart}`;
  return applyViewerQueryParams(base, runCtx.inputUrl, ...paramSources);
}

function buildViewerUrlCandidates(item, pageUrl) {
  const sources = [item.viewerUrl, item.webUrl, pageUrl, runCtx.inputUrl];
  const preferred = [];
  const secondary = [];
  const add = (u, bucket) => {
    if (!u || preferred.includes(u) || secondary.includes(u)) return;
    if (u.includes("stream.aspx") || u.includes("Doc.aspx") || u.includes("WopiFrame")) {
      secondary.push(u);
    } else {
      bucket.push(u);
    }
  };

  if (item.webUrl) add(toSharePointViewerUrl(item.webUrl, ...sources), preferred);
  add(viewerUrlFromFileName(item.name, ...sources), preferred);
  if (runCtx.mode === "file") {
    add(applyViewerQueryParams(runCtx.inputUrl, ...sources), preferred);
  }
  if (item.viewerUrl) add(applyViewerQueryParams(item.viewerUrl, ...sources), preferred);
  if (item.viewerUrl?.includes("stream.aspx")) {
    add(applyViewerQueryParams(item.viewerUrl, ...sources), secondary);
  }

  return [...preferred, ...secondary];
}

function buildDriveContentUrl(item) {
  if (!item?.driveId || !item?.itemId || !runCtx?.spHost) return null;
  return `${runCtx.spHost}/_api/v2.1/drives/${encodeURIComponent(item.driveId)}/items/${encodeURIComponent(item.itemId)}/content`;
}

function encodeShareId(url) {
  const b64 = Buffer.from(url, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
  return `u!${b64}`;
}

function serverPathFromWebUrl(webUrl) {
  try {
    return normalizeServerPath(new URL(webUrl).pathname);
  } catch {
    return null;
  }
}

function walkForDownloadUrls(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 12) return;
  if (Array.isArray(obj)) {
    for (const v of obj) walkForDownloadUrls(v, depth + 1);
    return;
  }
  if (obj.id && obj.name && (obj.file || obj.folder)) {
    const prev = itemsById.get(obj.id) || { name: obj.name };
    prev.name = obj.name;
    if (obj.webUrl) {
      prev.webUrl = obj.webUrl;
      prev.serverPath = serverPathFromWebUrl(obj.webUrl);
      if (obj.webUrl.includes("/:b:/r/") || obj.webUrl.includes("web=1")) {
        prev.viewerUrl = obj.webUrl;
      }
    }
    if (obj.parentReference?.driveId) prev.driveId = obj.parentReference.driveId;
    if (typeof obj.size === "number") prev.sizeBytes = obj.size;
    const graphDl = obj["@microsoft.graph.downloadUrl"];
    if (typeof graphDl === "string" && graphDl.startsWith("http")) prev.downloadUrl = graphDl;
    const uniqueId = obj.sharepointIds?.listItemUniqueId;
    if (uniqueId) prev.listItemUniqueId = uniqueId;
    prev.itemId = obj.id;
    itemsById.set(obj.id, prev);
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") walkForDownloadUrls(v, depth + 1);
  }
}

async function harvestViewerUrlsFromDom(page) {
  const filter = {
    typesAll: runCtx.typesAll,
    types: runCtx.typesSet ? [...runCtx.typesSet] : [],
  };

  const links = await page.evaluate(({ typesAll, types }) => {
    const typeSet = new Set(types);
    const matches = (name) => {
      const dot = name.lastIndexOf(".");
      if (dot <= 0) return false;
      const ext = name.slice(dot + 1).toLowerCase();
      return typesAll ? true : typeSet.has(ext);
    };

    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("a[href]")) {
      let href = el.href || el.getAttribute("href") || "";
      if (!href.includes("sharepoint.com") && !href.includes("1drv")) continue;
      if (!href.includes("/:b:/r/") && !/\.[a-z0-9]{2,8}(\?|#|$)/i.test(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      let name = "";
      try {
        name = decodeURIComponent(new URL(href, location.href).pathname.split("/").pop() || "");
      } catch {
        continue;
      }
      if (!matches(name)) continue;
      out.push({ name, viewerUrl: new URL(href, location.href).toString() });
    }
    return out;
  }, filter);

  for (const { name, viewerUrl } of links) {
    let matched = false;
    for (const item of itemsById.values()) {
      if (item.name === name) {
        item.viewerUrl = viewerUrl;
        matched = true;
      }
    }
    if (!matched) {
      itemsById.set(`dom-${name}`, { name, viewerUrl, itemId: name });
    }
  }
  if (runCtx.verbose && links.length) {
    console.log(`Harvested ${links.length} viewer link(s) from the page.`);
  }
}

async function saveAuth(context) {
  try {
    await context.storageState({ path: AUTH_STATE_PATH });
  } catch (e) {
    if (runCtx.verbose) console.warn("Could not save auth state:", e.message);
  }
}

async function waitForSessionReady(page, context) {
  if (page.url().includes("sharepoint.com") || page.url().includes("1drv")) {
    await saveAuth(context);
    return;
  }

  console.log("Sign in in the browser window (complete MFA / Stay signed in if asked)…");
  await page.waitForURL(/sharepoint\.com|1drv\.ms/i, {
    timeout: 600000,
    waitUntil: "domcontentloaded",
  });

  const stay = page.getByRole("button", { name: /yes|stay signed in/i });
  if (await stay.count()) {
    await stay.first().click({ timeout: 5000 }).catch(() => {});
  }

  await page.waitForTimeout(4000);
  await saveAuth(context);
  console.log("Login saved for next runs:", AUTH_STATE_PATH);
}

async function spFetchJson(page, url) {
  return page.evaluate(async (fetchUrl) => {
    try {
      const res = await fetch(fetchUrl, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return { ok: false, status: res.status, url: fetchUrl };
      return { ok: true, json: await res.json() };
    } catch (e) {
      return { ok: false, status: e.message, url: fetchUrl };
    }
  }, url);
}

const ITEM_SELECT =
  "id,name,size,file,folder,webUrl,parentReference,sharepointIds,@microsoft.graph.downloadUrl";

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listChildrenOnSharePoint(page, driveId, itemId) {
  const url = `${runCtx.spHost}/_api/v2.1/drives/${driveId}/items/${itemId}/children?$select=${encodeURIComponent(ITEM_SELECT)}&$top=200`;
  const result = await spFetchJson(page, url);
  return result.ok ? result.json : null;
}

async function resolveShareRoot(page) {
  const shareId = encodeShareId(runCtx.inputUrl);
  const urls = [
    `${runCtx.spHost}/_api/v2.1/shares/${shareId}/driveItem`,
    `${runCtx.spHost}/_api/v2.0/shares/${shareId}/driveItem`,
  ];
  for (const url of urls) {
    const result = await spFetchJson(page, url);
    if (!result.ok) continue;
    walkForDownloadUrls(result.json);
    const item = result.json;
    if (item?.id && item?.parentReference?.driveId) return item;
  }
  return null;
}

async function collectFromChildrenJson(json, page) {
  walkForDownloadUrls(json);
  for (const folder of (json.value || []).filter((x) => x.folder)) {
    const driveId = folder.parentReference?.driveId;
    if (!driveId) continue;
    let jsonPage = await listChildrenOnSharePoint(page, driveId, folder.id);
    while (jsonPage) {
      await collectFromChildrenJson(jsonPage, page);
      if (!jsonPage["@odata.nextLink"]) break;
      const next = await spFetchJson(page, jsonPage["@odata.nextLink"]);
      jsonPage = next.ok ? next.json : null;
    }
  }
}

function isGraphItemId(id) {
  return typeof id === "string" && GUID_RE.test(id);
}

function driveRelativePathFromServer(serverPath) {
  const p = normalizeServerPath(serverPath || "");
  const personal = p.match(/^\/personal\/[^/]+\/(.+)$/i);
  if (personal) return personal[1];
  const sites = p.match(/^\/sites\/[^/]+\/(.+)$/i);
  if (sites) return sites[1];
  return p.replace(/^\//, "");
}

function inferServerRelativePath(item) {
  if (item.serverPath) return normalizeServerPath(item.serverPath);
  if (item.webUrl) return serverPathFromWebUrl(item.webUrl);
  if (runCtx.folderPath && item.name) {
    return normalizeServerPath(`${runCtx.folderPath}/${item.name}`);
  }
  if (item.viewerUrl) {
    try {
      return normalizeServerPath(new URL(item.viewerUrl).pathname);
    } catch {
      /* ignore */
    }
  }
  return null;
}

function findApiItemByName(fileName) {
  for (const it of itemsById.values()) {
    if (it.name === fileName && it.driveId && isGraphItemId(it.itemId)) return it;
  }
  return null;
}

async function getShareRoot(page) {
  if (!shareRootPromise) {
    shareRootPromise = resolveShareRoot(page);
  }
  return shareRootPromise;
}

async function fetchDriveItemByRelativePath(page, driveId, relativePath) {
  if (!driveId || !relativePath) return null;
  const pathEnc = relativePath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const url = `${runCtx.spHost}/_api/v2.1/drives/${encodeURIComponent(driveId)}/root:/${pathEnc}:?$select=${encodeURIComponent(ITEM_SELECT)}`;
  vlog(`Graph path lookup: ${relativePath}`);
  const result = await spFetchJson(page, url);
  if (!result.ok) {
    vlog(`Graph path lookup failed: ${result.status}`);
    return null;
  }
  walkForDownloadUrls(result.json);
  return result.json;
}

async function findDriveItemByNameInTree(page, driveId, folderId, fileName, depth = 0) {
  if (!driveId || !folderId || depth > 10) return null;
  let jsonPage = await listChildrenOnSharePoint(page, driveId, folderId);
  while (jsonPage) {
    for (const ch of jsonPage.value || []) {
      if (ch.file && ch.name === fileName) {
        walkForDownloadUrls(ch);
        return ch;
      }
    }
    for (const ch of jsonPage.value || []) {
      if (ch.folder) {
        const hit = await findDriveItemByNameInTree(page, driveId, ch.id, fileName, depth + 1);
        if (hit) return hit;
      }
    }
    if (!jsonPage["@odata.nextLink"]) break;
    const next = await spFetchJson(page, jsonPage["@odata.nextLink"]);
    jsonPage = next.ok ? next.json : null;
  }
  return null;
}

async function downloadViaInPageFetch(page, url, destPath, ext, maxBytes = 200 * MB) {
  vlog(`in-page fetch (browser session): ${url.slice(0, 90)}…`);
  const result = await page.evaluate(
    async ({ fetchUrl, max }) => {
      try {
        const res = await fetch(fetchUrl, { credentials: "include", redirect: "follow" });
        if (!res.ok) return { ok: false, status: res.status };
        const cl = parseInt(res.headers.get("content-length") || "0", 10);
        if (cl > max) return { ok: false, status: `too-large-${cl}` };
        const ab = await res.arrayBuffer();
        if (ab.byteLength > max) return { ok: false, status: `too-large-${ab.byteLength}` };
        const bytes = new Uint8Array(ab);
        const chunk = 0x8000;
        const parts = [];
        for (let i = 0; i < bytes.length; i += chunk) {
          parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
        }
        return { ok: true, b64: btoa(parts.join("")), len: ab.byteLength };
      } catch (e) {
        return { ok: false, status: e.message || "fetch failed" };
      }
    },
    { fetchUrl: url, max: maxBytes }
  );
  if (!result?.ok || !result.b64) {
    vlog(`in-page fetch failed: ${result?.status ?? "unknown"}`);
    return false;
  }
  const buf = Buffer.from(result.b64, "base64");
  if (!bufferMatchesExtension(buf, ext)) {
    vlog(`in-page fetch rejected (${buf.length} bytes, not valid ${ext})`);
    return false;
  }
  fs.writeFileSync(destPath, buf);
  vlog(`in-page fetch saved ${formatMiB(buf.length)}`);
  return true;
}

async function resolveItemForDownload(page, item) {
  let merged = { ...item };
  const byName = findApiItemByName(item.name);
  if (byName) merged = { ...merged, ...byName };

  if (!merged.driveId || !isGraphItemId(merged.itemId)) {
    const root = await getShareRoot(page);
    const driveId = root?.parentReference?.driveId;
    const serverPath = inferServerRelativePath(merged);
    if (driveId && serverPath) {
      const rel = driveRelativePathFromServer(serverPath);
      const graphItem = await fetchDriveItemByRelativePath(page, driveId, rel);
      if (graphItem?.id) {
        merged = {
          ...merged,
          name: graphItem.name || merged.name,
          itemId: graphItem.id,
          driveId: graphItem.parentReference?.driveId || driveId,
          sizeBytes: graphItem.size ?? merged.sizeBytes,
          webUrl: graphItem.webUrl || merged.webUrl,
          serverPath,
          downloadUrl: graphItem["@microsoft.graph.downloadUrl"] || merged.downloadUrl,
          listItemUniqueId: graphItem.sharepointIds?.listItemUniqueId || merged.listItemUniqueId,
        };
        itemsById.set(graphItem.id, merged);
      } else if (root?.id && driveId) {
        vlog(`Graph path miss; searching folder tree for "${item.name}"…`);
        const found = await findDriveItemByNameInTree(page, driveId, root.id, item.name);
        if (found?.id) {
          merged = {
            ...merged,
            name: found.name,
            itemId: found.id,
            driveId: found.parentReference?.driveId || driveId,
            sizeBytes: found.size ?? merged.sizeBytes,
            webUrl: found.webUrl || merged.webUrl,
            serverPath: found.webUrl ? serverPathFromWebUrl(found.webUrl) : serverPath,
            downloadUrl: found["@microsoft.graph.downloadUrl"] || merged.downloadUrl,
            listItemUniqueId: found.sharepointIds?.listItemUniqueId || merged.listItemUniqueId,
          };
          itemsById.set(found.id, merged);
        }
      }
    }
  }

  if (merged.driveId && isGraphItemId(merged.itemId)) {
    const enriched = await enrichItem(page, merged);
    return enriched;
  }

  vlog(
    `resolve item: driveId=${merged.driveId ? "yes" : "no"} itemId=${isGraphItemId(merged.itemId) ? merged.itemId.slice(0, 8) + "…" : merged.itemId || "?"} downloadUrl=${merged.downloadUrl ? "yes" : "no"}`
  );
  return merged;
}

async function enrichItem(page, item) {
  if (!item.driveId || !isGraphItemId(item.itemId)) return item;
  const metaUrl = `${runCtx.spHost}/_api/v2.1/drives/${item.driveId}/items/${item.itemId}?$select=${encodeURIComponent(ITEM_SELECT)}`;
  const result = await spFetchJson(page, metaUrl);
  if (!result.ok) return item;
  walkForDownloadUrls(result.json);
  const fromMap = itemsById.get(item.itemId);
  return fromMap ? { ...item, ...fromMap } : item;
}

function buildStreamAspxUrl(item) {
  const serverPath = inferServerRelativePath(item) || runCtx.serverPath;
  const personal = serverPath?.match(/^\/personal\/([^/]+)/i);
  if (!personal || !runCtx.spHost) return null;
  // Stream viewer accepts server-relative path in `id=` (same as address bar link).
  const idParam =
    serverPath ||
    (item.listItemUniqueId ? item.listItemUniqueId : isGraphItemId(item.itemId) ? item.itemId : null);
  if (!idParam) return null;
  try {
    const u = new URL(`${runCtx.spHost}/personal/${personal[1]}/_layouts/15/stream.aspx`);
    u.searchParams.set("id", idParam.startsWith("/") ? idParam : `/${idParam}`);
    return u.toString();
  } catch {
    return null;
  }
}

async function downloadViaSpRestFileValue(requestContext, serverRelativePath, destPath, ext, referer) {
  if (!serverRelativePath?.startsWith("/")) return false;
  const escaped = serverRelativePath.replace(/'/g, "''");
  const url = `${runCtx.spHost}/_api/web/GetFileByServerRelativeUrl('${escaped}')/$value`;
  vlog(`SP REST $value ${serverRelativePath.slice(0, 80)}…`);
  return downloadSingleStream(requestContext, url, destPath, referer, ext);
}

async function trySharePointNativeDownload(page, requestContext, item, destPath, ext, referer) {
  const urls = [];
  if (item.downloadUrl) urls.push({ url: item.downloadUrl, label: "Graph downloadUrl", size: item.sizeBytes });
  const contentUrl = buildDriveContentUrl(item);
  if (contentUrl) urls.push({ url: contentUrl, label: "Graph /content", size: item.sizeBytes });

  for (const { url, label, size } of urls) {
    vlog(`try ${label}`);
    if (size && shouldUseSegmentation(size, ext)) {
      if (await trySegmentedDownload(requestContext, url, destPath, ext, referer, size)) {
        return { ok: true, via: `segmented parallel (${label})` };
      }
    }
    if (await downloadSingleStream(requestContext, url, destPath, referer, ext)) {
      return { ok: true, via: label };
    }
    if (await downloadViaInPageFetch(page, url, destPath, ext, item.sizeBytes || 200 * MB)) {
      return { ok: true, via: `${label} (in-page fetch)` };
    }
  }

  const serverPath = inferServerRelativePath(item);
  if (serverPath) {
    if (
      await timeStep("SP REST GetFileByServerRelativeUrl", () =>
        downloadViaSpRestFileValue(requestContext, serverPath, destPath, ext, referer)
      )
    ) {
      return { ok: true, via: "SharePoint REST $value" };
    }
  }

  let streamUrl = buildStreamAspxUrl(item);
  if (!streamUrl && item.viewerUrl?.includes("stream.aspx")) {
    streamUrl = item.viewerUrl;
  }
  if (streamUrl) {
    const ui = await tryPlaywrightBrowserDownload(page, streamUrl, destPath, ext);
    if (ui.ok) return ui;
  }

  return { ok: false };
}

async function tryPlaywrightBrowserDownload(page, openUrl, destPath, ext) {
  vlog(`try browser Download UI: ${openUrl.slice(0, 90)}…`);
  const dlPage = await page.context().newPage();
  try {
    await dlPage.goto(openUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await dlPage.waitForTimeout(3000);
    await triggerVideoPlayback(dlPage);

    const selectors = [
      dlPage.getByRole("button", { name: /^download$/i }),
      dlPage.getByRole("menuitem", { name: /^download$/i }),
      dlPage.locator('[data-automationid="downloadCommand"]'),
      dlPage.locator('button[name="Download"]'),
    ];

    for (const loc of selectors) {
      if (!(await loc.count())) continue;
      try {
        const [download] = await Promise.all([
          dlPage.waitForEvent("download", { timeout: 90000 }),
          loc.first().click({ timeout: 8000 }),
        ]);
        const tmp = destPath + ".part";
        await download.saveAs(tmp);
        if (validateSavedFile(tmp, ext)) {
          fs.renameSync(tmp, destPath);
          vlog(`browser Download saved ${formatMiB(fs.statSync(destPath).size)}`);
          return { ok: true, via: "browser Download button" };
        }
        fs.unlinkSync(tmp);
      } catch (e) {
        vlog(`Download UI attempt: ${e.message}`);
      }
    }

    const more = dlPage.getByRole("button", { name: /more|actions|\.\.\./i });
    if (await more.count()) {
      await more.first().click({ timeout: 5000 }).catch(() => {});
      await dlPage.waitForTimeout(800);
      const menuDl = dlPage.getByRole("menuitem", { name: /^download$/i });
      if (await menuDl.count()) {
        try {
          const [download] = await Promise.all([
            dlPage.waitForEvent("download", { timeout: 90000 }),
            menuDl.first().click(),
          ]);
          const tmp = destPath + ".part";
          await download.saveAs(tmp);
          if (validateSavedFile(tmp, ext)) {
            fs.renameSync(tmp, destPath);
            return { ok: true, via: "browser Download menu" };
          }
          fs.unlinkSync(tmp);
        } catch (e) {
          vlog(`Download menu: ${e.message}`);
        }
      }
    }
  } finally {
    await dlPage.close().catch(() => {});
  }
  return { ok: false };
}

async function refineModeFromApi(page) {
  if (runCtx.mode !== "auto") return;

  const root = await resolveShareRoot(page);
  if (!root) return;

  if (root.file) {
    runCtx.mode = "file";
    runCtx.fileName = root.name;
    runCtx.serverPath = root.webUrl ? serverPathFromWebUrl(root.webUrl) : runCtx.serverPath;
    runCtx.folderPath = runCtx.serverPath
      ? path.posix.dirname(runCtx.serverPath)
      : runCtx.folderPath;
    itemsById.set(root.id, {
      name: root.name,
      webUrl: root.webUrl,
      itemId: root.id,
      driveId: root.parentReference?.driveId,
      viewerUrl: runCtx.inputUrl,
    });
    console.log("Detected: single file (via SharePoint API).");
    return;
  }

  if (root.folder) {
    runCtx.mode = "folder";
    if (!runCtx.folderPath && root.webUrl) {
      runCtx.folderPath = serverPathFromWebUrl(root.webUrl);
    }
    console.log("Detected: folder (via SharePoint API).");
  }
}

function singleFileItemFromContext() {
  const name = runCtx.fileName || path.posix.basename(runCtx.serverPath || "file.bin");
  return {
    name,
    viewerUrl: runCtx.inputUrl,
    webUrl: runCtx.inputUrl,
    itemId: `file-${name}`,
    serverPath: runCtx.serverPath,
  };
}

function pickStreamPageUrl(item) {
  if (runCtx.inputUrl?.includes("stream.aspx")) return runCtx.inputUrl;
  if (item.viewerUrl?.includes("stream.aspx")) return item.viewerUrl;
  return buildStreamAspxUrl(item);
}

function filterWantedItems(items) {
  return items.filter((x) => x.name && matchesFileFilter(x.name));
}

async function collectFileItems(page) {
  itemsById.clear();

  if (runCtx.mode === "file") {
    const item = singleFileItemFromContext();
    itemsById.set(item.itemId, item);
    return [item];
  }

  await harvestViewerUrlsFromDom(page);

  let fileItems = filterWantedItems([...itemsById.values()]);

  if (fileItems.length === 0) {
    console.log("Listing folder via SharePoint API…");
    const root = await resolveShareRoot(page);
    if (root?.parentReference?.driveId) {
      if (!runCtx.folderPath && root.webUrl) {
        runCtx.folderPath = serverPathFromWebUrl(root.webUrl);
      }
      let jsonPage = await listChildrenOnSharePoint(page, root.parentReference.driveId, root.id);
      while (jsonPage) {
        await collectFromChildrenJson(jsonPage, page);
        if (!jsonPage["@odata.nextLink"]) break;
        const next = await spFetchJson(page, jsonPage["@odata.nextLink"]);
        jsonPage = next.ok ? next.json : null;
      }
      fileItems = filterWantedItems([...itemsById.values()]);
    }
  }

  await harvestViewerUrlsFromDom(page);
  return filterWantedItems([...itemsById.values()]);
}

function looksLikeHtml(buf) {
  if (!buf || buf.length < 8) return false;
  const head = buf.slice(0, 80).toString("utf8").trimStart();
  return head.startsWith("<!") || head.startsWith("<html") || head.startsWith('{"');
}

function bufferMatchesExtension(buf, ext) {
  if (!buf || buf.length < 4) return false;
  ext = (ext || "").toLowerCase();
  if (ext === "pdf") return buf.slice(0, 5).toString("utf8") === "%PDF-";
  if (["docx", "pptx", "xlsx", "zip"].includes(ext)) {
    return buf[0] === 0x50 && buf[1] === 0x4b;
  }
  if (["doc", "ppt", "xls"].includes(ext)) {
    return buf[0] === 0xd0 && buf[1] === 0xcf;
  }
  if (VIDEO_EXT.has(ext) || ext === "m4v") {
    if (buf.length < 12) return false;
    const box = buf.slice(4, 8).toString("ascii");
    return box === "ftyp" || buf.slice(0, 4).toString("ascii") === "ftyp";
  }
  if (ext === "webm") return buf[0] === 0x1a && buf[1] === 0x45;
  if (ext === "png") return buf[0] === 0x89 && buf[1] === 0x50;
  if (["jpg", "jpeg"].includes(ext)) return buf[0] === 0xff && buf[1] === 0xd8;
  if (ext === "gif") return buf.slice(0, 3).toString("utf8") === "GIF";
  if (ext === "webp") {
    return buf.slice(0, 4).toString("utf8") === "RIFF" && buf.slice(8, 12).toString("utf8") === "WEBP";
  }
  if (looksLikeHtml(buf)) return false;
  return buf.length > 200;
}

function isLikelyMediaStreamUrl(url, contentType = "", expectedExt = "") {
  const u = (url || "").toLowerCase();
  const ct = (contentType || "").toLowerCase();
  if (!u || u.startsWith("blob:") || u.startsWith("data:")) return false;
  if (ct.includes("text/html") || ct.includes("text/plain") || ct.includes("javascript") || ct.includes("json")) {
    return false;
  }
  if (
    u.includes("/:b:/r/") ||
    u.includes("stream.aspx") ||
    u.includes("webshell.suite.office.com") ||
    u.includes("tokenfactoryiframe")
  ) {
    return false;
  }
  if (/\/transform\//.test(u) || u.includes("thumbnail") || u.includes("getpreviewimage")) return false;
  if (ct.includes("video") || ct.includes("audio")) return true;
  if (ct.includes("octet-stream") && (u.includes("azureedge") || u.includes("blob.core.windows.net"))) return true;
  if (expectedExt && u.includes(`.${expectedExt.toLowerCase()}`)) return true;
  return (
    u.includes("videostream") ||
    u.includes("videoprocessor") ||
    u.includes("videostreamhandler") ||
    (u.includes("/items/") && u.includes("/content")) ||
    u.includes("1drv.com") ||
    u.includes("1drv.ms") ||
    u.includes("download.aspx") ||
    u.includes("azureedge.net") ||
    /\.(mp4|mov|webm|mkv|m4v)(\?|$|&)/.test(u)
  );
}

function shouldInspectResponse(response, expectedExt) {
  const u = response.url().toLowerCase();
  const ct = (response.headers()["content-type"] || "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("javascript") || ct.includes("json")) return false;
  if (isLikelyMediaStreamUrl(u, ct, expectedExt)) return true;
  if (ct.includes("pdf") || ct.includes("octet-stream")) return true;
  if (expectedExt && u.includes(`.${expectedExt.toLowerCase()}`)) return true;
  return (
    u.includes("preview") ||
    u.includes("wopi") ||
    u.includes("1drv") ||
    u.includes("getpreview") ||
    /\.(mp4|mov|webm|mkv|pdf|pptx|docx)(\?|$)/.test(u)
  );
}

async function ensureViewerPage(context, holder) {
  if (holder.page && !holder.page.isClosed()) return holder.page;
  holder.page = await context.newPage();
  return holder.page;
}

function shouldUseSegmentation(sizeBytes, ext = "") {
  if (runCtx.segmentMode === "off") return false;
  if (runCtx.segmentMode === "on") return sizeBytes > 0;
  if (isMediaExt(ext) || VIDEO_EXT.has(ext)) return sizeBytes >= 4 * MB;
  return sizeBytes >= runCtx.segmentThresholdBytes;
}

function effectiveSegmentThreads(totalSize, maxThreads, ext = "") {
  const minChunk = isMediaExt(ext) ? 5 * MB : 2 * MB;
  const cap = isMediaExt(ext) ? Math.max(maxThreads, 10) : maxThreads;
  const bySize = Math.max(1, Math.floor(totalSize / minChunk));
  return Math.min(Math.max(1, cap), bySize);
}

function validateSavedFile(destPath, ext) {
  try {
    const fd = fs.openSync(destPath, "r");
    const head = Buffer.alloc(64);
    fs.readSync(fd, head, 0, 64, 0);
    fs.closeSync(fd);
    return bufferMatchesExtension(head, ext);
  } catch {
    return false;
  }
}

async function probeResourceSize(apiRequest, url, referer) {
  const headers = referer ? { Referer: referer } : {};
  try {
    const head = await apiRequest.head(url, {
      headers,
      failOnStatusCode: false,
      timeout: 120000,
    });
    vlog(`probe HEAD ${head.status()} ${url.slice(0, 90)}…`);
    if (head.ok()) {
      const size = parseInt(head.headers()["content-length"] || "0", 10);
      const acceptRanges = (head.headers()["accept-ranges"] || "")
        .toLowerCase()
        .includes("bytes");
      const ct = head.headers()["content-type"] || "";
      if (size > 0) {
        vlog(`probe HEAD size=${formatMiB(size)} ranges=${acceptRanges} ct=${ct}`);
        return { size, acceptRanges, url, contentType: ct };
      }
      vlog(`probe HEAD missing Content-Length (ct=${ct}) — likely HTML viewer, not raw file`);
    }
  } catch (e) {
    vlog(`probe HEAD error: ${e.message}`);
  }

  try {
    const res = await apiRequest.get(url, {
      headers: { ...headers, Range: "bytes=0-0" },
      failOnStatusCode: false,
      timeout: 120000,
    });
    const cr = res.headers()["content-range"] || "";
    const match = cr.match(/\/(\d+)\s*$/);
    const size = match ? parseInt(match[1], 10) : parseInt(res.headers()["content-length"] || "0", 10);
    const acceptRanges = res.status() === 206 || Boolean(match);
    vlog(`probe RANGE ${res.status()} size=${size ? formatMiB(size) : "?"} ranges=${acceptRanges}`);
    if (size > 0) {
      return {
        size,
        acceptRanges,
        url: res.url() || url,
        contentType: res.headers()["content-type"] || "",
      };
    }
  } catch (e) {
    vlog(`probe RANGE error: ${e.message}`);
  }
  return null;
}

async function downloadSegmentedParallel(apiRequest, url, destPath, totalSize, threads, referer, ext = "") {
  const n = effectiveSegmentThreads(totalSize, threads, ext);
  const chunkSize = Math.ceil(totalSize / n);
  const refererHeaders = referer ? { Referer: referer } : {};
  const t0 = Date.now();

  vlog(
    `segmented download: ${n} parts, ${formatMiB(totalSize)} total, ~${formatMiB(chunkSize)}/part`
  );

  try {
    const parts = await Promise.all(
      Array.from({ length: n }, async (_, i) => {
        const start = i * chunkSize;
        const end = Math.min(totalSize - 1, start + chunkSize - 1);
        const pt0 = Date.now();
        const res = await apiRequest.get(url, {
          headers: { ...refererHeaders, Range: `bytes=${start}-${end}` },
          failOnStatusCode: false,
          timeout: 600000,
        });
        if (res.status() !== 206 && res.status() !== 200) {
          throw new Error(`part ${i + 1}/${n} HTTP ${res.status()}`);
        }
        const buf = await res.body();
        vlog(
          `  part ${i + 1}/${n} ${formatMiB(buf.length)} in ${Date.now() - pt0} ms (${formatMbps(buf.length, Date.now() - pt0)})`
        );
        return { start, buf };
      })
    );

    const fd = fs.openSync(destPath, "w");
    try {
      for (const { start, buf } of parts) {
        fs.writeSync(fd, buf, 0, buf.length, start);
      }
    } finally {
      fs.closeSync(fd);
    }
    vlog(`segmented complete: ${formatMiB(totalSize)} in ${Date.now() - t0} ms (${formatMbps(totalSize, Date.now() - t0)})`);
    return true;
  } catch (e) {
    vlog(`segmented download failed: ${e.message}`);
    try {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    } catch {
      /* ignore */
    }
    return false;
  }
}

async function downloadSingleStream(apiRequest, url, destPath, referer, ext) {
  const t0 = Date.now();
  vlog(`single-stream GET ${url.slice(0, 100)}…`);
  try {
    const res = await apiRequest.get(url, {
      headers: referer ? { Referer: referer } : {},
      failOnStatusCode: false,
      timeout: 600000,
    });
    if (!res.ok()) {
      vlog(`single-stream HTTP ${res.status()}`);
      return false;
    }
    const buf = await res.body();
    if (looksLikeHtml(buf) || !bufferMatchesExtension(buf, ext)) {
      vlog(`single-stream rejected (${buf.length} bytes, not valid ${ext})`);
      return false;
    }
    fs.writeFileSync(destPath, buf);
    vlog(`single-stream done: ${formatMiB(buf.length)} in ${Date.now() - t0} ms (${formatMbps(buf.length, Date.now() - t0)})`);
    return true;
  } catch (e) {
    vlog(`single-stream error: ${e.message}`);
    return false;
  }
}

async function tryDownloadFromMediaUrls(apiRequest, urls, destPath, ext, referer, label = "media URL") {
  const seen = new Set();
  for (const raw of urls) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    vlog(`${label}: ${raw.slice(0, 100)}…`);
    if (
      await timeStep(`segment (${label})`, () =>
        trySegmentedDownload(apiRequest, raw, destPath, ext, referer)
      )
    ) {
      return { ok: true, via: `segmented parallel (${label})` };
    }
    if (
      await timeStep(`single-stream (${label})`, () =>
        downloadSingleStream(apiRequest, raw, destPath, referer, ext)
      )
    ) {
      return { ok: true, via: `single stream (${label})` };
    }
  }
  return { ok: false };
}

async function trySegmentedDownload(apiRequest, url, destPath, ext, referer, knownSize = 0) {
  if (runCtx.segmentMode === "off") {
    vlog("segment skipped: --no-segment");
    return false;
  }

  const probe =
    knownSize > 0
      ? { size: knownSize, acceptRanges: true, url }
      : await probeResourceSize(apiRequest, url, referer);
  if (!probe || probe.size <= 0) {
    vlog("segment skipped: could not determine file size (viewer URL may not be direct media)");
    return false;
  }
  if (!shouldUseSegmentation(probe.size, ext)) {
    vlog(
      `segment skipped: size ${formatMiB(probe.size)} below threshold for .${ext} (mode=${runCtx.segmentMode})`
    );
    return false;
  }

  const targetUrl = probe.url || url;
  if (probe.contentType?.includes("text/html")) {
    vlog("segment skipped: probe returned HTML, not media — need stream URL from viewer");
    return false;
  }

  if (!probe.acceptRanges) {
    vlog("Accept-Ranges not advertised; trying parallel ranges anyway");
  }

  const ok = await downloadSegmentedParallel(
    apiRequest,
    targetUrl,
    destPath,
    probe.size,
    runCtx.segmentThreads,
    referer,
    ext
  );
  if (ok && validateSavedFile(destPath, ext)) return true;
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  vlog("segment failed validation or HTTP ranges unsupported");
  return false;
}

/**
 * @returns {{ ok: boolean, segment?: { url: string, size: number }, mediaUrls?: string[], partial?: boolean, buffer?: Buffer }}
 */
async function captureFileWhileViewing(context, openFn, expectedExt, timeoutMs = 120000) {
  let best = null;
  let bestExpectedSize = 0;
  let segmentHint = null;
  const isVideo = VIDEO_EXT.has(expectedExt);
  /** @type {Map<string, { contentType: string, contentLength: number }>} */
  const mediaUrls = new Map();
  let responseCount = 0;
  const started = Date.now();
  let lastProgressLog = started;
  const mediaEarlyExitMs = isVideo ? 12000 : 8000;
  const maxBufferBytes = isVideo ? 12 * MB : 25 * MB;

  const noteMediaUrl = (url, ct, cl) => {
    if (!isLikelyMediaStreamUrl(url, ct, expectedExt)) return;
    const prev = mediaUrls.get(url);
    if (!prev || cl > prev.contentLength) {
      mediaUrls.set(url, { contentType: ct, contentLength: cl });
      vlog(`media URL tracked: cl=${cl ? formatMiB(cl) : "?"} ct=${ct} ${url.slice(0, 90)}…`);
    }
  };

  const handler = async (response) => {
    try {
      if (response.status() < 200 || response.status() >= 400) return;
      const url = response.url();
      const ct = response.headers()["content-type"] || "";
      if (!shouldInspectResponse(response, expectedExt) && !isLikelyMediaStreamUrl(url, ct, expectedExt)) {
        return;
      }
      responseCount++;

      const cl = parseInt(response.headers()["content-length"] || "0", 10);
      if (isVideo && (ct.includes("video") || ct.includes("audio") || isLikelyMediaStreamUrl(url, ct, expectedExt))) {
        if (cl === 0 || cl > maxBufferBytes) {
          noteMediaUrl(url, ct, cl);
          return;
        }
      }

      if (cl > 0 && shouldUseSegmentation(cl, expectedExt) && runCtx.segmentMode !== "off") {
        if (!segmentHint || cl > segmentHint.size) {
          segmentHint = { url, size: cl, contentType: ct };
          vlog(`stream candidate: ${formatMiB(cl)} ct=${ct} ${url.slice(0, 90)}…`);
        }
        return;
      }

      if (isVideo && cl > 500 * MB) {
        noteMediaUrl(url, ct, cl);
        vlog(`skip buffering large video body in memory (${formatMiB(cl)}); use URL probe`);
        return;
      }

      if (isVideo && cl === 0) {
        noteMediaUrl(url, ct, cl);
        return;
      }

      const buf = await response.body();
      if (looksLikeHtml(buf)) return;
      if (!bufferMatchesExtension(buf, expectedExt)) return;
      if (!best || buf.length > best.length) {
        best = buf;
        bestExpectedSize = cl;
      }
    } catch {
      /* ignore */
    }
  };

  context.on("response", handler);
  try {
    await openFn();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (segmentHint) break;
      if (mediaUrls.size > 0 && Date.now() - started >= mediaEarlyExitMs) {
        vlog(
          `early exit: ${mediaUrls.size} media URL(s) after ${Date.now() - started} ms (will probe, not buffer stream)`
        );
        break;
      }
      if (best && !isVideo && best.length > 2000) break;
      if (best && isVideo && bestExpectedSize > 0 && best.length >= bestExpectedSize) break;
      if (runCtx.verbose && Date.now() - lastProgressLog >= 4000) {
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        vlog(
          `waiting for stream… ${left}s left, responses=${responseCount}, mediaUrls=${mediaUrls.size}, segment=${segmentHint ? "yes" : "no"}, best=${best ? formatMiB(best.length) : "0"}`
        );
        lastProgressLog = Date.now();
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (segmentHint) return { ok: false, segment: segmentHint, mediaUrls: [...mediaUrls.keys()] };
    if (mediaUrls.size > 0) {
      return { ok: false, mediaUrls: [...mediaUrls.keys()] };
    }
    if (best && best.length > 200) {
      if (isVideo && bestExpectedSize > 0 && best.length < bestExpectedSize) {
        vlog(
          `partial video buffer ${formatMiB(best.length)} / ${formatMiB(bestExpectedSize)} — not saving`
        );
        return { ok: false, partial: true };
      }
      if (isVideo && bestExpectedSize === 0) {
        vlog(`video buffer ${formatMiB(best.length)} without Content-Length — not saving (use segment URL)`);
        return { ok: false, partial: true };
      }
      return { ok: true, buffer: best };
    }
  } catch (e) {
    vlog(`viewer open error: ${e.message}`);
  } finally {
    context.off("response", handler);
  }
  return { ok: false, mediaUrls: mediaUrls.size ? [...mediaUrls.keys()] : undefined };
}

function bufferFromEvaluateB64(result, ext) {
  if (!result?.ok || !result.b64) return null;
  const buf = Buffer.from(result.b64, "base64");
  return bufferMatchesExtension(buf, ext) ? buf : null;
}

async function fetchBinaryViaViewerUrl(page, viewerUrl, ext) {
  if (LARGE_MEDIA_EXT.has(ext)) return null;

  const result = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url, {
        credentials: "include",
        redirect: "follow",
        headers: { Accept: "*/*" },
      });
      if (!res.ok) return { ok: false, status: res.status };
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 25 * 1024 * 1024) {
        return { ok: false, status: "too-large-for-inline-fetch" };
      }
      const bytes = new Uint8Array(ab);
      if (bytes.length < 4) return { ok: false, status: "empty" };
      const chunk = 0x8000;
      const parts = [];
      for (let i = 0; i < bytes.length; i += chunk) {
        parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
      }
      return { ok: true, b64: btoa(parts.join("")) };
    } catch (e) {
      return { ok: false, status: e.message || "fetch error" };
    }
  }, viewerUrl);
  return bufferFromEvaluateB64(result, ext);
}

function filterEmbedUrls(urls) {
  return urls.filter((u) => {
    const l = (u || "").toLowerCase();
    if (!l.startsWith("http")) return false;
    if (l.includes("webshell.suite.office.com") || l.includes("tokenfactoryiframe")) return false;
    if (l.includes("/:b:/r/") || l.includes("stream.aspx")) return false;
    return true;
  });
}

async function extractEmbedMediaUrls(viewerPage, ext) {
  const raw = await viewerPage.evaluate((expectedExt) => {
    const urls = [];
    const add = (u) => {
      if (u && typeof u === "string" && !u.startsWith("blob:") && !urls.includes(u)) urls.push(u);
    };
    for (const el of document.querySelectorAll("iframe, embed, object, video, audio, source")) {
      add(el.src || el.getAttribute("data-src"));
      if (el.currentSrc) add(el.currentSrc);
    }
    const html = document.documentElement?.innerHTML || "";
    const patterns = [
      new RegExp(`https:[^"'\\\\s]+\\.${expectedExt}[^"'\\\\s]*`, "gi"),
      /https:\\\\u002f\\\\u002f[^"'\\s]+/gi,
      /https:\/\/[^"'\\s]+(?:videostream|videoprocessor|\/content)[^"'\\s]*/gi,
    ];
    for (const re of patterns) {
      for (const m of html.matchAll(re)) {
        let u = m[0];
        if (u.includes("\\u002f")) {
          u = u
            .replace(/\\u002f/gi, "/")
            .replace(/\\u0026/gi, "&")
            .replace(/\\u003d/gi, "=")
            .replace(/\\u003f/gi, "?");
        }
        add(u);
      }
    }
    return urls;
  }, ext);
  return filterEmbedUrls(raw);
}

async function triggerVideoPlayback(viewerPage) {
  const video = viewerPage.locator("video").first();
  if (await video.count()) {
    await video
      .evaluate((v) => {
        v.muted = true;
        v.playsInline = true;
        return v.play?.().catch(() => {});
      })
      .catch(() => {});
    vlog("triggered HTML5 video.play()");
  }
  const playBtn = viewerPage.getByRole("button", { name: /play|resume/i });
  if (await playBtn.count()) {
    await playBtn.first().click({ timeout: 4000 }).catch(() => {});
    vlog("clicked play button");
  }
}

async function openViewerForRead(viewerPage, viewerUrl, expectedExt, { fast = false } = {}) {
  const isStreamPage = viewerUrl.includes("stream.aspx");
  const nav = await viewerPage.goto(viewerUrl, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  let navBuf = null;
  if (nav?.ok()) {
    navBuf = await nav.body().catch(() => null);
    if (navBuf && !bufferMatchesExtension(navBuf, expectedExt)) navBuf = null;
  }

  if (VIDEO_EXT.has(expectedExt)) {
    await viewerPage.waitForTimeout(isStreamPage ? 2500 : 1500);
    await triggerVideoPlayback(viewerPage);
    await viewerPage.waitForTimeout(isStreamPage ? 5000 : 2500);
    return navBuf;
  }

  if (fast) {
    await viewerPage.waitForTimeout(1500);
    return navBuf;
  }

  await viewerPage.waitForTimeout(2000);
  const iframe = viewerPage.locator("iframe").first();
  if (await iframe.count()) {
    await iframe.waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
    await viewerPage.waitForTimeout(3000);
  } else {
    await viewerPage.waitForTimeout(3000);
  }
  return navBuf;
}

async function openFromFileList(listPage, fileName) {
  await listPage.bringToFront();
  if (!listPage.url().includes("sharepoint.com")) {
    await listPage.goto(runCtx.inputUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await listPage.waitForTimeout(3000);
  }
  const row = listPage.getByRole("row").filter({ hasText: fileName });
  await row.first().dblclick({ timeout: 60000 });
  await listPage.waitForTimeout(8000);
}

async function readFileViaViewer(context, apiRequest, listPage, viewerHolder, item, destPath, pageUrl) {
  const fresh = await timeStep("resolve drive item (Graph/API)", () => resolveItemForDownload(listPage, item));
  const ext = fileExtension(fresh.name);
  const timeoutMs = captureTimeoutMs(fresh);
  const viewerUrls = buildViewerUrlCandidates(fresh, pageUrl);
  const viewerPage = await ensureViewerPage(context, viewerHolder);
  const referer = fresh.webUrl || pageUrl || runCtx.inputUrl;
  const media = isMediaExt(ext);

  vlog(
    `download ${fresh.name} ext=.${ext} apiSize=${fresh.sizeBytes ? formatMiB(fresh.sizeBytes) : "?"} driveId=${fresh.driveId ? "yes" : "no"} downloadUrl=${fresh.downloadUrl ? "yes" : "no"}`
  );

  if (VIDEO_EXT.has(ext)) {
    const streamUrl = pickStreamPageUrl(fresh);
    if (streamUrl) {
      const streamPage = await ensureViewerPage(context, viewerHolder);
      const streamDl = await timeStep("SharePoint Stream transcode (oneDrive.transcode)", () =>
        downloadSharePointStreamVideo(streamPage, apiRequest, streamUrl, destPath, {
          vlog,
          triggerPlayback: triggerVideoPlayback,
          concurrency: Math.min(8, runCtx.segmentThreads + 2),
        })
      );
      if (streamDl.ok) return streamDl;
    } else {
      vlog("no stream.aspx URL — open the video in Stream viewer or pass a stream.aspx link");
    }
  }

  if (media) {
    const native = await timeStep("SharePoint native (Graph/REST/Download UI)", () =>
      trySharePointNativeDownload(listPage, apiRequest, fresh, destPath, ext, referer)
    );
    if (native.ok) return native;
  }

  for (const viewerUrl of viewerUrls) {
    if (VIDEO_EXT.has(ext) && !viewerUrl.includes("stream.aspx")) {
      vlog(`skip non-stream viewer for video (use transcode path): ${viewerUrl.slice(0, 80)}…`);
      continue;
    }
    vlog(`try viewer URL: ${viewerUrl.slice(0, 110)}…`);

    if (fresh.sizeBytes && media) {
      if (
        await timeStep("segment (known size from API)", () =>
          trySegmentedDownload(apiRequest, viewerUrl, destPath, ext, referer, fresh.sizeBytes)
        )
      ) {
        return { ok: true, via: "segmented parallel (API size + viewer URL)" };
      }
    }

    if (
      await timeStep("segment (probe viewer URL)", () =>
        trySegmentedDownload(apiRequest, viewerUrl, destPath, ext, referer)
      )
    ) {
      return { ok: true, via: "segmented parallel (viewer URL)" };
    }

    let navBuf = null;
    const captured = await timeStep("discover stream in viewer", () =>
      captureFileWhileViewing(
        context,
        async () => {
          navBuf = await openViewerForRead(viewerPage, viewerUrl, ext, { fast: media });
        },
        ext,
        timeoutMs
      )
    );

    if (captured.segment) {
      vlog(`using discovered stream ${formatMiB(captured.segment.size)}`);
      if (
        await timeStep("segment (discovered stream URL)", () =>
          trySegmentedDownload(
            apiRequest,
            captured.segment.url,
            destPath,
            ext,
            referer,
            captured.segment.size
          )
        )
      ) {
        return { ok: true, via: "segmented parallel (stream URL)" };
      }
      if (
        await timeStep("single-stream fallback (discovered URL)", () =>
          downloadSingleStream(apiRequest, captured.segment.url, destPath, referer, ext)
        )
      ) {
        return { ok: true, via: "single stream (discovered URL)" };
      }
    }

    if (navBuf && !media) {
      fs.writeFileSync(destPath, navBuf);
      return { ok: true, via: "viewer navigation" };
    }
    if (captured.ok && captured.buffer) {
      fs.writeFileSync(destPath, captured.buffer);
      return { ok: true, via: "viewer network stream" };
    }
    if (captured.mediaUrls?.length) {
      vlog(`probing ${captured.mediaUrls.length} network media URL(s)`);
      const fromNetwork = await tryDownloadFromMediaUrls(
        apiRequest,
        captured.mediaUrls,
        destPath,
        ext,
        referer,
        "network media URL"
      );
      if (fromNetwork.ok) return fromNetwork;
    }

    if (captured.partial) {
      vlog("partial/incomplete capture — continuing fallbacks");
    }

    const embedded = await extractEmbedMediaUrls(viewerPage, ext);
    vlog(`embed URLs found: ${embedded.length}`);
    for (const embedUrl of embedded) {
      if (
        await timeStep("segment (embed URL)", () =>
          trySegmentedDownload(apiRequest, embedUrl, destPath, ext, referer)
        )
      ) {
        return { ok: true, via: "segmented parallel (embed URL)" };
      }
      if (
        await timeStep("single-stream (embed URL)", () =>
          downloadSingleStream(apiRequest, embedUrl, destPath, referer, ext)
        )
      ) {
        return { ok: true, via: "single stream (embed URL)" };
      }
      const buf = await fetchBinaryViaViewerUrl(listPage, embedUrl, ext);
      if (buf) {
        fs.writeFileSync(destPath, buf);
        return { ok: true, via: "embed URL (small inline fetch)" };
      }
    }

    if (
      await timeStep("single-stream (viewer URL)", () =>
        downloadSingleStream(apiRequest, viewerUrl, destPath, referer, ext)
      )
    ) {
      return { ok: true, via: "single stream (viewer URL)" };
    }

    const fetched = await fetchBinaryViaViewerUrl(listPage, viewerUrl, ext);
    if (fetched) {
      fs.writeFileSync(destPath, fetched);
      return { ok: true, via: "viewer URL fetch" };
    }
  }

  if (runCtx.mode === "folder") {
    const captured = await captureFileWhileViewing(
      context,
      () => openFromFileList(listPage, fresh.name),
      ext,
      timeoutMs
    );
    if (captured.segment) {
      if (
        await trySegmentedDownload(
          apiRequest,
          captured.segment.url,
          destPath,
          ext,
          referer,
          captured.segment.size
        )
      ) {
        return { ok: true, via: "segmented parallel (file list stream)" };
      }
      if (await downloadSingleStream(apiRequest, captured.segment.url, destPath, referer, ext)) {
        return { ok: true, via: "single stream (file list stream)" };
      }
    }
    if (captured.ok && captured.buffer) {
      fs.writeFileSync(destPath, captured.buffer);
      return { ok: true, via: "file list → viewer" };
    }
  }

  return { ok: false };
}

/**
 * @returns {Promise<{ context: import('playwright').BrowserContext, close: () => Promise<void> }>}
 */
async function launchBrowser(headless) {
  const contextOpts = {
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
  };

  if (headless) {
    // launchPersistentContext ignores headless on Windows (visible Edge/Chromium window).
    // Use ephemeral launch + saved storageState instead.
    if (!fs.existsSync(AUTH_STATE_PATH)) {
      console.error(
        "Headless requires a saved login. Run once WITHOUT --headless, sign in, then retry.\n" +
          `Expected: ${AUTH_STATE_PATH}`
      );
      process.exit(1);
    }

    const browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const context = await browser.newContext({
      ...contextOpts,
      storageState: AUTH_STATE_PATH,
    });

    return {
      context,
      close: async () => {
        await context.close();
        await browser.close();
      },
    };
  }

  const launchOpts = {
    headless: false,
    ...contextOpts,
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };

  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      ...launchOpts,
      channel: "msedge",
    });
  } catch {
    context = await chromium.launchPersistentContext(PROFILE_DIR, launchOpts);
  }

  return {
    context,
    close: async () => {
      await context.close();
    },
  };
}

async function main() {
  shareRootPromise = null;
  const cli = parseArgs(process.argv.slice(2));
  const inputUrl = resolveInputUrl(cli);
  if (cli.showHelp || !inputUrl) {
    printUsage();
    process.exit(cli.showHelp ? 0 : 1);
  }

  const classified = classifyShareLink(inputUrl);
  runCtx = {
    ...classified,
    outDir: cli.outDir ? path.resolve(cli.outDir) : defaultOutDir(classified),
    typesAll: cli.typesAll,
    typesSet: cli.typesSet,
    verbose: cli.verbose,
    segmentMode: cli.segmentMode,
    segmentThresholdBytes: Math.max(1, cli.segmentThresholdMb) * MB,
    segmentThreads: Math.max(1, cli.segmentThreads),
  };

  fs.mkdirSync(runCtx.outDir, { recursive: true });
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  console.log("Input URL:", JSON.stringify(runCtx.inputUrl));
  console.log("Host:", runCtx.spHost);
  console.log("Initial detection:", runCtx.mode);
  console.log(
    "File filter:",
    runCtx.typesAll ? "all extensions" : [...runCtx.typesSet].join(", ")
  );
  console.log("Output folder:", runCtx.outDir);
  const segLabel =
    runCtx.segmentMode === "auto"
      ? `auto (>= ${runCtx.segmentThresholdBytes / MB} MiB, ${runCtx.segmentThreads} threads)`
      : runCtx.segmentMode === "on"
        ? `on (${runCtx.segmentThreads} threads)`
        : "off";
  console.log("Segmented download:", segLabel);
  console.log("Headless flag:", cli.headless);
  console.log("Browser:", cli.headless ? "headless (launch + auth-state.json)" : "visible (Edge if available)");
  console.log("Browser profile:", PROFILE_DIR);
  if (fs.existsSync(AUTH_STATE_PATH)) {
    console.log("Using saved session:", AUTH_STATE_PATH);
  }

  const session = await launchBrowser(cli.headless);
  const context = session.context;
  const page = context.pages()[0] || (await context.newPage());
  const apiRequest = context.request;
  const viewerHolder = { page: null };

  page.on("response", (response) => {
    const ct = (response.headers()["content-type"] || "").toLowerCase();
    if (ct.includes("json")) {
      response
        .json()
        .then((j) => walkForDownloadUrls(j))
        .catch(() => {});
    }
  });

  console.log("\nOpening link…");
  await page.goto(runCtx.inputUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForSessionReady(page, context);
  await page.waitForTimeout(4000);

  await refineModeFromApi(page);

  if (runCtx.mode === "folder" && !runCtx.folderPath) {
    const root = await resolveShareRoot(page);
    if (root?.webUrl) runCtx.folderPath = serverPathFromWebUrl(root.webUrl);
  }

  console.log("Action:", runCtx.mode === "file" ? "save single file" : "scan folder for files");

  const fileItems = await collectFileItems(page);

  if (fileItems.length === 0) {
    console.log("\nNo matching files found.");
    if (runCtx.mode === "folder") {
      console.log("Scroll the folder in the browser to load all rows, wait ~10s, run again.");
    }
    await saveAuth(context);
    await session.close();
    process.exit(1);
  }

  console.log(`\nFound ${fileItems.length} file(s). Using viewer read URLs (web=1)…\n`);

  let ok = 0;
  let fail = 0;

  for (const item of fileItems) {
    const safe = sanitizeFilename(item.name);
    const dest = path.join(runCtx.outDir, safe);

    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`Skip (exists): ${safe}`);
      ok++;
      continue;
    }

    process.stdout.write(`Saving ${safe} … `);
    const result = await readFileViaViewer(context, apiRequest, page, viewerHolder, item, dest, page.url());
    if (result.ok) {
      console.log(`OK (${result.via})`);
      ok++;
    } else {
      console.log("FAILED");
      fail++;
    }
  }

  await saveAuth(context);
  console.log(`\nDone: ${ok} saved, ${fail} failed → ${runCtx.outDir}`);
  if (viewerHolder.page && !viewerHolder.page.isClosed()) {
    await viewerHolder.page.close().catch(() => {});
  }
  await session.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
