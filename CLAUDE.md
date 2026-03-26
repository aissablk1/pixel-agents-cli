# pixel-agents-cli

Terminal-native pixel art visualization of Claude Code agents.
Fork of [pixel-agents](https://github.com/pablodelucca/pixel-agents) — adapted for CLI without VS Code.

## Architecture

```
Session Discovery → JSONL Parsing → Office Simulation → Rasterization → Terminal Rendering
```

- **Session layer** (`src/session/`): Scans `~/.claude/projects/` for JSONL transcripts, polls files at 500ms
- **Engine** (`src/engine/`): Character state machine (TYPE/IDLE/WALK), game loop via setInterval
- **Renderer** (`src/renderer/`): Multi-backend abstraction (halfblock, sixel, kitty, ascii)
- **UI** (`src/ui/`): Title bar, status bar, session selector
- **Shared** (`shared/assets/`): PNG decoding, forked from original (pure Node.js)

## Commands

```bash
npm run dev          # Run with tsx (development)
npm run build        # TypeScript check + esbuild bundle
npm run check-types  # TypeScript only
npm run test         # vitest
```

## Conventions

- TypeScript strict mode, `erasableSyntaxOnly` (no `enum`, use `as const` objects)
- `verbatimModuleSyntax`: use `import type` for type-only imports
- ESM modules (`.js` extensions in imports)
- Event-based communication: `EventEmitter` replaces VS Code's `postMessage`
- All rendering goes through `PixelBuffer` (RGBA Uint8Array) intermediate format

## Key Files

- `bin/pixel-agents.ts` — CLI entry point
- `src/index.ts` — Main orchestrator
- `src/session/transcriptParser.ts` — JSONL parsing (most critical logic)
- `src/renderer/halfblock.ts` — Default renderer (▀▄ + ANSI 24-bit)
- `src/engine/simpleOffice.ts` — Character simulation
