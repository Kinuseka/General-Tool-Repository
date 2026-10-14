/**
 * SharePoint Stream / oneDrive.transcode downloader (same approach as
 * ms-teams-sharepoint-downloader — DASH fmp4 segments + optional AES + mux).
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MUX_WORKER = path.join(__dirname, "stream-mux-worker.js");

const SESSION_PARAM_KEYS = [
  "version",
  "P1",
  "P2",
  "P3",
  "P4",
  "VroomTakeover",
  "cTag",
  "format",
  "InputFormat",
  "correlationid",
  "psi",
  "pn",
  "ccat",
  "PlaybackSessionData",
  "altTranscode",
  "enableEncryption",
  "kid",
  "enableCdn",
];

const TRANSCODE_RE = /\/oneDrive\.transcode(?:\?|$)/i;

/** Runs in the browser — returns session + AES key if the Stream player has started. */
async function readStreamCaptureState(page) {
  return page.evaluate(
    ({ sessionParamKeys, transcodePattern }) => {
      const TRANSCODE_RE = new RegExp(`${transcodePattern}(?:\\?|$)`, "i");

      function transcodeUrlsFromPerformance() {
        try {
          return performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .filter((u) => typeof u === "string" && TRANSCODE_RE.test(u));
        } catch {
          return [];
        }
      }

      function buildTranscodeSession(urls) {
        if (!urls.length) return null;
        let base = null;
        let driveId = null;
        let itemId = null;
        const sessionParams = {};
        const tracks = {};
        let encryption = { enabled: false, kid: null };

        for (const u of urls) {
          let url;
          try {
            url = new URL(u);
          } catch {
            continue;
          }
          const q = url.searchParams;
          const part = q.get("part");

          if (!base) {
            base = url.origin + url.pathname;
            const m = url.pathname.match(/\/drives\/([^/]+)\/items\/([^/]+)\//);
            if (m) {
              driveId = m[1];
              itemId = m[2];
            }
            for (const k of sessionParamKeys) {
              const v = q.get(k);
              if (v !== null) sessionParams[k] = v;
            }
            if (q.get("enableEncryption") === "1") {
              encryption = { enabled: true, kid: q.get("kid") };
            }
          }

          const trackKey = q.get("track") || "video";
          const t =
            tracks[trackKey] ||
            (tracks[trackKey] = {
              quality: q.get("quality"),
              wsd: q.get("wsd"),
              ppd: q.get("ppd"),
              ppst: q.get("ppst"),
              initUrl: null,
              sampleSegmentUrl: null,
            });
          if (t.wsd == null && q.get("wsd") != null) t.wsd = q.get("wsd");
          if (t.ppd == null && q.get("ppd") != null) t.ppd = q.get("ppd");
          if (t.ppst == null && q.get("ppst") != null) t.ppst = q.get("ppst");
          if (part === "initsegment") t.initUrl = t.initUrl || u;
          if (part === "mediasegment") t.sampleSegmentUrl = t.sampleSegmentUrl || u;
        }

        const v = tracks.video;
        if (!base || !v || !v.initUrl || !v.sampleSegmentUrl) return null;

        const outTracks = {};
        for (const [k, t] of Object.entries(tracks)) {
          outTracks[k] = {
            quality: t.quality,
            wsd: t.wsd,
            ppd: t.ppd,
            ppst: t.ppst,
            initUrl: t.initUrl,
            sampleSegmentUrl: t.sampleSegmentUrl,
          };
        }

        let durationSec = null;
        try {
          const vid = document.querySelector("video");
          if (vid && isFinite(vid.duration) && vid.duration > 0) durationSec = vid.duration;
        } catch {
          /* ignore */
        }

        return { base, driveId, itemId, sessionParams, encryption, tracks: outTracks, durationSec };
      }

      function readDecryptKey() {
        try {
          const dc = window.g_streamBootstrapContent && window.g_streamBootstrapContent.dashConfig;
          const ck = dc && dc.cdnDecryptionKey;
          if (!ck || ck.valid === false) return null;
          const kb = ck.keyBuffer;
          const iv = ck.iv;
          if (!(kb && kb.length === 16 && iv && iv.length === 16)) return null;
          return { keyBytes: Array.from(kb), iv: Array.from(iv), keyId: ck.keyId || null };
        } catch {
          return null;
        }
      }

      const urls = transcodeUrlsFromPerformance();
      return {
        transcodeUrlCount: urls.length,
        session: buildTranscodeSession(urls),
        decryptKey: readDecryptKey(),
        hasVideo: typeof window.g_fileInfo !== "undefined",
      };
    },
    { sessionParamKeys: SESSION_PARAM_KEYS, transcodePattern: "oneDrive\\.transcode" }
  );
}

function hasTrack(session, name) {
  const t = session?.tracks?.[name];
  return !!(t && t.initUrl && t.sampleSegmentUrl);
}

function buildTracksFromSession(session, decryptKey) {
  if (!session || !decryptKey) return [];
  const enc = { keyBytes: decryptKey.keyBytes, iv: decryptKey.iv };
  const tracks = [];
  for (const [name, t] of Object.entries(session.tracks || {})) {
    if (!t.initUrl || !t.sampleSegmentUrl) continue;
    const wsd = Number(t.wsd);
    const ppd = Number(t.ppd);
    const ppst = Number(t.ppst || 0);
    if (!(wsd > 0) || !(ppd > 0)) continue;
    const count = Math.ceil((ppd - ppst) / wsd);
    const segments = [];
    for (let i = 0; i < count; i++) {
      const u = new URL(t.sampleSegmentUrl);
      u.searchParams.set("segmentTime", String(ppst + i * wsd));
      segments.push(u.toString());
    }
    tracks.push({
      type: name,
      initUrl: t.initUrl,
      segments,
      encryption: enc,
    });
  }
  return tracks;
}

function decryptSegment(buf, encryption) {
  if (!encryption?.keyBytes) return buf;
  const key = Buffer.from(encryption.keyBytes);
  const iv = Buffer.from(encryption.iv);
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  return Buffer.concat([decipher.update(buf), decipher.final()]);
}

async function fetchBuffer(request, url, vlog) {
  const res = await request.get(url, { failOnStatusCode: false, timeout: 600000 });
  if (!res.ok()) {
    vlog?.(`segment HTTP ${res.status()} ${url.slice(0, 80)}…`);
    throw new Error(`HTTP ${res.status()} for segment`);
  }
  return res.body();
}

async function downloadTrack(request, track, concurrency, vlog) {
  const bufs = new Array((track.initUrl ? 1 : 0) + track.segments.length);
  let done = 0;
  const total = bufs.length;

  if (track.initUrl) {
    vlog?.(`fetch init (${track.type})…`);
    bufs[0] = decryptSegment(await fetchBuffer(request, track.initUrl, vlog), track.encryption);
    done++;
    vlog?.(`track ${track.type}: ${done}/${total}`);
  }

  const segStart = track.initUrl ? 1 : 0;
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, track.segments.length) }, async () => {
    while (next < track.segments.length) {
      const i = next++;
      const url = track.segments[i];
      const raw = await fetchBuffer(request, url, vlog);
      bufs[segStart + i] = decryptSegment(raw, track.encryption);
      done++;
      if (done % 10 === 0 || done === total) vlog?.(`track ${track.type}: ${done}/${total}`);
    }
  });
  await Promise.all(workers);
  return bufs;
}

