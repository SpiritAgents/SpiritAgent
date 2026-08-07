import assert from "node:assert/strict";
import test from "node:test";

import {
  isMinimaxH3GatewayVideoModel,
  isVeoGatewayVideoModel,
  MINIMAX_H3_GATEWAY_DEFAULT_ASPECT_RATIO,
  resolveAiGatewayVideoAspectRatio,
  resolveAiGatewayVideoDuration,
  resolveAiGatewayVideoProviderOptions,
  snapToNearestVeoGatewayDuration,
} from "./ai-sdk-gateway-backend.js";

test("resolveAiGatewayVideoProviderOptions omits chat /v1 baseUrl for gateway video", () => {
  const options = resolveAiGatewayVideoProviderOptions({
    apiKey: "gateway-key",
    baseUrl: "https://ai-gateway.vercel.sh/v1",
  });

  assert.equal(options.apiKey, "gateway-key");
  assert.equal("baseURL" in options, false);
});

test("isMinimaxH3GatewayVideoModel matches gateway minimax h3 ids", () => {
  assert.equal(isMinimaxH3GatewayVideoModel("minimax/minimax-h3"), true);
  assert.equal(isMinimaxH3GatewayVideoModel("minimax/MiniMax-H3"), true);
  assert.equal(isMinimaxH3GatewayVideoModel("google/veo-3"), false);
});

test("resolveAiGatewayVideoAspectRatio defaults to 16:9 only for minimax h3", () => {
  assert.equal(
    resolveAiGatewayVideoAspectRatio("minimax/minimax-h3", undefined),
    MINIMAX_H3_GATEWAY_DEFAULT_ASPECT_RATIO,
  );
  assert.equal(resolveAiGatewayVideoAspectRatio("google/veo-3", undefined), undefined);
  assert.equal(resolveAiGatewayVideoAspectRatio("minimax/minimax-h3", "9:16"), "9:16");
});

test("isVeoGatewayVideoModel matches gateway veo ids", () => {
  assert.equal(isVeoGatewayVideoModel("google/veo-3.1-generate-001"), true);
  assert.equal(isVeoGatewayVideoModel("google/veo-3.1-fast-generate-preview"), true);
  assert.equal(isVeoGatewayVideoModel("minimax/minimax-h3"), false);
});

test("resolveAiGatewayVideoDuration snaps veo durations to 4/6/8 only", () => {
  assert.equal(resolveAiGatewayVideoDuration("google/veo-3.1-generate-001", undefined), 6);
  assert.equal(resolveAiGatewayVideoDuration("google/veo-3.1-generate-001", 5), 6);
  assert.equal(resolveAiGatewayVideoDuration("google/veo-3.1-generate-001", 8), 8);
  assert.equal(resolveAiGatewayVideoDuration("google/veo-3.1-generate-001", 10), 8);
  assert.equal(resolveAiGatewayVideoDuration("minimax/minimax-h3", 5), 5);
});

test("snapToNearestVeoGatewayDuration prefers higher value on ties", () => {
  assert.equal(snapToNearestVeoGatewayDuration(5), 6);
  assert.equal(snapToNearestVeoGatewayDuration(7), 8);
});
