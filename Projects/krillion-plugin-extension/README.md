# Krillion Question Reader

A Chrome extension (Manifest V3) for [krillion.io](https://krillion.io):

1. **Reads the question** the moment your own session receives it: the daily dive's 7 prompts, or each Puffer Party category.
2. **Asks an AI** (any OpenAI-compatible API) for answer suggestions, streaming them as they are written.
3. **Shows them** in a transparent floating window styled after the app.

It never opens a connection to the game, never sends game data, and never touches captchas, joining or answering. You play; it reads and suggests. Click a suggestion to copy it.

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this folder.
2. Click the toolbar icon → **Settings**. Enter the base URL, API key and model, then **Save & test**. Chrome asks once to allow the extension to contact that host.
3. Open krillion.io (reload any open Krillion tab).

| Provider | Base URL |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Groq | `https://api.groq.com/openai/v1` |
| Ollama (local) | `http://localhost:11434/v1` (no key) |
| LM Studio (local) | `http://localhost:1234/v1` (no key) |

## Toggles

- **Floating window** – toolbar popup switch, the `×` on the window, or **Alt+K** on the page.
- **AI suggestions** – popup switch. With it off, the window just shows the question.
- AI only runs while the window is on, so a hidden window costs no API calls.
- Questions are still recorded (popup lists, CSV/JSON export) whatever the switches say.

## Flow

```
page's own websocket / fetch ──► hook.js (page world, question text only)
        └─ postMessage ─► bridge.js ─┬─► overlay (shows question at once)
                                     ├─► background.js ─► AI endpoint ─► streamed lines ─► overlay
                                     └─► chrome.storage (saved in parallel, never awaited first)
```

- **Party:** a category arrives in `patch.set.category` (or `room.category` in a `snap`) and the request starts immediately; a newer category cancels an unfinished older request.
- **Daily:** all 7 prompts arrive at once from `/api/today`. The window picks the current prompt by finding it in the page text; the numbered chips let you choose manually. **One AI request per page load:** the first question that appears gets the request (see below); the other six wait.
- Suggestions for a question are remembered for the session (see below).

## Daily dive: one AI request per page load

**Daily dive: one AI request per page load** (Settings, on by default) keeps the daily game cheap:

- Only the **first daily question that needs a request** gets one: whichever appears first on this load, or whichever number you click first. It is a **single call**: no follow-ups for missing answers (the model is asked for 2 extra answers and the reply is cut at your count, to make up for that).
- The other six questions are **not requested**. Their window says so, and shows nothing until you reload the page (a fresh page load gets a fresh request) or press ↻ / "+ more" on that question. Those two buttons are explicit clicks, so they always work.
- A question the extension **already remembers** (12-hour session memory) is shown instantly with **no request at all** and does not use up the load's request.
- **No pre-fetching** while this is on. The "pre-fetch all 7" switch only applies if you turn this one off.
- The setting does not touch party rounds, which still get a request per new category.
- A provider rejecting `temperature` or JSON mode is retried as the same request, not counted as a second one.

Trade-off: with no follow-ups, a model that returns fewer answers than asked leaves the list shorter. "+ more" tops it up on demand.

## More suggestions, ✓ / ✗ feedback and session memory

- **+ more** adds new answers to the list. **↻** replaces the list with a fresh batch. Neither ever repeats an answer already shown for that question (compared loosely, so `Spider-Man` = `spiderman` and `Missouri:` = `Missouri`); the exclusion list is sent to the model and enforced again on its reply.
- **✓ / ✗** on a row tells the extension the game accepted or rejected that answer (click again to undo). Every later request for the question includes it: *accepted → give more like these*, *rejected → never repeat, avoid similar*. A few recent verdicts from **other** questions are included too, so the model learns what the game accepts as the session goes on.
- **Hover** a row to read the model's one-line "why it fits" note, and judge the answer before you type it.
- **Session memory** (12 hours, 40 questions, stored in this browser profile): per question, everything shown plus your marks. A page reload restores the list from memory with **no API call**. **Reset session memory** is in Settings.

## AI output format (JSON)

The model is asked for one JSON object, and the API's JSON mode (`response_format`) is requested too:

```json
{"answers":[{"why":"common fruit","answer":"Apple","tier":"plankton"},{"why":"custard apple relative","answer":"Cherimoya","tier":"deepcut"}]}
```

`why` comes first on purpose: the model writes a few words checking that the answer meets the prompt's constraint (e.g. "entirely west of the Mississippi") before it commits to the answer. It is shown on hover and is optional when parsing. The prompt also asks for an honest tier spread (at most a third `plankton`).

`tier` is one of the game's own tiers (`plankton`, `schooler`, `rare`, `deepcut`, `krillion`) and colours the dot. The reply is parsed **while it streams**: each `{"answer":…}` object is shown the moment it closes, so suggestions still appear one by one. Providers that reject `response_format` (or `temperature`, as o-series/gpt-5 models do) are retried without it automatically.

Fallbacks, in order, if a model ignores the format: a bare JSON array, then plain `Answer | tier` lines. Echoed placeholders such as `"answer"` or `"tier"` are dropped.

**Getting the full number of suggestions.** Models copy the length of the example they are shown, so the prompt's example is generated with exactly *Suggestions per question* items, and it tells the model never to give fewer. If a reply is still short, the extension asks for just the missing ones, listing what it already has (at most two follow-up requests, and none if a follow-up adds nothing new). A failed follow-up keeps what is already on screen.

The system prompt supports `{count}` and `{example}` placeholders. Edit it in Settings; **Reset prompt** restores the default.

## Learning from the game

The game answers every guess, and that is ground truth. In a party round it reports, for every player's answer: **accepted** with its real rarity tier, **rejected** (`miss`: not a valid answer), or `repeat` (valid, but already used this round). With **Learn from game results** on (default), the extension reads these and:

- **Compares predicted and real rarity.** When an answer the AI suggested shows up in the game, its row gets the game's real tier (colour = the game's tier, dot = the AI's guess; hover for both), is auto-marked ✓ (accepted) or ✗ (rejected), and the gap is recorded. `TAKEN` means valid but someone already used it.
- **Tells the AI where it is wrong.** Every request carries calibration lessons ("your labels overstate rarity by 1.2 tiers; you said `rare`, the game said `plankton` for …"), the answers the game accepted on that exact prompt in earlier games (with their tiers), and the ones it rejected, so they are never suggested again.
- **Measures answer shape.** It counts words in accepted vs rejected answers (all players' results, not only the AI's). Models fake "rare" with long, vague phrases and the game rejects those; once the data shows it, a lesson is added. The prompt already says rare means *short and specific*, and answers over five words are dropped.
- **Remembers across sessions** (unlike the 12-hour session memory). The toolbar popup's **Learning** tab shows the numbers; **Reset learned data** is in Settings.

This is in-context learning, not fine-tuning: the model's weights are never changed, so what it "learns" is only as good as the data it is shown each time.

The daily dive is learned from too: the site's `/api/submit` reply gives the real tier and the game's own term for each of your answers, so those feed the same results, calibration and profile (see below).

### When a game ends: summary and reflection

When a game finishes, the extension summarises it and learns from the summary. It needs **Learn from game results** on; the AI step also needs **Learn from each finished game** (default on).

- **What counts as the end.** Party: a live `win` event, or the room going to `over` / back to `lobby` after play (one end per game; a `win` in a snapshot's backlog is the *previous* game's history and is ignored). Daily dive: the site's own `/api/today/complete` call. A bare lobby with nothing played, or games where nothing could be attributed to a category, produce no summary.
- **The summary** (kept, last 30 games, shown as one line in the popup's Learning tab): per category, what the game accepted (with tiers), how many it rejected, how many were already used; how your suggestions fared (accepted / rejected / never used, and which were rejected); **blind spots** (answers the game accepted that the AI never suggested, counted only where the AI made suggestions); your own answers, with the game's term when it corrected them; your result (won / placed Nth).
- **Plain conclusions, no AI call.** The summary is boiled down to short insights ("In *Name an animal with flippers* the game accepted answers you never suggested, such as *Dugong* (rare)…", "…rejected your suggestions *Beaver*: check that every answer truly belongs…"). The newest three go into later requests.
- **AI reflection, one extra request per game.** The summary is sent to your endpoint as text; the model writes 3 to 5 one-sentence lessons that must generalise to *other* prompts. They are kept (newest 8) and the latest four go into later requests as "your own review of earlier games". Skipped for tiny games (under 6 results) and while AI suggestions are off. A refusal or an apology from the model is never stored as a lesson.
- **Feedback in the window.** A short note, "Game over · summary saved · learning from it…", then "learned N lessons from it".
- **Untrusted text.** Other players type whatever they like, and a summary is later read by a model. So only answers the *game accepted*, the AI's own suggestions and your own answers are ever listed; other players' rejected text is only counted. Every string in the text sent for reflection is JSON-quoted, and the model is told quoted text is data, never instructions.

### A daily-answer bug, fixed

Earlier versions matched a daily answer to a question by its id (`p1`…`p7`) alone. Those ids repeat on every day (and in the archive), so an answer from another day's game was filed under today's question of the same number: your profile could show "Tarsier" beside a job-pay question. Now an answer is matched only if it was submitted for **today's date**; anything else is skipped. What was already stored is handled once, on the next daily load: whatever was recorded for today's prompts is dropped, and older undated daily answers in your profile are **ignored** (the popup shows "N older ignored"), never sent to the AI. **Reset** in the Learning tab removes them for good.

### Learning your own leanings

If your answers lean somewhere the AI's don't (say East Asian: Tamiya, Tokay gecko, Shinkansen), **Suggest answers that fit me** (default on) picks that up and favours it when the question allows.

- **Which answers are yours.** *Daily dive*: all of them (it is single-player), taken from the site's own `/api/submit` call: what you typed, and the game's reply (accepted, its tier, its own term). *Party*: the game saves your player id in this page's session storage when you join (`krillion-party-seat:<ROOM>`); the extension reads only that `playerId` (never the key stored beside it) and marks the events from that player.
- **What counts as niche.** Each answer the game accepted from you is stored with the prompt and tier. If it was **not** among the AI's suggestions for that prompt, it is flagged *niche*. Those are the signal: they are what you know that the AI misses.
- **How the AI learns it.** Every request carries up to 24 of your recent accepted answers (niche ones first), and tells the model to work out what they have in common (a language, culture, region, era, hobby, field) and, **when this prompt allows it**, make about a third to half of its answers come from the same areas, mixed with the usual ones. If the question can't fit (say, "a U.S. state"), it ignores this. It never overrides the question's constraints. Nothing is classified in code: no "East Asian" label is computed, the model infers the pattern from your examples.
- **Say it yourself.** Settings → *Your leanings* has an optional "in your own words" field (for example "I know Japanese and Korean pop culture and food"). It works from the first question, before any answers are recorded.
- **Where it goes.** Your recent answers and that text are sent to the AI endpoint you configured, with each question. Switch the feature off to stop that. Recording needs **Learn from game results** to be on. **Reset learned data** also forgets your recorded answers.

### What a real recording showed

Built from a 5-minute party session (752 frames, one player's recording; `tools/` re-runs all of this on any recording):

- **Your own answers are exact.** The client sends `{t:"act", cid, action:{type:"submit", text}}`; the game replies `{t:"ack", cid, submit:{accepted, answer, tier}}` or `{accepted:false, why:"miss"|"repeat"}`, about 0.4 s later. `cid` pairs them, so the extension knows exactly what you typed and how the game scored it. In the recording, 4 of 18 accepted answers were recorded under a different term (`mexico` → `Mexico City`, `squiggle` → `squiggly`, `united state` → `United States`, `guatamela` → `Guatemala`); the typing-indicator method catches only 1 of those 4, the ack catches all of them. Typing indicators are still used for *other* players' corrections (best effort).
- **Your player id comes from the websocket.** A patch caused by one of your acts echoes its `cid`, and lists you as the only player. All 136 such patches carried the same id, so the extension no longer depends on the page's session storage to know which events are yours (it still falls back to it).
- **The game's `pass` event carries the same canonical term as the ack** (18 of 18 identical, answer and tier) and arrives *before* the ack, so either order is handled and nothing is counted twice.
- **Rarity is not about length.** Accepted answers averaged 1.21 words (plankton), 1.33 (schooler), 1.27 (rare), 1.50 (deepcut); rejected ones 1.26. Rare answers are short names few players think of *in that category* (China, India and Peru were "rare" volcano countries; France was "deepcut"). So the "rejected answers run longer" lesson only appears if your own data shows it; it did not here.
- **Most rejections are misspellings or wrong members** (`platapus`, `beaver` for animals with flippers, `dallas` for Olympic hosts), not long or vague phrases. The prompt's "check every constraint" rule is what matters most.
- **No `krillion` tier appeared** in 48 accepted answers, so the one-per-prompt rule is a belief from the game's FAQ, not something this data confirms.
- **Close codes seen:** `4410 "gone"` (the room was closed) and `1000 "leaving"`.

### How the game sees an answer being typed

Each submit carries `input: {keys, pastes, other, synthetic, gaps, mean, cv}`: keystroke count and timing, plus counters for **pastes** and **synthetic input**. All 25 submits in the recording were typed (`pastes: 0`, `synthetic: 0`). The game receives this with every answer, so a suggestion copied from the window and pasted in registers as a paste. What the game does with it is not visible from the traffic (the room was `rated: false`). The extension never types or pastes for you. If you would rather not paste, turn off **Click a suggestion to copy it** in Settings: the rows become read-only and you type the answer yourself.

### When the game accepts a different term

The game is generous: it can accept what a player typed but record its own canonical term (an alias, a fixed spelling; its FAQ gives "sea donkey" for a fish called Threebanded Sheephead). The `pass` event carries the canonical term, so matching by spelling alone would miss these. The page-world script therefore remembers (in memory only, never relayed) the last thing each player typed. When an answer is accepted as something different, that one event gets a `typed` field. Case-only differences and half-typed words are not corrections.

With that, the typed form and the canonical term are **one correct answer**:

- A suggestion that only matches the typed form is marked ✓, shows the game's tier, and a `≈` (hover: *Accepted: the game counted it as "…"*).
- Both names are excluded from later suggestions, so the AI is never offered the canonical name as if it were new.
- The learning store keeps one record per answer with the typed forms listed (`also accepted when typed as …`), and tells the model that the game accepts close variants and aliases.
- The party dataset has a `typed` column for these events.

This relies on the game's live typing indicators, which show what a player typed before they submit. If typing is throttled and the last keystrokes are missing, a half-typed word is treated as no information rather than as an alias.

### Raw websocket recording (opt-in)

**Record raw websocket frames** (off by default; its own switch, separate from the structured dataset) keeps a complete, unfiltered recording of the party websocket for analysis:

- **Every frame, both directions**: what the game sends you (`snap`, `patch`, `ack`, `pong`, …) and what your client sends it (`act`, `ping`, `sync`, typing…), exactly as text, byte for byte, with a timestamp. Plus the connection's `open`, `close` (code and reason) and `error` events, so reconnects and refusals are visible. Binary frames, if any ever appear, are noted with their size.
- **One recording per connection.** A reconnect starts a new one.
- **Unfiltered means unfiltered**: player names, chat and what everyone is typing are in it, because the game sends them. It is stored only on this computer.
- **Only two edits.** The connection URL is saved without its query string (your player key and guest token), and a field literally named `key`, `token`, `playerKey`, `guestToken`, `idToken`, `accessToken` or `authorization` is replaced by `"[redacted]"` if one ever appears in a frame (such a frame is flagged `redacted`). Every other frame is stored unchanged.
- **Export** from the toolbar popup's Learning tab: per recording or all of them, as JSON Lines (one frame per line):

  ```json
  {"session":"FSCC-mw9i-1abc","room":"FSCC","t":1794243687511,"dir":"in","data":"{\"t\":\"patch\",\"patch\":{...}}"}
  ```

  `dir` is `in`, `out` or `meta`. `data` is the frame's original text, unparsed, so nothing is reformatted; use `JSON.parse(line.data)` where you want the object.
- **Bounded**: frames are written in chunks (500 frames or about 250 KB), about 200 MB are kept in total, and the oldest recordings are dropped first. Frames are saved roughly every 0.8 s while recording.
- Only the party websocket is recorded. The daily dive and the game's plain HTTP calls are not.

### One krillion per prompt

The game has exactly one `krillion` answer per prompt (its FAQ calls it a designated gem), so the prompt allows at most one, only if the model is sure, and says it is exceedingly rare. In code, any further `krillion` label is demoted to `deepcut`, and `+ more` is told when the gem is already on the list.

### Duplicates

Near-duplicates are removed, not just exact ones: case (`Pipeline`/`pipeline`), a leading "the", one-letter typos and plural-style variants (`Pipelines`, `Pipline`), whatever tier the model gave each. The first one wins. Different numbers stay separate (`Toy Story 2` / `Toy Story 3`, `Rocky II` / `Rocky III`), as the game accepts them separately.

### Party dataset (opt-in)

**Record party game data** (off by default) keeps every party event per game: answers, tiers, rejections, pops, outs, wins, the category each belongs to. Export JSON or CSV from the popup's Learning tab. Player ids are replaced by a salted hash (random salt per install, never exported): pseudonymous, not anonymous. Names, chat and typing are dropped before the data leaves the page-world script. Stored with `unlimitedStorage` (up to 400 games, 3000 events each).

## Privacy

- **Raw recording** is the one mode that stores everything the party websocket carries, names and chat included. It is off by default and local only (see above).
- By default only the question text leaves the page-world script. With **Learn from game results** or **Record party data** on, the game's result events (answers, rarity, rejections) are relayed too, through a field whitelist. Player names, chat, typing indicators, the player key and the guest token never leave it either way (the websocket URL is reduced to its room code).
- The API key lives in `chrome.storage.local` (unencrypted, this browser profile) and is used only by the background worker. The krillion.io page never sees it.
- The only network request the extension makes is to the AI endpoint you configure, containing the question text.
- `/api/today?preview=…` (the site's unreleased-puzzle hook) is ignored.

## Theme

`ui/theme.css` and the overlay use krillion.io's own tokens (abyss/shallow navy panels, `#4de3ff` accent, tier colours, pixel-cut buttons, VT323). The floating window uses the app's already-loaded VT323. For the popup and settings page to use it too, install VT323 or drop `VT323-Regular.woff2` into `ui/fonts/`; otherwise they fall back to the system monospace.

## Not covered

Archive, themed packs and unlimited mode are paid on krillion.io and are not read.

## Username

In party and daily play the floating window shows a quiet "■ playing as *your name*" at its bottom right, so it is clear the extension knows whose game this is. The name comes from the page's own storage (the seat saved when you join, else the name saved for party play). It is display only: never stored by the extension, recorded, or sent to the AI.

## Analysing a recording

`tools/` has scripts that re-run the analysis above on any raw recording exported from the popup's Learning tab:

```bash
node tools/survey-recording.js    <recording.jsonl>   # sessions, frame types, action/ack shapes, event kinds
node tools/pair-answers.js        <recording.jsonl>   # your submits paired with the game's replies, corrections, input telemetry
node tools/recording-stats.js     <recording.jsonl>   # tier vs length, rejections, per-category tier mix, ordering
node tools/replay-recording.js    <recording.jsonl>   # replays it through the extension's real hook and tracker
```

## Tests

```bash
node test/run.js
```

`node test/build-demo.js` writes `test/overlay-demo.standalone.html`, a harness for trying the floating window (verdict buttons, + more, drag) in any browser without the extension. `node test/build-popup-demo.js` writes `test/popup-demo.standalone.html`: the real popup with fake storage and sample data (a Learning tab with rarity checks, missed answers, lessons, older ignored answers), for looking at the layout.

The tests cover the hook (against a mock page, incl. a leak check and real recorded frames), session memory and feedback, parsing, the AI client against a mock streaming provider (split chunks, de-duplication, early stop, JSON fallback, temperature retry, error cases), and manifest file references.
