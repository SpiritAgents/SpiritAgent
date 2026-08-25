# @spiritagent/agent-core

TypeScript core runtime for [Spirit](https://github.com/SpiritAgents/SpiritAgent) — the **single source of agent semantics** in the project. Desktop, CLI, and ACP hosts consume this package; they supply platform-specific execution and UI.

## What it provides

- **Turn machine** — streaming assistant output, tool rounds, compaction, and context usage tracking.
- **Agent / Plan / Ask / Debug modes** — full tool access, planning-only workflows, read-only Q&A with edit tools stripped at the contract layer, or structured debugging with log-point hypotheses.
- **Subagents** — `subagent` delegates focused work to child runs with their own tool surface.
- **Model transports** — OpenAI-compatible, Open Responses, and Anthropic routes behind one runtime (OpenAI, DeepSeek, Anthropic, Google, Bedrock, Vertex, Gateway, OpenRouter, Alibaba, and others).
- **Host tool contracts** — built-in tools defined once (name, description, JSON Schema); hosts implement execution for workspace files, shell, web, delegation, planning, multimodal output, Dreams memory, and LSP diagnostics.
- **System context** — rules, skills, MCP client/registry, and mode prompts assembled for the model without duplicating tool lists in system text.

## Requirements

- Node.js 24+

## Related packages

- [`@spiritagent/host-internal`](https://www.npmjs.com/package/@spiritagent/host-internal) — shared host discovery, tools, extensions, and LSP helpers.
- [`@spiritagent/acp-server`](https://www.npmjs.com/package/@spiritagent/acp-server) — ACP server adapter for editor integration.

## License

MIT — see [LICENSE](LICENSE) and the [Spirit repository](https://github.com/SpiritAgents/SpiritAgent).
