## DoL Cheats International Root Build

This project is a root-level userscript build for Degrees of Lewdity, based on the original cheats mod behavior with an international-safe runtime path.

### What this build focuses on

- Works on hosted DoL pages and local `file://...html` game files.
- Supports spaced/versioned filenames such as `Degrees of Lewdity 0.5.10.12.html`.
- Uses English-default NPC display fallbacks when localized mappings are missing.
- Avoids hard crashes for missing/unknown NPC mapping entries.

### Build userscript

```bash
npm install
npm run build:gm
```

Output userscript file:

- `dist/GreasemonkeyScript.user.js`

### Runtime shortcuts

- `Alt+Q` toggles the panel.
- `Alt+Shift+Q` force-closes the panel.

