import assert from "node:assert/strict";
import test from "node:test";

import {
  parseResponsesBuiltInToolUiFromArgumentsJson,
  resolveResponsesBuiltInToolStreamPhaseFromArgumentsJson,
} from "../open-responses/responses-built-in-tools.js";
import {
  buildMinimaxWebSearchServerToolEntry,
  createMinimaxAnthropicServerToolsFetch,
  MINIMAX_WEB_SEARCH_SERVER_TOOL_TYPE,
} from "./minimax-server-tools.js";
import {
  buildMinimaxWebSearchPreviewArgumentsJson,
  buildMinimaxWebSearchSucceededArgumentsJson,
  mapMinimaxWebSearchResultsToActionSources,
  parseMinimaxWebSearchResults,
} from "./minimax-web-search-cards.js";

const liveProbeResults = [
  {
    type: "web_search_result",
    title: "【北京今天天气预报】北京天气预报24小时详情_北京天气网",
    url: "https://beijing.tianqi.com/beijing/today/",
    page_age: "2026-06-09 02:31:19",
    content: "微信公众号 扫码随时看天气 北京24小时天气 18 ℃ 晴",
  },
  {
    type: "web_search_result",
    title: "北京天气预报,北京7天天气预报",
    url: "http://www.weather.com.cn/weather/101010100.shtml",
    page_age: "2026-07-20 18:05:00",
    content: "全国 > 北京 > 城区 20日(今天) 雷阵雨",
  },
];

test("buildMinimaxWebSearchServerToolEntry includes doc-versioned type", () => {
  assert.deepEqual(buildMinimaxWebSearchServerToolEntry(), {
    type: MINIMAX_WEB_SEARCH_SERVER_TOOL_TYPE,
    name: "web_search",
  });
});

test("createMinimaxAnthropicServerToolsFetch injects web_search tool into messages body", async () => {
  let capturedBody: string | undefined;

  const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = typeof init?.body === "string" ? init.body : undefined;
    return new Response("{}", { status: 200 });
  };

  const patched = createMinimaxAnthropicServerToolsFetch(fetchImpl, { webSearchEnabled: true });
  await patched("https://api.minimaxi.com/anthropic/v1/messages", {
    method: "POST",
    body: JSON.stringify({ model: "MiniMax-M3", messages: [] }),
  });

  assert.ok(capturedBody);
  const parsed = JSON.parse(capturedBody) as { tools?: unknown[] };
  assert.deepEqual(parsed.tools, [buildMinimaxWebSearchServerToolEntry()]);
});

test("mapMinimaxWebSearchResultsToActionSources maps title url snippet", () => {
  const sources = mapMinimaxWebSearchResultsToActionSources(
    parseMinimaxWebSearchResults(liveProbeResults),
  );
  assert.equal(sources.length, 2);
  assert.equal(sources[0]?.type, "url");
  assert.equal(sources[0]?.url, "https://beijing.tianqi.com/beijing/today/");
  assert.match(String(sources[0]?.title), /北京/);
  assert.match(String(sources[0]?.snippet), /扫码/);
});

test("buildMinimaxWebSearchSucceededArgumentsJson produces Gateway-compatible _spiritUi", () => {
  const argumentsJson = buildMinimaxWebSearchSucceededArgumentsJson(
    "Beijing weather today",
    parseMinimaxWebSearchResults(liveProbeResults),
  );
  const parsed = JSON.parse(argumentsJson) as { query?: string; action?: { query?: string } };

  assert.equal(parsed.query, "Beijing weather today");
  assert.equal(parsed.action?.query, "Beijing weather today");
  assert.equal(resolveResponsesBuiltInToolStreamPhaseFromArgumentsJson(argumentsJson), "succeeded");

  const ui = parseResponsesBuiltInToolUiFromArgumentsJson(argumentsJson);
  assert.ok(ui);
  assert.match(ui!.inputExcerpt, /Beijing weather today/);
  assert.equal(ui!.sourceCount, 2);
  assert.ok(ui!.outputExcerpt?.includes("beijing.tianqi.com"));
  assert.ok(ui!.detailLines && ui!.detailLines.length >= 2);
});

test("buildMinimaxWebSearchPreviewArgumentsJson exposes query for streaming preview", () => {
  assert.equal(
    buildMinimaxWebSearchPreviewArgumentsJson("Shanghai weather today"),
    '{"query":"Shanghai weather today"}',
  );
});
