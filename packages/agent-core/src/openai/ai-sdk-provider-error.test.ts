import assert from "node:assert/strict";
import { test } from "vitest";

import { renderResponsesTransportError } from "../open-responses/ai-sdk-message-bridge.js";
import { renderAiSdkProviderError } from "./ai-sdk-provider-error.js";

test("renderAiSdkProviderError keeps non-empty Error.message", () => {
  assert.equal(renderAiSdkProviderError(new Error("Insufficient Balance")), "Insufficient Balance");
});

test("renderAiSdkProviderError reads OpenAI-compatible responseBody when message is empty", () => {
  const error = new Error("") as Error & {
    name: string;
    statusCode: number;
    responseBody: string;
  };
  error.name = "AI_APICallError";
  error.statusCode = 401;
  error.responseBody = JSON.stringify({
    error: {
      message: "The API key you provided is invalid.",
      code: "UNAUTHORIZED",
      type: "error",
    },
  });

  assert.equal(renderAiSdkProviderError(error), "The API key you provided is invalid.");
});

test("renderAiSdkProviderError falls back to HTTP status when body has no message", () => {
  const error = new Error("") as Error & {
    name: string;
    statusCode: number;
  };
  error.name = "AI_APICallError";
  error.statusCode = 503;

  assert.equal(renderAiSdkProviderError(error), "AI_APICallError (HTTP 503)");
});

test("renderResponsesTransportError delegates to renderAiSdkProviderError for empty APICallError.message", () => {
  const error = new Error("") as Error & {
    name: string;
    statusCode: number;
    responseBody: string;
  };
  error.name = "AI_APICallError";
  error.statusCode = 400;
  error.responseBody = JSON.stringify({
    error: {
      message:
        "Codex integration with deepseek-v4-pro will be available starting early August 2026.",
      type: "invalid_request_error",
    },
  });

  assert.equal(
    renderResponsesTransportError(error),
    "Codex integration with deepseek-v4-pro will be available starting early August 2026.",
  );
});

test("renderAiSdkProviderError unwraps plain object streaming error with cause/value", () => {
  const inner = new Error("") as Error & {
    name: string;
    statusCode: number;
    responseBody: string;
  };
  inner.name = "AI_APICallError";
  inner.statusCode = 400;
  inner.responseBody = JSON.stringify({
    error: {
      message: "Model qwen-3-14b is unavailable.",
      type: "invalid_request_error",
    },
  });

  assert.equal(
    renderAiSdkProviderError({ name: "Error", cause: inner, value: inner }),
    "Model qwen-3-14b is unavailable.",
  );
});

test("renderAiSdkProviderError skips useless [object Object] Error.message and reads responseBody", () => {
  const error = new Error("[object Object]") as Error & {
    name: string;
    statusCode: number;
    responseBody: string;
  };
  error.name = "AI_APICallError";
  error.statusCode = 400;
  error.responseBody = JSON.stringify({
    error: { message: "Provider rejected request." },
  });

  assert.equal(renderAiSdkProviderError(error), "Provider rejected request.");
});

test("renderAiSdkProviderError unwraps AI_TypeValidationError value.error_message JSON", () => {
  assert.equal(
    renderAiSdkProviderError({
      name: "AI_TypeValidationError",
      cause: { name: "ZodError", message: '[{"code":"invalid_union"}]' },
      value: {
        error_type: "validation_error",
        error_message: JSON.stringify({
          error: {
            message:
              "max_tokens=65536 cannot be greater than max_model_len=max_total_tokens=40960.",
            type: "BadRequestError",
          },
        }),
      },
    }),
    "max_tokens=65536 cannot be greater than max_model_len=max_total_tokens=40960.",
  );
});
