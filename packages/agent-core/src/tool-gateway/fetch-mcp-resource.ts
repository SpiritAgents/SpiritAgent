import { McpConfigError } from '../mcp/errors.js';
import type { JsonObject, JsonValue } from '../ports.js';

export const FETCH_MCP_RESOURCE_TOOL_NAME = 'fetch_mcp_resource';

export interface FetchMcpResourceArguments {
  server: string;
  uri: string;
}

export interface FetchMcpResourceToolRequest {
  [key: string]: JsonValue;
  kind: 'fetchMcpResource';
  server: string;
  uri: string;
}

export interface FetchMcpResourceContentPart {
  mimeType?: string;
  text?: string;
  blobOmitted?: true;
  blobLength?: number;
}

export interface FetchMcpResourceResultSingle {
  mimeType?: string;
  text: string;
}

export interface FetchMcpResourceResultMultiple {
  contents: FetchMcpResourceContentPart[];
}

export function isFetchMcpResourceToolName(name: string): boolean {
  return name === FETCH_MCP_RESOURCE_TOOL_NAME;
}

export function buildFetchMcpResourceDefinition(): JsonValue {
  return {
    type: 'function',
    function: {
      name: FETCH_MCP_RESOURCE_TOOL_NAME,
      description: 'Read the full contents of an MCP resource.',
      parameters: {
        type: 'object',
        properties: {
          server: {
            type: 'string',
            description:
              'Configured MCP server name that exposes the resource, as shown on the parent <mcp-server> in <mcp_catalog>.',
          },
          uri: {
            type: 'string',
            description: 'Resource URI exactly as listed on the <resource> element in <mcp_catalog>.',
          },
        },
        required: ['server', 'uri'],
        additionalProperties: false,
      },
    },
  };
}

export function parseFetchMcpResourceArguments(argumentsJson: string): FetchMcpResourceArguments {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(argumentsJson) as JsonValue;
  } catch {
    throw new McpConfigError(`Invalid JSON arguments for ${FETCH_MCP_RESOURCE_TOOL_NAME}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new McpConfigError(`${FETCH_MCP_RESOURCE_TOOL_NAME} arguments must be a JSON object`);
  }

  return {
    server: readRequiredString(parsed, 'server'),
    uri: readRequiredString(parsed, 'uri'),
  };
}

export function isFetchMcpResourceToolRequest(value: JsonValue): value is FetchMcpResourceToolRequest {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && value.kind === 'fetchMcpResource'
    && typeof value.server === 'string'
    && typeof value.uri === 'string'
  );
}

export interface McpResourceFetchBackend {
  assertResourceReadable(server: string, uri: string): Promise<void>;
  readResource(server: string, uri: string): Promise<JsonValue>;
}

export async function executeFetchMcpResourceCall(
  request: FetchMcpResourceArguments,
  mcpService: McpResourceFetchBackend,
): Promise<string> {
  await mcpService.assertResourceReadable(request.server, request.uri);
  const value = await mcpService.readResource(request.server, request.uri);
  return formatMcpResourceFetchResultJson(value);
}

export function formatMcpResourceFetchResultJson(value: JsonValue): string {
  const contents = isJsonObject(value) && Array.isArray(value.contents) ? value.contents : undefined;
  if (!contents || contents.length === 0) {
    throw new McpConfigError('MCP resource returned no contents');
  }

  const parts = contents.map((content) => mapReadResourceContentPart(content));
  if (parts.length === 1) {
    const part = parts[0]!;
    if (part.text !== undefined) {
      const single: FetchMcpResourceResultSingle = {
        ...(part.mimeType === undefined ? {} : { mimeType: part.mimeType }),
        text: part.text,
      };
      return JSON.stringify(single, null, 2);
    }
  }

  const multiple: FetchMcpResourceResultMultiple = { contents: parts };
  return JSON.stringify(multiple, null, 2);
}

function mapReadResourceContentPart(content: JsonValue): FetchMcpResourceContentPart {
  if (!isJsonObject(content)) {
    return { text: safePrettyJson(content) };
  }

  const mimeType =
    typeof content.mimeType === 'string' && content.mimeType.trim()
      ? content.mimeType.trim()
      : undefined;

  if (typeof content.text === 'string') {
    return {
      ...(mimeType === undefined ? {} : { mimeType }),
      text: content.text,
    };
  }

  if (typeof content.blob === 'string') {
    return {
      ...(mimeType === undefined ? {} : { mimeType }),
      blobOmitted: true,
      blobLength: Array.from(content.blob).length,
    };
  }

  return {
    ...(mimeType === undefined ? {} : { mimeType }),
    text: safePrettyJson(content),
  };
}

function readRequiredString(value: JsonObject, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new McpConfigError(`Missing or invalid "${key}" for ${FETCH_MCP_RESOURCE_TOOL_NAME}`);
  }
  return candidate.trim();
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safePrettyJson(value: JsonValue): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
