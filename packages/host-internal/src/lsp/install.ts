import { spawn } from 'node:child_process';

import { findLspProvider, type LspProviderId } from './providers.js';

export class LspInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LspInstallError';
  }
}

function runCommand(
  command: string,
  args: string[],
  options?: { shell?: boolean },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: options?.shell ?? process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new LspInstallError(
          stderr.trim() || `${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`,
        ),
      );
    });
  });
}

export async function installLspProvider(providerId: LspProviderId): Promise<void> {
  const provider = findLspProvider(providerId);
  if (!provider) {
    throw new LspInstallError(`Unknown LSP provider: ${providerId}`);
  }

  switch (provider.installKind) {
    case 'npm': {
      if (!provider.npmPackage) {
        throw new LspInstallError(`npm package not configured for ${providerId}`);
      }
      await runCommand('npm', ['install', '-g', provider.npmPackage]);
      return;
    }
    case 'go': {
      await runCommand('go', ['install', 'golang.org/x/tools/gopls@latest']);
      return;
    }
    case 'rustup': {
      await runCommand('rustup', ['component', 'add', 'rust-analyzer']);
      return;
    }
    case 'platform': {
      throw new LspInstallError(
        'clangd must be installed via your platform package manager (e.g. winget install LLVM.LLVM on Windows, brew install llvm on macOS).',
      );
    }
    case 'manual': {
      throw new LspInstallError(
        'Eclipse JDT Language Server (jdtls) requires manual setup. See the official eclipse.jdt.ls documentation.',
      );
    }
    case 'dotnet': {
      throw new LspInstallError(
        'OmniSharp requires the .NET SDK and the official OmniSharp release. Install dotnet, then download OmniSharp from the official releases page.',
      );
    }
    default: {
      const _exhaustive: never = provider.installKind;
      throw new LspInstallError(`Unsupported install kind: ${String(_exhaustive)}`);
    }
  }
}
