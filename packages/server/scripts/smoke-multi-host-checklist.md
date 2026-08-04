# Multi-host manual smoke (Desktop + CLI)

Automated coverage: `node packages/server/scripts/smoke-dual-client.mjs` (daemon attach + streaming).

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

## Daemon restart

1. With chat open, stop the daemon (or kill `spirit-server serve`).
2. Re-open Desktop or CLI on the same chat path.
3. Expect: `session.attach` miss → `session.create(conversationKey)` + `replaceFromArchive`; single session restored from chat JSON.

## Provisional → stable path (Desktop)

1. Start a new chat (provisional path), send first message (promote to stable path under `chats/`).
2. Expect: daemon `conversationKey` migrates to the stable absolute path; CLI can attach with the stable path after promote.
