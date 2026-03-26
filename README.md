# pixel-agents-cli

Terminal-native pixel art visualization of Claude Code agents.

Fork CLI de [pixel-agents](https://github.com/pablodelucca/pixel-agents) par [@pablodelucca](https://github.com/pablodelucca) — adapte pour fonctionner directement dans le terminal sans VS Code ni aucun IDE.

**Auteur du fork :** [Aissa Belkoussa](https://github.com/aissablk1)

---

## Pourquoi ce fork ?

pixel-agents est une excellente extension VS Code qui visualise les agents Claude Code sous forme de personnages pixel art animes. Mais pour les utilisateurs de Claude Code CLI qui travaillent exclusivement dans le terminal, il n'existait aucune solution.

**pixel-agents-cli** comble ce vide : meme visualisation pixel art, directement dans le terminal.

## Fonctionnalites

- **Visualisation temps reel** des agents Claude Code en pixel art anime
- **4 moteurs de rendu** : halfblock, sixel, kitty, ascii (auto-detection ou choix manuel)
- **Detection automatique** des sessions Claude Code actives
- **Multi-sessions** : surveille plusieurs sessions simultanement
- **Zoom interactif** (+/- et auto-fit)
- **Sprites PNG reels** : 6 personnages animes, 9 textures de sol, murs
- **Fallback intelligent** : sprites generes si assets manquants
- **Alternate screen** : terminal propre a la sortie
- **Configuration persistante** : `~/.pixel-agents-cli/config.json`

## Installation

### Depuis npm (a venir)

```bash
npm install -g pixel-agents-cli
```

### Depuis les sources

```bash
git clone https://github.com/aissablk1/pixel-agents-cli.git
cd pixel-agents-cli
npm install
npm run build
```

## Usage

```bash
# Lancer la visualisation (auto-detection du renderer)
pixel-agents

# Choisir un moteur de rendu specifique
pixel-agents -r halfblock    # Caracteres ▀▄ + ANSI 24-bit (universel)
pixel-agents -r sixel        # Bitmap Sixel (iTerm2, WezTerm, foot)
pixel-agents -r kitty        # Kitty Graphics Protocol (Kitty, Ghostty, WezTerm)
pixel-agents -r ascii        # Braille Unicode (universel, meme SSH/tmux)

# Lister les sessions Claude Code detectees
pixel-agents --list-sessions

# Options supplementaires
pixel-agents --fps 15         # Frame rate personnalise
pixel-agents --watch-all      # Surveiller toutes les sessions actives
pixel-agents --zoom 3         # Zoom fixe
```

### Raccourcis clavier

| Touche | Action |
|--------|--------|
| `q` / `Ctrl+C` | Quitter proprement |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom (auto-fit) |
| `r` | Rafraichir la liste des sessions |

## Moteurs de rendu

| Moteur | Technique | Qualite | Terminaux supportes |
|--------|-----------|---------|---------------------|
| **halfblock** | Caracteres ▀▄ + ANSI 24-bit | Bonne (2px/cellule) | Tous les terminaux modernes |
| **sixel** | Bitmap Sixel, palette 216 couleurs | Tres bonne | iTerm2, WezTerm, foot, mlterm |
| **kitty** | Kitty Graphics Protocol, RGBA natif | Excellente | Kitty, Ghostty, WezTerm |
| **ascii** | Braille Unicode (U+2800-U+28FF) | Basique (2x4 dots/cellule) | Universel (SSH, tmux, screen) |

Le mode `auto` (defaut) detecte les capacites du terminal et choisit le meilleur renderer disponible.

## Architecture

```
~/.claude/projects/*/*.jsonl
        |
        v
  SessionDiscoverer ── scan + polling 2s
        |
        v
  FileWatcher ── polling 500ms, lecture incrementale 64KB
        |
        v
  TranscriptParser ── JSONL -> EventEmitter (agentEvent)
        |
        v
  SimpleOffice ── simulation personnages (TYPE/IDLE/WALK)
        |
        v
  loadAssets() ── decodage PNG sprites
        |
        v
  BaseRenderer.rasterize() ── SpriteData -> PixelBuffer (RGBA)
        |
        v
  IRenderer.renderFrame() ── PixelBuffer -> escape sequences
        |
        v
  process.stdout
```

### Structure du projet

```
pixel-agents-cli/
├── bin/pixel-agents.ts           # Point d'entree CLI
├── assets/                       # Sprites PNG (bundled)
├── shared/assets/                # Decodage PNG (fork, pur Node.js)
├── src/
│   ├── index.ts                  # Orchestrateur principal
│   ├── session/                  # Discovery + parsing JSONL
│   │   ├── discoverer.ts         # Scan ~/.claude/projects/
│   │   ├── fileWatcher.ts        # Polling fichiers JSONL
│   │   ├── transcriptParser.ts   # Parsing records JSONL
│   │   └── timerManager.ts       # Timers waiting/permission
│   ├── engine/                   # Simulation
│   │   ├── simpleOffice.ts       # Machine d'etats personnages
│   │   └── gameLoop.ts           # Boucle setInterval
│   ├── renderer/                 # Multi-backend
│   │   ├── types.ts              # Interface IRenderer
│   │   ├── halfblock.ts          # ▀▄ + ANSI 24-bit
│   │   ├── sixel.ts              # Sixel protocol
│   │   ├── kitty.ts              # Kitty Graphics Protocol
│   │   ├── ascii.ts              # Braille Unicode
│   │   ├── detect.ts             # Auto-detection terminal
│   │   └── factory.ts            # Factory renderer
│   ├── ui/                       # Interface terminal
│   │   ├── titleBar.ts
│   │   ├── statusBar.ts
│   │   ├── sessionBar.ts
│   │   └── layout.ts
│   ├── cli/                      # CLI
│   │   ├── args.ts               # Commander.js
│   │   ├── cleanup.ts            # SIGINT/SIGTERM
│   │   └── config.ts             # Configuration persistante
│   └── office/sprites/
│       └── spriteLoader.ts       # Chargement PNG -> SpriteData
└── test/                         # Tests (vitest)
```

## Prerequis

- **Node.js** >= 20.0.0
- **Claude Code CLI** installe et en cours d'utilisation

## Developpement

```bash
npm run dev          # Lancer avec tsx (hot reload)
npm run build        # TypeScript check + esbuild bundle
npm run check-types  # Verification TypeScript seule
npm run test         # Tests vitest
npm run lint         # ESLint
npm run format       # Prettier
```

## Credits

- **Fork et adaptation CLI :** [Aissa Belkoussa](https://github.com/aissablk1)
- **Projet original pixel-agents :** [Pablo De Lucca](https://github.com/pablodelucca) — [pixel-agents](https://github.com/pablodelucca/pixel-agents)
- **Claude Code :** [Anthropic](https://anthropic.com)

## Licence

MIT — Voir [LICENSE](LICENSE)
