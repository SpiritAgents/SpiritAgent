#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { brandedMacExecutable, devElectronDir } from "./dev-electron-bundle.mjs";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveElectronExec() {
  if (process.platform === "darwin") {
    const execPath = brandedMacExecutable(devElectronDir(desktopRoot));
    if (!fs.existsSync(execPath)) {
      console.error(
        "[dev] branded Electron.app missing; run scripts/ensure-dev-electron-bundle.mjs first",
      );
      process.exit(1);
    }
    return execPath;
  }
  const require = createRequire(import.meta.url);
  return require("electron");
}

const electron = resolveElectronExec();
const child = spawn(electron, process.argv.slice(2), { stdio: "inherit", windowsHide: false });
let childClosed = false;
child.on("close", (code, signal) => {
  childClosed = true;
  if (code === null) {
    console.error(electron, "exited with signal", signal);
    process.exit(1);
  }
  process.exit(code);
});

function handleTerminationSignal(signal) {
  process.on(signal, () => {
    if (!childClosed) {
      child.kill(signal);
    }
  });
}

handleTerminationSignal("SIGINT");
handleTerminationSignal("SIGTERM");
handleTerminationSignal("SIGUSR2");
