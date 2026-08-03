<div align="center">

<img width="128" height="128" alt="Spirit Agent Dark" src="https://github.com/user-attachments/assets/e424b9ab-4429-406a-8d6d-764bdc02759c" />


# Spirit Agent

**Ein Open-Source-KI-Agent, der Ihre Produktivität vervielfacht** — verwurzelt in Ihrem Workspace, mit echten Werkzeugen ausgestattet und bereit, mit Ihnen zu planen, auszuführen und zu liefern.

[Desktop-App](#desktop) · [CLI](#cli) · [ACP Server](#acp-server) · [Agent Core](#agent-core) · [Entwicklung](#entwicklung)

> Dieses Projekt befindet sich in aktiver Entwicklung. Verhalten und APIs können sich zwischen Releases ändern.

[English](../README.md)

<img width="1552" height="1032" alt="Spirit Agent Desktop" src="https://github.com/user-attachments/assets/7b07e79d-c800-405a-bee6-40dda9d75b13" />

</div>

## Überblick

Spirit Agent ist ein **werkzeugnutzender Coding-Agent**, der gegen eine echte Projektwurzel arbeitet. Dieselbe Runtime treibt einen nativen Desktop-Workspace und eine Terminal-UI an. Gemeinsame Logik liegt in TypeScript-Paketen; Hosts fügen plattformspezifische Ausführung, Discovery und UI hinzu.

```
┌───────────────────────────────────────────────────────┐
│  Hosts                                                │
│  ┌──────────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │   Desktop    │ │   CLI    │ │    ACP Server     │  │
│  │  (Electron)  │ │  (Rust)  │ │  stdio / ndJSON   │  │
│  └──────┬───────┘ └─────┬────┘ └───────────┬───────┘  │
│         └───────────────┼──────────────────┘          │
│                         ▼                             │
│               packages/host-internal                  │
│            discovery, tools, workspace                │
│                         │                             │
│                         ▼                             │
│                packages/agent-core                    │
│          runtime, prompts, tool contracts             │
└───────────────────────────────────────────────────────┘
```

## Agent Core

[`packages/agent-core`](../packages/agent-core) ist die **einzige Quelle der Agent-Semantik** in diesem Repository. Hosts konsumieren sie.

### Runtime und Modi

- **Turn machine** — Streaming-Ausgabe, Tool-Runden, Kompaktierung und Kontextnutzungs-Tracking.
- **Agent / Plan / Ask-Modi** — voller Toolzugriff, reine Planungs-Workflows oder schreibgeschütztes Q&A ohne Edit-Tools auf Vertragsebene.
- **Subagents** — `subagent` delegiert fokussierte Arbeit an Kindläufe mit eigener Tool-Oberfläche.
- **Schleifensteuerung** — optionales `finish_task` bei aktiviertem Multitask-Loop.
- **Rewind-freundliche Historie** — Nachrichtenarchive für Host-seitiges Rollback und erneutes Senden.

### Modell-Transports

Agent Core leitet Inferenz über mehrere Transports hinter einer Runtime:

| Transport | Typische Anbieter |
| --- | --- |
| **OpenAI-compatible** | OpenAI, DeepSeek, Moonshot, MiniMax, Volcengine, benutzerdefinierte Endpunkte |
| **Open Responses** | OpenAI, xAI, Vercel AI Gateway, OpenRouter, Alibaba (Bailian) |
| **Anthropic** | Claude über Messages API |

Anbieter-native Fähigkeiten (z. B. Websuche bei Open Responses, Alibaba-Suche und Code-Interpreter) werden über das `tools`-Feld injiziert.

### Host-Tool-Verträge

Eingebaute Tools werden einmal in Agent Core definiert (Name, Beschreibung, JSON Schema). Hosts führen aus:

- **Workspace** — `read_file`, `write_file` / `create_file` / `edit_file` / `delete_file`, `apply_patch` (V4A auf unterstützten Transports), `glob`, `grep`, `ls`
- **Shell** — `shell` mit hostgesteuerter Freigabe
- **Web** — `web_fetch`; Suche über Anbieter-Tools oder konfigurierte Host-Suche
- **Delegation** — `subagent`
- **Planning** — `create_plan`, Session-TODO-Tools (`todo_list`, `todo_write`)
- **Multimodal** — `generate_image`, `generate_video`
- **Dreams** — `dream_list`, `dream_read`, `dream_record`, `dream_update`, `dream_delete` für Workspace-Gedächtniszusammenfassungen
- **LSP** — Language-Server-Diagnosen nach Bearbeitungen

### Systemkontext-Assembly

Agent Core bestimmt, wie das Modell den Projektkontext sieht:

- **Rules** — `AGENTS.md`, `.spirit/rule.md` und Benutzerregel-Slots in Systemabschnitten.
- **Skills** — Katalog und aktive Skill-Injektion; Hosts entdecken Dateien auf der Festplatte.
- **MCP** — Model Context Protocol Client, Registry und Tool/Resource/Prompt-Brücke.
- **Mode prompts** — Agent-, Plan- und Ask-Grenzen ohne Tool-Wiederholung im Systemtext.

### Qualität und Evaluation

- **Smoke-Suites** — Vertrags-, Runtime- und Live-Anbieter-Checks unter `packages/agent-core/src/smoke`.
- **Eval-Harness** — Szenariovergleich für Prompt- oder Tool-Definitionsänderungen (`npm run eval:compare` im Repo-Root).

`@spiritagent/agent-core` wird auf npm veröffentlicht; [`packages/host-internal`](../packages/host-internal) enthält gemeinsame Host-Discovery, Extensions, Marketplace, Workspace-Helfer und LSP-Orchestrierung für Desktop.

## Desktop

Die [Desktop-App](../apps/desktop) ist der primäre grafische Host: eine workspace-gebundene IDE-Oberfläche mit konversationellem Agent.

- **Andockpanels** — Datei-Explorer mit Monaco-Editor, eingebettetes Terminal (Electron), Git-Änderungen und Historie, In-App-Browser für lokale Dev-Server.
- **Sessions** — Mehrfach-Konversationshistorie, Worktree-pro-Session-Workflows, Tool-Freigabe, Subagent-Viewer, strukturierte Fragebögen, Kontextnutzung und Rewind.
- **Konfiguration** — Modellanbieter und API-Schlüssel, Skills und Rules, MCP-Server, Extension-Marketplace, Dreams (beta), LSP, Themes und UI-Sprache (Englisch / Vereinfachtes Chinesisch / Deutsch u. a.).
- **Plattformen** — Electron auf Windows, macOS und Linux; optionaler Web-Host mit Remote-Pairing.

Siehe [apps/desktop/README.md](../apps/desktop/README.md) für Desktop-spezifische Entwicklung.

## CLI

<img width="1014" height="744" alt="Spirit Agent CLI" src="https://github.com/user-attachments/assets/ecf4fcec-6a9b-4562-b0da-cc14816f36d3" />


Die [Rust CLI](../apps/cli) (`spirit-agent`) bietet einen terminal-first Host mit optionaler Ratatui-UI. Sie teilt dieselbe Agent-Core-Runtime über die Node-Bridge und eignet sich für Skripte, SSH-Sitzungen und Minimalumgebungen.

```bash
npm run dev:cli    # TS-Pakete bauen, dann cargo run -p spirit-agent
```

## ACP Server

[`packages/acp-server`](../packages/acp-server) ist ein dünner Adapter, der Spirit Agent als [Agent Client Protocol](https://agentclientprotocol.com) (ACP)-Server über stdio / ndJSON bereitstellt. Jeder ACP-kompatible Editor — z. B. **Zed** oder **JetBrains Junie** — kann Spirit Agent als AI-Coding-Engine nutzen, ohne eigene Integration.

- **Terminal Auth** — `initialize` kündigt `type: "terminal"` an; Clients starten `spirit-agent-acp --setup` für interaktive Provider-Konfiguration, dann `authenticate` vor `session/new`.
- **Protokolloberfläche** — `initialize`, `authenticate`, `logout`, `session/new`, `session/prompt`, `session/cancel`, `session/close`, `session/set_mode`.
- **Streaming & Thinking** — Echtzeit-`agent_message_chunk` und `agent_thought_chunk` für Modellreasoning.
- **Permission Bridge** — Tool-Freigabe über ACP `request_permission` mit allow-once / always-allow / reject.
- **Slash-Befehle** — Workspace- und User-Skills als `available_commands_update`; `/skill-name` aktiviert den Skill und injiziert Anweisungen.
- **Lokale Ausführung** — Tools laufen in-process via `NodeHostToolService` (stdio bleibt ACP ndJSON vorbehalten).

### Schnellstart (Zed)

1. Server bauen: `npm run build:acp-server`
2. In Zed `settings.json` eintragen (kein API-Key in `env`):

```json
"agent_servers": {
  "Spirit Agent": {
    "command": "node",
    "args": ["path/to/packages/acp-server/dist/src/stdio-entry.js"]
  }
}
```

3. Bei Authentifizierung **Run in terminal** wählen → `--setup` startet Provider-, Credential- und Modellauswahl.
4. Setup schreibt ins gemeinsame Spirit-Datenverzeichnis (`config.json` + OS-Keyring — wie Desktop/CLI). Danach `authenticate`, dann `session/new`.

Manuelles Setup außerhalb des Editors:

```bash
node path/to/packages/acp-server/dist/src/stdio-entry.js --setup
```

| Umgebungsvariable | Erforderlich | Beschreibung |
| --- | --- | --- |
| `SPIRIT_ACP_WORKSPACE` | Nein | Workspace-Root (Standard: Client-`cwd`) |
| `SPIRIT_ACP_DATA_DIR` | Nein | Spirit-Datenverzeichnis (Standard: `%APPDATA%/SpiritAgent` oder `~/.spirit-agent`) |

## Entwicklung

**Anforderungen:** Node.js 24+, npm. Rust-Toolchain für CLI-Builds.

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev:desktop` | Shared Packages bauen und Desktop starten (Vite + Electron) |
| `npm run dev:desktop:web` | Desktop-Renderer mit Browser-Web-Host |
| `npm run dev:cli` | CLI mit TUI |
| `npm run build` | Produktionsbuild von agent-core, host-internal, acp-server und Desktop |
| `npm run eval:compare` | Eval-Vergleich nach agent-core-Änderungen |

### Repository-Layout

```
apps/
  desktop/           Electron + React Host
  cli/               Rust CLI und TUI
packages/
  agent-core/        Agent-Runtime, Prompts, Tool-Definitionen, Transports, MCP, eval
  host-internal/     Shared Host Discovery, Tools, Extensions, LSP-Helfer
  acp-server/        ACP-Server-Adapter für Editor-Integration
scripts/             Release-, Eval- und Repo-Automatisierung
```

## Mitwirken

Architekturgrenzen, Commit-Konventionen und agent-core-Richtlinien: [AGENTS.md](../AGENTS.md) und [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).

## Lizenz

[MIT](../LICENSE)
