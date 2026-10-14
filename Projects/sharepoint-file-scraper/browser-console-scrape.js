/**
 * Paste into DevTools → Console on a SharePoint page (logged in).
 * Works on folder share OR direct file viewer link. Uses web=1 viewer read.
 *
 * Optional first line in console before paste:
 *   window.__SP_TYPES = ['pdf','mp4'];  // omit for all file types
 */
(async () => {
  const pageUrl = location.href;
  const spHost = location.origin;
  const typesAll = !window.__SP_TYPES;
  const typeSet = new Set((window.__SP_TYPES || []).map((t) => t.toLowerCase()));

  const encodeShareId = (url) => {
    const b64 = btoa(unescape(encodeURIComponent(url)))
      .replace(/=+$/, "")
      .replace(/\//g, "_")
      .replace(/\+/g, "-");
    return `u!${b64}`;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const fileExt = (name) => {
    const i = name.lastIndexOf(".");
    return i > 0 ? name.slice(i + 1).toLowerCase() : "";
  };

  const matches = (name) => {
    const ext = fileExt(name);
    if (!ext) return false;
    return typesAll ? true : typeSet.has(ext);
  };

  const normalizePath = (pathname) => {
    let p = decodeURIComponent(pathname || "");
    p = p.replace(/^\/:b:\/r(?=\/)/, "").replace(/^\/:f:\/r(?=\/)/, "");
    return p.startsWith("/") ? p : `/${p}`;
  };

  const toViewerUrl = (href) => {
    const u = new URL(href, pageUrl);
    if (!u.pathname.includes("/:b:/r/")) {
      u.pathname = `/:b:/r${u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`}`;
    }
    u.searchParams.set("csf", "1");
    u.searchParams.set("web", "1");
    for (const k of ["d", "e"]) {
      if (new URL(pageUrl).searchParams.has(k)) {
        u.searchParams.set(k, new URL(pageUrl).searchParams.get(k));
      }
    }
    return u.toString();
  };

  const looksHtml = (buf) => {
    const head = new TextDecoder().decode(buf.slice(0, 64)).trimStart();
    return head.startsWith("<!") || head.startsWith('{"');
  };

  async function spGet(url) {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }

  async function listChildren(driveId, itemId) {
    const out = [];
    let uri = `${spHost}/_api/v2.1/drives/${driveId}/items/${itemId}/children?$top=200`;
    while (uri) {
      const page = await spGet(uri);
      out.push(...(page.value || []));
      uri = page["@odata.nextLink"] || null;
    }
    return out;
  }

  async function walkFolder(driveId, itemId, files) {
    const children = await listChildren(driveId, itemId);
    for (const c of children) {
      if (c.folder) await walkFolder(driveId, c.id, files);
      else if (matches(c.name)) files.push(c);
    }
  }

  const path = normalizePath(location.pathname);
  let targets = [];

  if (fileExt(path.split("/").pop())) {
    console.log("Mode: single file");
    const name = decodeURIComponent(path.split("/").pop());
    targets.push({ name, viewerUrl: toViewerUrl(pageUrl) });
  } else {
    console.log("Mode: folder");
    const shareId = encodeShareId(pageUrl);
    const root = await spGet(`${spHost}/_api/v2.1/shares/${shareId}/driveItem`);
    const driveId = root.parentReference.driveId;
    const files = [];
    if (root.folder) await walkFolder(driveId, root.id, files);
    else if (root.file && matches(root.name)) files.push(root);

    for (const f of files) {
      targets.push({ name: f.name, viewerUrl: toViewerUrl(f.webUrl || pageUrl) });
    }

    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.href;
      if (!href.includes("sharepoint.com") && !href.includes("1drv")) continue;
      let name = "";
      try {
        name = decodeURIComponent(new URL(href).pathname.split("/").pop() || "");
      } catch {
        continue;
      }
      if (!matches(name)) continue;
      if (!targets.some((t) => t.name === name)) {
        targets.push({ name, viewerUrl: toViewerUrl(href) });
      }
    }
  }

  console.log(`Found ${targets.length} file(s).`);

  for (const { name, viewerUrl } of targets) {
    try {
      const res = await fetch(viewerUrl, {
        credentials: "include",
        headers: { Accept: "*/*" },
      });
      if (!res.ok) {
        console.warn("HTTP", res.status, name);
        continue;
      }
      const blob = await res.blob();
      const buf = await blob.slice(0, 64).arrayBuffer();
      if (looksHtml(new Uint8Array(buf))) {
        console.warn("Got HTML not file bytes:", name, "— open viewer tab manually");
        continue;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      console.log("Saved:", name);
    } catch (e) {
      console.warn("Failed:", name, e.message);
    }
    await sleep(800);
  }

  console.log("Done.");
})();
