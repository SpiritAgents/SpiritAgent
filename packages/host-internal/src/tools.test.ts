import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  NodeHostToolService,
  type HostToolExecutionOutput,
} from './tools.js';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zp1cAAAAASUVORK5CYII=';

test('read_file returns unsupported vision text without image part when model blocks vision', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'spirit-host-tools-vision-blocked-'));
  const spiritDataDir = join(workspaceRoot, '.spirit-data');
  const imagePath = join(workspaceRoot, 'blocked.png');

  try {
    await mkdir(spiritDataDir, { recursive: true });
    await writeFile(imagePath, Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'));

    const service = new NodeHostToolService(
      { workspaceRoot, spiritDataDir },
      {
        getModelCompatibilityProfile: () => ({
          hasExplicitCapabilities: true,
          capabilities: {},
        }),
      },
    );

    const output = await service.execute({
      name: 'read_file',
      path: imagePath,
    });
    assertHostToolExecutionOutput(output);
    assert.match(output.summaryText, /该模型不支持 Vision/u);
    assert.equal(output.content.some((part) => part.type === 'image'), false);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('read_file still returns image part when model explicitly supports vision', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'spirit-host-tools-vision-allowed-'));
  const spiritDataDir = join(workspaceRoot, '.spirit-data');
  const imagePath = join(workspaceRoot, 'allowed.png');

  try {
    await mkdir(spiritDataDir, { recursive: true });
    await writeFile(imagePath, Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'));

    const service = new NodeHostToolService(
      { workspaceRoot, spiritDataDir },
      {
        getModelCompatibilityProfile: () => ({
          hasExplicitCapabilities: true,
          capabilities: { vision: true },
        }),
      },
    );

    const output = await service.execute({
      name: 'read_file',
      path: imagePath,
    });
    assertHostToolExecutionOutput(output);
    assert.match(output.summaryText, /图像文件已作为图片输入返回/u);
    assert.equal(output.content.some((part) => part.type === 'image'), true);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

function assertHostToolExecutionOutput(
  output: HostToolExecutionOutput | string,
): asserts output is HostToolExecutionOutput {
  assert.notEqual(typeof output, 'string');
}