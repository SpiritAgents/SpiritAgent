import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_PAIRING_FAILURES,
  createDesktopHttpRequestHandler,
  isAllowedRequestHostHeader,
} from "../../dist-electron/electron/http-host.js";

function makeRequest({ method, url, host = "127.0.0.1:7788", body }) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body), "utf8")];
  return {
    method,
    url,
    // host: null means the request is missing the Host header
    headers: host === null ? {} : { host },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };
}

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      Object.assign(this.headers, headers ?? {});
    },
    end(payload) {
      this.body = payload === undefined ? "" : String(payload);
    },
    once() {},
  };
}

function makePairingHandler({ pairingCode = "123456" } = {}) {
  const state = { tokenHash: undefined, lockoutCalls: 0 };
  const handler = createDesktopHttpRequestHandler({
    host: "127.0.0.1",
    invokeHostCommand: async () => ({}),
    auth: {
      getTokenHash: () => state.tokenHash,
      getPairingCode: () => pairingCode,
      completePairing: async (authTokenHash) => {
        state.tokenHash = authTokenHash;
      },
      onPairingLockout: () => {
        state.lockoutCalls += 1;
      },
    },
  });
  return { handler, state };
}

async function postPairing(handler, code, host = "127.0.0.1:7788") {
  const response = makeResponse();
  await handler(
    makeRequest({ method: "POST", url: "/api/pairing", host, body: { code } }),
    response,
  );
  return response;
}

test("returns a token and completes pairing when the pairing code is correct", async () => {
  const { handler, state } = makePairingHandler();
  const response = await postPairing(handler, "123456");
  assert.equal(response.statusCode, 200);
  const parsed = JSON.parse(response.body);
  assert.equal(typeof parsed.token, "string");
  assert.ok(parsed.token.length > 0);
  assert.equal(typeof state.tokenHash, "string");
  assert.equal(state.lockoutCalls, 0);
});

test("locks out after failures reach the limit: even the correct code is rejected and onPairingLockout fires once", async () => {
  const { handler, state } = makePairingHandler();

  for (let attempt = 1; attempt <= MAX_PAIRING_FAILURES; attempt += 1) {
    const response = await postPairing(handler, "000000");
      assert.equal(response.statusCode, 401, `failure #${attempt} should be 401`);
    assert.equal(JSON.parse(response.body).code, "PAIRING_FAILED");
  }
  assert.equal(state.lockoutCalls, 1);

  const locked = await postPairing(handler, "123456");
  assert.equal(locked.statusCode, 429);
  assert.equal(JSON.parse(locked.body).code, "PAIRING_LOCKED");
  assert.equal(state.tokenHash, undefined);
  assert.equal(state.lockoutCalls, 1);
});

test("correct pairing code still completes pairing below the failure limit", async () => {
  const { handler, state } = makePairingHandler();

  for (let attempt = 1; attempt < MAX_PAIRING_FAILURES; attempt += 1) {
    const response = await postPairing(handler, "999999");
    assert.equal(response.statusCode, 401);
  }
  assert.equal(state.lockoutCalls, 0);

  const success = await postPairing(handler, "123456");
  assert.equal(success.statusCode, 200);
  assert.equal(typeof state.tokenHash, "string");
});

test("rejects any input when the pairing code is revoked (empty string)", async () => {
  const { handler, state } = makePairingHandler({ pairingCode: "" });
  const response = await postPairing(handler, "");
  assert.equal(response.statusCode, 401);
  assert.equal(state.tokenHash, undefined);
});

test("API requests validate the Host header: invalid Host gets 403, valid Host is allowed", async () => {
  const { handler } = makePairingHandler();

  const rejected = makeResponse();
  await handler(
    makeRequest({ method: "GET", url: "/api/pairing/status", host: "attacker.example.com:7788" }),
    rejected,
  );
  assert.equal(rejected.statusCode, 403);

  const missing = makeResponse();
  await handler(makeRequest({ method: "GET", url: "/api/pairing/status", host: null }), missing);
  assert.equal(missing.statusCode, 403);

  for (const allowedHost of ["127.0.0.1:7788", "localhost:7788", "[::1]:7788"]) {
    const accepted = makeResponse();
    await handler(
      makeRequest({ method: "GET", url: "/api/pairing/status", host: allowedHost }),
      accepted,
    );
    assert.equal(accepted.statusCode, 200, `Host ${allowedHost} should be allowed`);
  }
});

test("isAllowedRequestHostHeader: configured host and loopback forms", () => {
  assert.equal(isAllowedRequestHostHeader("127.0.0.1:7788", "127.0.0.1"), true);
  assert.equal(isAllowedRequestHostHeader("localhost", "127.0.0.1"), true);
  assert.equal(isAllowedRequestHostHeader("[::1]:7788", "127.0.0.1"), true);
  assert.equal(isAllowedRequestHostHeader("myhost.lan:7788", "myhost.lan"), true);

  assert.equal(isAllowedRequestHostHeader("attacker.com", "127.0.0.1"), false);
  assert.equal(isAllowedRequestHostHeader("attacker.com:7788", "127.0.0.1"), false);
  assert.equal(isAllowedRequestHostHeader("127.0.0.1.attacker.com", "127.0.0.1"), false);
  assert.equal(isAllowedRequestHostHeader("192.168.1.5:7788", "127.0.0.1"), false);
  assert.equal(isAllowedRequestHostHeader(undefined, "127.0.0.1"), false);
  assert.equal(isAllowedRequestHostHeader("", "127.0.0.1"), false);
});

test("isAllowedRequestHostHeader: allows IP literals and rejects domains when bound to a wildcard address", () => {
  assert.equal(isAllowedRequestHostHeader("192.168.1.5:7788", "0.0.0.0"), true);
  assert.equal(isAllowedRequestHostHeader("[fe80::1]:7788", "::"), true);
  assert.equal(isAllowedRequestHostHeader("attacker.com:7788", "0.0.0.0"), false);
});
