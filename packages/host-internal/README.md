# @spiritagent/host-internal

Shared **host-side implementation** for [Spirit Agent](https://github.com/SpiritAgents/SpiritAgent). It sits between platform hosts (Desktop, CLI, ACP server) and [`@spiritagent/agent-core`](https://www.npmjs.com/package/@spiritagent/agent-core), providing discovery, workspace helpers, and local execution plumbing.

## What it provides

- **Discovery** — rules, skills, and workspace instruction metadata for Agent Core system assembly.
- **Tools** — `NodeHostToolService` and related helpers for in-process file, shell, grep/glob, and workspace operations.
- **Extensions & marketplace** — extension catalog, install paths, and marketplace integration used by Desktop.
- **LSP orchestration** — language-server install, probe, and diagnostics wiring after file edits.
- **Storage & runtime helpers** — Spirit data directory access, provider presets, and model listing utilities shared across hosts.

## Requirements

- Node.js 22+
- [`@spiritagent/agent-core`](https://www.npmjs.com/package/@spiritagent/agent-core) at a matching version

## Related packages

- [`@spiritagent/agent-core`](https://www.npmjs.com/package/@spiritagent/agent-core) — agent runtime, prompts, tool definitions, and transports.
- [`@spiritagent/acp-server`](https://www.npmjs.com/package/@spiritagent/acp-server) — ACP server adapter that depends on this package for local tool execution.

## License

MIT — see the [Spirit Agent repository](https://github.com/SpiritAgents/SpiritAgent).
