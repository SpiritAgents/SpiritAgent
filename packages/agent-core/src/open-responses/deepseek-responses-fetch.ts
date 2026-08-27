import { AsyncLocalStorage } from "node:async_hooks";

import { getLlmFetch } from "../llm-fetch.js";
import type { JsonObject, JsonValue } from "../ports.js";
import { isJsonObject } from "../tool-agent.js";
import {
  mergeDeepSeekResponsesBuiltInTools,
  shouldUseDeepSeekResponsesBuiltInTools,
} from "./deepseek-built-in-tools.js";
import { readBuiltInOutputItemsFromMessage } from "./provider-state.js";
import {
  openResponsesReasoningEffort,
  type OpenResponsesTransportConfig,
} from "./responses-compat.js";

type FetchFn = typeof fetch;

const deepSeekBuiltInInputStore = new AsyncLocalStorage<ReadonlyMap<number, JsonObject[]>>();

export function collectDeepSeekBuiltInInputInsertions(
  messages: readonly JsonValue[],
): Map<number, JsonObject[]> {
  const insertions = new Map<number, JsonObject[]>();
  let assistantIndex = 0;
  for (const message of messages) {
    if (!isJsonObject(message) || message.role !== "assistant") {
      continue;
    }
    const items = readBuiltInOutputItemsFromMessage(message);
    if (items.length > 0) {
      insertions.set(assistantIndex, items);
    }
    assistantIndex += 1;
  }
  return insertions;
}

export function injectDeepSeekBuiltInInputItems(
  input: readonly JsonValue[],
  insertions: ReadonlyMap<number, JsonObject[]>,
): JsonValue[] {
  if (insertions.size === 0) {
    return [...input];
  }

  const result: JsonValue[] = [];
  let assistantIndex = 0;
  for (const item of input) {
    if (isAssistantResponsesInputItem(item)) {
      const extra = insertions.get(assistantIndex);
      if (extra && extra.length > 0) {
        result.push(...extra);
      }
      assistantIndex += 1;
    }
    result.push(item);
  }
  return result;
}

export function runWithDeepSeekBuiltInInputContext<T>(
  insertions: ReadonlyMap<number, JsonObject[]>,
  fn: () => T,
): T {
  return deepSeekBuiltInInputStore.run(insertions, fn);
}

export function bindDeepSeekBuiltInInputContextAsyncIterable<T>(
  insertions: ReadonlyMap<number, JsonObject[]>,
  iterable: AsyncIterable<T>,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const inner = iterable[Symbol.asyncIterator]();
      return {
        next() {
          return deepSeekBuiltInInputStore.run(insertions, () => inner.next());
        },
        return(value?: T | PromiseLike<T>) {
          return deepSeekBuiltInInputStore.run(
            insertions,
            () =>
              inner.return?.(value) ??
              Promise.resolve({
                done: true,
                value: undefined,
              }),
          );
        },
        throw(error?: unknown) {
          return deepSeekBuiltInInputStore.run(
            insertions,
            () => inner.throw?.(error) ?? Promise.reject(error),
          );
        },
      };
    },
  };
}

export function withDeepSeekBuiltInInputContext<T>(
  config: Pick<OpenResponsesTransportConfig, "llmVendor">,
  messages: readonly JsonValue[],
  fn: () => T,
): T {
  if (config.llmVendor !== "deepseek") {
    return fn();
  }
  return runWithDeepSeekBuiltInInputContext(collectDeepSeekBuiltInInputInsertions(messages), fn);
}

export function bindDeepSeekBuiltInInputContextIfNeeded<T>(
  config: Pick<OpenResponsesTransportConfig, "llmVendor">,
  messages: readonly JsonValue[],
  iterable: AsyncIterable<T>,
): AsyncIterable<T> {
  if (config.llmVendor !== "deepseek") {
    return iterable;
  }
  return bindDeepSeekBuiltInInputContextAsyncIterable(
    collectDeepSeekBuiltInInputInsertions(messages),
    iterable,
  );
}

function isAssistantResponsesInputItem(item: JsonValue): boolean {
  return isJsonObject(item) && item.role === "assistant";
}

export function createDeepSeekResponsesAwareFetch(
  config: OpenResponsesTransportConfig,
  baseFetch: FetchFn = getLlmFetch(),
): FetchFn {
  if (!shouldUseDeepSeekResponsesBuiltInTools(config)) {
    return baseFetch;
  }

  return async (input, init) => {
    const requestUrl = readRequestUrl(input);
    if (!requestUrl.includes("/responses")) {
      return baseFetch(input, init);
    }

    const patchedInit = patchDeepSeekResponsesRequestInit(config, init);
    return baseFetch(input, patchedInit);
  };
}

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function patchDeepSeekResponsesRequestInit(
  config: OpenResponsesTransportConfig,
  init: RequestInit | undefined,
): RequestInit | undefined {
  if (!init?.body || typeof init.body !== "string") {
    return init;
  }

  try {
    const body = JSON.parse(init.body) as JsonObject;
    if (!isJsonObject(body as JsonValue)) {
      return init;
    }

    const existingTools = Array.isArray(body.tools) ? body.tools : [];
    const effort = resolveDeepSeekResponsesReasoningEffort(config);
    const patched: JsonObject = {
      ...body,
      tools: mergeDeepSeekResponsesBuiltInTools(existingTools),
    };

    if (effort !== undefined) {
      patched.reasoning = { effort };
    }

    const insertions = deepSeekBuiltInInputStore.getStore();
    if (Array.isArray(patched.input) && insertions && insertions.size > 0) {
      patched.input = injectDeepSeekBuiltInInputItems(patched.input as JsonValue[], insertions);
    }

    delete patched.store;
    delete patched.previous_response_id;

    return {
      ...init,
      body: JSON.stringify(patched),
    };
  } catch {
    return init;
  }
}

export function resolveDeepSeekResponsesReasoningEffort(
  config: Pick<
    OpenResponsesTransportConfig,
    "reasoningEffort" | "vendorExtendedThinking" | "llmVendor" | "model"
  >,
): string | undefined {
  if (config.vendorExtendedThinking === false) {
    return "none";
  }

  return openResponsesReasoningEffort(config);
}
