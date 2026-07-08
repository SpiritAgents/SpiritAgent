import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMarkdownIntoBlocks } from 'streamdown';

import { parseStreamBlocksIncrementally } from '../../src/components/agent-markdown-message.tsx';

/** 按流式追加顺序逐段喂入，断言增量结果与全量解析一致 */
function assertIncrementalMatchesFull(chunks) {
  let cache = null;
  let content = '';
  for (const chunk of chunks) {
    content += chunk;
    cache = parseStreamBlocksIncrementally(cache, content);
    assert.equal(cache.content, content);
    assert.deepEqual(cache.blocks, parseMarkdownIntoBlocks(content));
  }
  return cache;
}

test('incremental parse matches full parse across paragraph appends', () => {
  assertIncrementalMatchesFull([
    'Hello ',
    'world.',
    '\n\nSecond paragraph',
    ' continues here.',
    '\n\nThird.',
  ]);
});

test('incremental parse matches full parse across fenced code blocks', () => {
  assertIncrementalMatchesFull([
    'Intro text.\n\n',
    '```ts\nconst a',
    ' = 1;\n',
    '```\n\nAfter the fence.',
  ]);
});

test('incremental parse matches full parse across lists and headings', () => {
  assertIncrementalMatchesFull([
    '# Title\n\n',
    '- one\n',
    '- two\n',
    '\nTail paragraph',
    '\n\n## Sub\n\nMore text.',
  ]);
});

test('incremental parse matches full parse with block math ($$)', () => {
  assertIncrementalMatchesFull([
    'Before.\n\n$$\nx',
    ' + y\n$$',
    '\n\nAfter math.',
  ]);
});

test('footnote syntax falls back to full parse (single block)', () => {
  const cache = assertIncrementalMatchesFull([
    'Alpha.\n\nBeta.',
    '\n\nSee note[^1].\n\n[^1]: the note',
  ]);
  // streamdown 对含脚注文档整体返回单块
  assert.equal(cache.blocks.length, 1);
});

test('identical content reuses the cache object', () => {
  const first = parseStreamBlocksIncrementally(null, 'A.\n\nB.');
  const second = parseStreamBlocksIncrementally(first, 'A.\n\nB.');
  assert.equal(second, first);
});

test('non-append rewrites fall back to full parse', () => {
  const first = parseStreamBlocksIncrementally(null, 'A.\n\nB.\n\nC.');
  const rewritten = parseStreamBlocksIncrementally(first, 'Z.');
  assert.deepEqual(rewritten.blocks, parseMarkdownIntoBlocks('Z.'));
});
