# sharepoint-pdf-scraper (`scrape-shr`)

Save files from SharePoint / OneDrive shared links when you have **viewer access** (including Stream videos via `oneDrive.transcode`).

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
node scrape-shr.mjs --url "https://tenant-my.sharepoint.com/..." --verbose
node scrape-shr.mjs --url-file share-url.txt --types mp4
node scrape-shr.mjs --help
```

On Windows, put long URLs (with `&`) in a file or quote the URL — see `--help`.

**Stream videos:** use a `stream.aspx` link; run visibly first (sign in), then optional `--headless` after `auth-state.json` exists.

## Security / publishing

Do **not** commit or upload:

- `auth-state.json` — saved browser session cookies
- `.browser-profile/` — persistent browser profile
- `share-url.txt` / local URL files — may contain private links

These paths are listed in `.gitignore`. Outputs default to `%USERPROFILE%\Downloads\sharepoint-files\` (outside this repo).

## Third-party code

- `stream-mux-worker.js` — fMP4 mux logic adapted from [ms-teams-sharepoint-downloader](https://github.com/brendangooden/ms-teams-sharepoint-downloader) (MIT, © Brendan Gooden).

## License

Apache-2.0 for project scripts authored here; see `stream-mux-worker.js` header for mux worker lineage.
