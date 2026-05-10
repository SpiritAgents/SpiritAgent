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

function createMockImageFetch(): typeof fetch {
  return (async () => {
    const bytes = Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64');
    return {
      status: 200,
      url: 'https://example.com/final-image',
      headers: new Headers({
        'content-type': 'image/png',
      }),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      text: async () => {
        throw new Error('image response should not be read as text');
      },
    } as unknown as Response;
  }) as typeof fetch;
}

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

test('web_fetch returns image part for supported remote image responses', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'spirit-host-tools-web-fetch-image-'));
  const spiritDataDir = join(workspaceRoot, '.spirit-data');
  const originalFetch = globalThis.fetch;

  try {
    await mkdir(spiritDataDir, { recursive: true });
    globalThis.fetch = createMockImageFetch();

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
      name: 'web_fetch',
      url: 'https://example.com/source-image',
    });
    assertHostToolExecutionOutput(output);
    assert.match(output.summaryText, /^\[web image\]/u);
    assert.equal(output.content.some((part) => part.type === 'image'), true);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('web_fetch returns blocked-vision text without image part for remote image responses', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'spirit-host-tools-web-fetch-blocked-'));
  const spiritDataDir = join(workspaceRoot, '.spirit-data');
  const originalFetch = globalThis.fetch;

  try {
    await mkdir(spiritDataDir, { recursive: true });
    globalThis.fetch = createMockImageFetch();

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
      name: 'web_fetch',
      url: 'https://example.com/source-image',
    });
    assertHostToolExecutionOutput(output);
    assert.match(output.summaryText, /该模型不支持 Vision/u);
    assert.equal(output.content.some((part) => part.type === 'image'), false);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('search_files supports case-insensitive regular expression queries', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'spirit-host-tools-search-regexp-'));
  const spiritDataDir = join(workspaceRoot, '.spirit-data');

  try {
    await mkdir(spiritDataDir, { recursive: true });
    await writeFile(join(workspaceRoot, 'alpha.txt'), 'Runtime    parity\nsecond line\n');
    await writeFile(join(workspaceRoot, 'beta.txt'), 'no match here\n');

    const service = new NodeHostToolService({ workspaceRoot, spiritDataDir });
    const output = await service.execute({
      name: 'search_files',
      query: 'runtime\\s+parity',
      is_regexp: true,
    });

    assertSearchToolText(output);
    assert.match(output, /\[tool\] 搜索\(正则\): runtime\\s\+parity/u);
    assert.match(output, /alpha\.txt:1 \| Runtime    parity/u);
    assert.doesNotMatch(output, /beta\.txt/u);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('search_files rejects invalid regular expressions with a clear error', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'spirit-host-tools-search-regexp-error-'));
  const spiritDataDir = join(workspaceRoot, '.spirit-data');

  try {
    await mkdir(spiritDataDir, { recursive: true });

    const service = new NodeHostToolService({ workspaceRoot, spiritDataDir });
    await assert.rejects(
      () =>
        service.execute({
          name: 'search_files',
          query: '(',
          is_regexp: true,
        }),
      /无效正则/u,
    );
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('requestFromFunctionCall parses search_files is_regexp flag', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'spirit-host-tools-search-parse-'));
  const spiritDataDir = join(workspaceRoot, '.spirit-data');

  try {
    await mkdir(spiritDataDir, { recursive: true });

    const service = new NodeHostToolService({ workspaceRoot, spiritDataDir });
    const request = await service.requestFromFunctionCall(
      'search_files',
      '{"query":"runtime\\\\s+parity","is_regexp":true}',
    );

    assert.deepEqual(request, {
      name: 'search_files',
      query: 'runtime\\s+parity',
      is_regexp: true,
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

function assertHostToolExecutionOutput(
  output: HostToolExecutionOutput | string,
): asserts output is HostToolExecutionOutput {
  assert.notEqual(typeof output, 'string');
}

function assertSearchToolText(output: HostToolExecutionOutput | string): asserts output is string {
  assert.equal(typeof output, 'string');
}