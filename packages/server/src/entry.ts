#!/usr/bin/env node

/**
 * Spirit Server entry point.
 *
 * The daemon owns the agent runtime; CLI / Desktop / Web clients attach over
 * WebSocket (JSON-RPC 2.0). Logs go to stderr; the protocol never touches
 * stdio, so this process is safe to spawn from any host.
 */

import { runCli } from './cli.js';

process.on('uncaughtException', (err) => {
  console.error('[spirit-server] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[spirit-server] Unhandled rejection:', reason);
});

runCli(process.argv.slice(2)).catch((err) => {
  console.error('[spirit-server] Fatal error:', err);
  process.exitCode = 1;
});
