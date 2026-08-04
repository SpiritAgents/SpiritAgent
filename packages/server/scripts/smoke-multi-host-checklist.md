# Multi-host manual smoke (Desktop + CLI)

Automated coverage: `node packages/server/scripts/smoke-dual-client.mjs` (daemon attach + streaming), `node packages/server/scripts/smoke-desktop-timeline.mjs` (timeline push / pull / update notification, no LLM).

## Prerequisites

- Built server: `npm run build -w @spiritagent/server`
- Desktop dev or packaged build (agent execution is daemon-only)
- CLI on the same machine, same workspace + chat file path

## Checklist

1. **Desktop opens chat A** — `spirit-server ps` / session list shows one `sess_*` with `conversationKey` = chat absolute path.
2. **CLI loads the same path** — `/sessions load <path>`; no second runtime for the same chat.
3. **Desktop submits a turn** — CLI shows user line (`session.userTurnSubmitted`) and assistant streaming (`runtime.event`) without reload.
4. **CLI submits a turn** — Desktop projects the user turn and streams assistant chunks in real time.
5. **Close Desktop only** — CLI remains attached; turns still work.
6. **Close both** — daemon idle-exits after grace (~2.5s with no WS clients).

## Timeline sync (Plan C: desktop push + daemon broadcast)

Desktop pushes its canonical `desktopMessageTimeline` snapshot to the daemon at every persist boundary (turn finish, entering approval/question block, 1s-throttled while busy). The daemon stores it per session (`session.getDesktopTimeline`), merges it into `session.exportArchive`, and broadcasts `session.desktopTimelineUpdated` on every push. CLI `AttachedLive` populates from this timeline (same hydrate path as disk load) and re-syncs from it at turn boundaries while attached.

1. **Desktop runs a chat with tool calls + thinking, then CLI `/sessions load <same path>`** — CLI history matches the Desktop screen: message count, tool cards (headline/phase/detail lines), thinking and compaction segments. No degraded notice is shown.
2. **Desktop submits another turn while CLI is attached** — CLI streams live via `runtime.event`; when the turn lands, CLI re-syncs from the pushed timeline (tool card final phases, thinking placement converge with Desktop).
3. **CLI-driven turn while Desktop watches** — Desktop persists and pushes; CLI re-syncs to the canonical timeline once idle. CLI-local notices (`/sessions save` confirmations etc.) survive the re-sync at the bottom.
4. **`/sessions save` from CLI, then more Desktop turns** — the save confirmation line stays visible after subsequent timeline re-syncs.

### Known v1 limitations (explicit, non-silent)

- **No desktop host, no timeline**: CLI-only sessions have no live timeline. Attaching another CLI shows the degraded notice (`tui.session.live_timeline_degraded`) and an `llm_history` projection instead of the canonical timeline.
- **Frozen after Desktop disconnects**: turns driven solely by CLI after the desktop host detached are not added to the stored timeline; later attachers see the last desktop-pushed snapshot.
- **Full snapshot resync**: no delta protocol yet; every update re-pulls the whole timeline (revision-gated, applied only while idle).
- **TUI render subset**: CLI renders the same subset as a disk load (e.g. `standalone-subagent-status` rows are not rendered in the TUI).
- **Second Desktop attaching the same live session** may project from its (possibly stale) disk restore and can push an older timeline until its first post-attach turn persists; views converge at the next turn boundary.
- **Two Desktops on one session**: daemon revision is last-writer-wins; views converge at persist boundaries.

## Daemon restart

1. With chat open, stop the daemon (or kill `spirit-server serve`).
2. Re-open Desktop or CLI on the same chat path.
3. Expect: `session.attach` miss → `session.create(conversationKey)` + `replaceFromArchive`; single session restored from chat JSON. The stored desktop timeline does not survive a daemon restart (it lives in memory per live session); Desktop re-pushes at its next persist boundary.

## Provisional → stable path (Desktop)

1. Start a new chat (provisional path), send first message (promote to stable path under `chats/`).
2. Expect: daemon `conversationKey` migrates to the stable absolute path; CLI can attach with the stable path after promote.
