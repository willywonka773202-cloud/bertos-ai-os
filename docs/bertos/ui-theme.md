# BertOS — Imperium Design Language

The BertOS UI is an **imperial / celestial AI command center**: obsidian surfaces, etched
gold, celestial-blue accents, classical typography, and tasteful living motion. It must stay
**readable, fast, and useful** — premium, never a "game UI" that hurts usability.

## Foundations

- **Type:** `Cinzel` (imperial display — brand, hero titles, panel titles) via `.font-imperial`;
  `Cormorant Garamond` for classical accents via `.font-classical`; system sans for body; mono for
  terminals. Loaded build-safe through a CSS `@import` in `app/globals.css` (degrades to a serif
  stack offline).
- **Palette:** obsidian `#070503`/`#0E0C09`, gold `#D4B483`/`#F6C453`, bronze `#B8894B`, ivory
  `#F0E8D0`, celestial blue `#7ABCD6` (tokens in `:root`).
- **Gold text:** `.text-imperial-gold` (gradient clip).

## Imperium utility classes (`app/globals.css`)

| Class | Purpose |
| --- | --- |
| `.imperium-card` | Full etched gold command panel (border, inner glow, top/bottom rule, corner brackets) |
| `.imperium-corners` | Corner-bracket glyphs only — preserves the host's tone border (used on every `ChamberCard`) |
| `.imperium-sweep` + child `.imperium-sweep__beam` | Living light sweep across a panel's chrome (used on `RouteHero`) |
| `.imperium-bar` / `.imperium-bar__fill` | Glowing protocol/progress bar with animated sheen |
| `.imperium-divider` | Latin-motto section divider (gold rules) |
| `.imperium-halo` | Breathing celestial glow |
| `.imperium-orbit` / `--reverse` | Rotating ring / sacred-geometry emblem |
| `.imperium-pulse-dot` | Status dot with celestial ping |
| `.imperium-grain` | Fine engraved noise overlay |

Motion keyframes: `imperiumSweep`, `imperiumBarSheen`, `imperiumBreath`, `imperiumSpin`,
`imperiumPing`. All disabled under `prefers-reduced-motion`.

## Ambient backdrop

`OlympusShell` provides the always-on animated stage (cosmos drift, particles, constellation
draw, light sweep, Greek-key border, floating laurel/ring/cube models). It stays on every route.

## Game HUD vs work routes

The gamified HUD (`BertOSGameLayer` — module map, XP, quests) is **reserved for `/dashboard`**.
Work routes (`/assistant`, `/cockpit`, `/providers`, `/runs`, `/outputs`, `/memory-review`,
`/search`, …) render a clean command center: their own `RouteHero` + `ChamberCard` panels, so the
premium imperial surface is what you see — not the game layer.

## Shared components that carry the language

- `RouteHero` — Cinzel gold title, status seal medallion, telemetry metrics, light sweep.
- `ChamberCard` — tone-colored etched panel with corner glyphs + Cinzel title.
- Footer motto — `DOMINABITUR ASTRA · NON VI, SED MENTE`.

Because every coding-OS route uses `RouteHero` + `ChamberCard`, the imperial treatment is applied
app-wide from a small, central set of changes.
