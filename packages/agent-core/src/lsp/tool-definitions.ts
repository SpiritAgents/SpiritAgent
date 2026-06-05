import type { JsonObject, JsonValue } from '../ports.js';
import { GET_DIAGNOSTICS_TOOL_NAME } from './constants.js';

export interface LspReadyProviderSummary {
  displayName: string;
  languageLabels: readonly string[];
  extensions: readonly string[];
}

function formatExtensionList(extensions: readonly string[]): string {
  if (extensions.length <= 6) {
    return extensions.join(', ');
  }
  return `${extensions.slice(0, 6).join(', ')}, ...`;
}

function formatReadyProviderPathHint(providers: readonly LspReadyProviderSummary[]): string {
  const segments = providers.map((provider) => {
    const languages = provider.languageLabels.join('/');
    return `${languages} (${formatExtensionList(provider.extensions)})`;
  });
  return `Currently available: ${segments.join('; ')}.`;
}

function buildDescription(providers: readonly LspReadyProviderSummary[]): string {
  if (providers.length === 0) {
    return 'Return language-server diagnostics (errors and warnings) for one workspace source file when a matching server is installed. No language servers are ready on this host.';
  }

  const serverNames = providers.map((provider) => provider.displayName).join(', ');
  const pathHint = formatReadyProviderPathHint(providers);
  return `Return language-server diagnostics (errors and warnings) for one workspace source file. Routes automatically by file extension to an installed server (${serverNames}). ${pathHint} Use after edits or when fixing type or lint issues. Calling get_diagnostics for an extension without a ready server will fail.`;
}

function buildPathParameterDescription(providers: readonly LspReadyProviderSummary[]): string {
  if (providers.length === 0) {
    return 'Workspace-relative or absolute path to a source file. Requires a ready language server for that file extension.';
  }
  return `Workspace-relative or absolute path to a supported source file. ${formatReadyProviderPathHint(providers)}`;
}

export function buildLspHostToolDefinitions(
  readyProviders: readonly LspReadyProviderSummary[] = [],
): JsonValue[] {
  const description = buildDescription(readyProviders);
  const pathDescription = buildPathParameterDescription(readyProviders);

  return [
    functionTool(GET_DIAGNOSTICS_TOOL_NAME, description, {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: pathDescription,
        },
      },
      required: ['path'],
      additionalProperties: false,
    }),
  ];
}

function functionTool(name: string, description: string, parameters: JsonObject): JsonValue {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters,
    },
  };
}
