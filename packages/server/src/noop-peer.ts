import { PassThrough } from 'node:stream';

import { JsonRpcPeer } from '@spiritagent/agent-core/host-bridge';

/**
 * Creates a no-op JsonRpcPeer that does not bind to any real stdin/stdout.
 *
 * In the daemon, tool execution is local via NodeHostToolService
 * (setLocalHostService), so the peer's `call()` is never invoked; the
 * PassThrough streams only satisfy the JsonRpcPeer constructor signature.
 */
export function createNoopPeer(): JsonRpcPeer {
  const dummyInput = new PassThrough();
  const dummyOutput = new PassThrough();
  // Immediately end the input so it doesn't hang
  dummyInput.end();
  // Swallow any output
  dummyOutput.resume();
  const peer = new JsonRpcPeer(dummyInput, dummyOutput);
  // Intentionally NOT calling peer.start() to avoid any data processing
  return peer;
}