function muxInWorker(videoChunks, audioChunks) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(MUX_WORKER);
    worker.on("message", (msg) => {
      if (msg.error) {
        worker.terminate();
        reject(new Error(msg.error));
      } else if (msg.result) {
        worker.terminate();
        resolve(Buffer.from(msg.result));
      }
    });
    worker.on("error", reject);
    const toAb = (bufs) => bufs.map((b) => {
      const u = b instanceof Buffer ? new Uint8Array(b) : new Uint8Array(b);
      return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
    });
    worker.postMessage({ video: toAb(videoChunks), audio: toAb(audioChunks) });
  });
}

function concatBuffers(bufs) {
  return Buffer.concat(bufs.map((b) => (Buffer.isBuffer(b) ? b : Buffer.from(b))));
}

/**
 * @param {import('playwright').Page} page
 * @param {import('playwright').APIRequestContext} request
 */
export async function downloadSharePointStreamVideo(page, request, streamUrl, destPath, { vlog, triggerPlayback, concurrency = 4, waitMs = 90000 } = {}) {
  vlog?.(`SharePoint Stream transcode path: ${streamUrl.slice(0, 100)}…`);
  await page.goto(streamUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  if (triggerPlayback) await triggerPlayback(page);
  else {
    await page
      .locator("video")
      .first()
      .evaluate((v) => {
        v.muted = true;
        return v.play?.().catch(() => {});
      })
      .catch(() => {});
  }

  const deadline = Date.now() + waitMs;
  let snap = null;
  while (Date.now() < deadline) {
    snap = await readStreamCaptureState(page);
    vlog?.(
      `stream capture: transcode URLs=${snap.transcodeUrlCount} session=${snap.session ? "yes" : "no"} key=${snap.decryptKey ? "yes" : "no"} audio=${snap.session && hasTrack(snap.session, "audio") ? "yes" : "no"}`
    );
    if (snap.session && snap.decryptKey && hasTrack(snap.session, "video")) {
      if (hasTrack(snap.session, "audio")) break;
    }
    await page.waitForTimeout(1500);
  }

  if (!snap?.session || !snap.decryptKey || !hasTrack(snap.session, "video")) {
    vlog?.("SharePoint Stream: no oneDrive.transcode session (player may need visible browser + playback)");
    return { ok: false };
  }

  const allTracks = buildTracksFromSession(snap.session, snap.decryptKey);
  if (!allTracks.length) return { ok: false };

  const videoTrack = allTracks.find((t) => t.type === "video");
  const audioTrack = allTracks.find((t) => t.type === "audio");

  vlog?.(`downloading ${allTracks.length} track(s), video segs=${videoTrack?.segments.length ?? 0}`);

  let videoBufs = null;
  let audioBufs = null;
  if (videoTrack) videoBufs = await downloadTrack(request, videoTrack, concurrency, vlog);
  if (audioTrack) {
    try {
      audioBufs = await downloadTrack(request, audioTrack, concurrency, vlog);
    } catch (e) {
      vlog?.(`audio track failed (${e.message}); saving video-only`);
      audioBufs = null;
    }
  }

  if (videoBufs && audioBufs) {
    vlog?.("muxing video + audio to flat MP4…");
    const muxed = await muxInWorker(videoBufs, audioBufs);
    fs.writeFileSync(destPath, muxed);
    return { ok: true, via: "SharePoint Stream transcode (muxed)" };
  }

  if (videoBufs) {
    vlog?.("writing video track (fragmented MP4 concat)…");
    fs.writeFileSync(destPath, concatBuffers(videoBufs));
    return { ok: true, via: "SharePoint Stream transcode (video track)" };
  }

  return { ok: false };
}
