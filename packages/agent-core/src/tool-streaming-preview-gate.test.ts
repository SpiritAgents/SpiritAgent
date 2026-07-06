import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEarlyExecutableArgumentsJson,
  hostToolArgumentsReadyForEarlyStreamingPreview,
  hostToolArgumentsReadyForPreview,
  previewRequestFromStreamingArguments,
  readFilePartialAllowsEarlyExecution,
  readFileStreamingPreviewSignature,
  resolveStreamingToolPreviewEmit,
  shouldEmitStreamingToolNamePreview,
  tryExtractPartialPlanName,
  tryExtractPartialReadFileFields,
  tryExtractPartialToolPath,
  tryExtractPartialWebSearchQuery,
  webSearchStreamingPreviewSignature,
} from './tool-streaming-preview-gate.js';

test('shouldEmitStreamingToolNamePreview fires once when name first appears', () => {
  assert.equal(shouldEmitStreamingToolNamePreview('glob', ''), true);
  assert.equal(shouldEmitStreamingToolNamePreview('glob', 'glob'), false);
  assert.equal(shouldEmitStreamingToolNamePreview('finish_task', ''), false);
});

test('tryExtractPartialToolPath reads path from incomplete JSON', () => {
  const partial = '{"path":"D:\\\\SpiritAgent\\\\README.md","old_text":"';
  assert.equal(tryExtractPartialToolPath(partial), 'D:\\SpiritAgent\\README.md');
});

test('apply_patch early preview when operation.path is streamed', () => {
  const partial = '{"operation":{"type":"create_file","path":"demo.txt","diff":"+hel';
  assert.equal(hostToolArgumentsReadyForEarlyStreamingPreview('apply_patch', partial), true);
  assert.equal(hostToolArgumentsReadyForPreview('apply_patch', partial), false);
  assert.deepEqual(previewRequestFromStreamingArguments('apply_patch', partial), {
    operation: { path: 'demo.txt', type: 'create_file' },
  });
});

test('edit_file early preview when only path is streamed', () => {
  const partial = '{"path":"README.md","old_text":"';
  assert.equal(hostToolArgumentsReadyForEarlyStreamingPreview('edit_file', partial), true);
  assert.equal(hostToolArgumentsReadyForPreview('edit_file', partial), false);
  assert.deepEqual(previewRequestFromStreamingArguments('edit_file', partial), {
    path: 'README.md',
  });
});

test('create_file partial preview exposes path before content streams', () => {
  const partial = '{"path":"src/messages.ts","content":"';
  assert.deepEqual(previewRequestFromStreamingArguments('create_file', partial), {
    path: 'src/messages.ts',
  });
});

test('create_plan early preview when only name is streamed', () => {
  const partial = '{"name":"random-fun-plan","content":"# Title';
  assert.equal(tryExtractPartialPlanName(partial), 'random-fun-plan');
  assert.equal(hostToolArgumentsReadyForEarlyStreamingPreview('create_plan', partial), true);
  assert.equal(hostToolArgumentsReadyForPreview('create_plan', partial), false);
  assert.deepEqual(previewRequestFromStreamingArguments('create_plan', partial), {
    name: 'random-fun-plan',
  });
});

test('resolveStreamingToolPreviewEmit repeats for growing create_plan args', () => {
  const partial = '{"name":"demo-plan","content":"# ';
  const first = resolveStreamingToolPreviewEmit('create_plan', partial, {
    readyPreviewEmitted: false,
  });
  assert.equal(first.emit, true);

  const longer = `${partial}${'x'.repeat(500)}`;
  const second = resolveStreamingToolPreviewEmit('create_plan', longer, first.nextState);
  assert.equal(second.emit, true);
});

test('buildEarlyExecutableArgumentsJson builds read_file path from partial JSON', () => {
  const partial = '{"path":"Cargo.toml","offset":';
  assert.equal(buildEarlyExecutableArgumentsJson('read_file', partial), undefined);
  assert.equal(readFilePartialAllowsEarlyExecution(partial), false);

  const pathOnly = '{"path":"package.json"';
  assert.equal(buildEarlyExecutableArgumentsJson('read_file', pathOnly), '{"path":"package.json"}');
  assert.deepEqual(previewRequestFromStreamingArguments('read_file', pathOnly), { path: 'package.json' });

  const withLines = '{"path":"README.md","offset":10,"limit":41';
  assert.deepEqual(tryExtractPartialReadFileFields(withLines), {
    path: 'README.md',
    offset: 10,
    limit: 41,
  });
  assert.equal(
    buildEarlyExecutableArgumentsJson('read_file', withLines),
    '{"path":"README.md","offset":10,"limit":41}',
  );
});

test('resolveStreamingToolPreviewEmit repeats read_file preview when line range streams in', () => {
  const pathOnly = '{"path":"README.md"';
  const first = resolveStreamingToolPreviewEmit('read_file', pathOnly, {
    readyPreviewEmitted: false,
  });
  assert.equal(first.emit, true);
  assert.equal(readFileStreamingPreviewSignature(pathOnly), 'README.md\0\0');

  const withOffset = '{"path":"README.md","offset":10';
  const second = resolveStreamingToolPreviewEmit('read_file', withOffset, first.nextState);
  assert.equal(second.emit, true);

  const withLimit = '{"path":"README.md","offset":10,"limit":41';
  const third = resolveStreamingToolPreviewEmit('read_file', withLimit, second.nextState);
  assert.equal(third.emit, true);

  const unchanged = resolveStreamingToolPreviewEmit('read_file', withLimit, third.nextState);
  assert.equal(unchanged.emit, false);
});

test('resolveStreamingToolPreviewEmit repeats create_file when content grows', () => {
  const partial = '{"path":"a.ts","content":"line';
  const first = resolveStreamingToolPreviewEmit('create_file', partial, {
    readyPreviewEmitted: false,
  });
  assert.equal(first.emit, true);

  const longer = `${partial} one\\nline two`;
  const second = resolveStreamingToolPreviewEmit('create_file', longer, first.nextState);
  assert.equal(second.emit, true);

  const paddedSameShape = `${longer}${'x'.repeat(80)}`;
  const third = resolveStreamingToolPreviewEmit('create_file', paddedSameShape, second.nextState);
  assert.equal(third.emit, true);
});

test('resolveStreamingToolPreviewEmit repeats edit_file when line delta changes', () => {
  const partial = '{"path":"README.md","old_text":"a\\nb","new_text":"a\\nb\\nc';
  const first = resolveStreamingToolPreviewEmit('edit_file', partial, {
    readyPreviewEmitted: false,
  });
  assert.equal(first.emit, true);

  const withExtraLine = `${partial}\\nd`;
  const second = resolveStreamingToolPreviewEmit('edit_file', withExtraLine, first.nextState);
  assert.equal(second.emit, true);

  const paddedSameDelta = `${withExtraLine}${'x'.repeat(500)}`;
  const third = resolveStreamingToolPreviewEmit('edit_file', paddedSameDelta, second.nextState);
  assert.equal(third.emit, false);
});

test('web_search early preview extracts query from incomplete JSON', () => {
  const partial = '{"query":"Spirit Agent 是什么项目"';
  assert.equal(tryExtractPartialWebSearchQuery(partial), 'Spirit Agent 是什么项目');
  assert.equal(hostToolArgumentsReadyForEarlyStreamingPreview('web_search', partial), true);
  assert.equal(hostToolArgumentsReadyForPreview('web_search', partial), false);
  assert.deepEqual(previewRequestFromStreamingArguments('web_search', partial), {
    query: 'Spirit Agent 是什么项目',
  });
});

test('resolveStreamingToolPreviewEmit repeats web_search preview when query grows', () => {
  const partial = '{"query":"Spirit';
  const first = resolveStreamingToolPreviewEmit('web_search', partial, {
    readyPreviewEmitted: false,
  });
  assert.equal(first.emit, true);
  assert.equal(webSearchStreamingPreviewSignature(partial), 'Spirit');

  const longer = '{"query":"Spirit Agent"';
  const second = resolveStreamingToolPreviewEmit('web_search', longer, first.nextState);
  assert.equal(second.emit, true);

  const unchanged = resolveStreamingToolPreviewEmit('web_search', longer, second.nextState);
  assert.equal(unchanged.emit, false);
});

test('resolveStreamingToolPreviewEmit repeats tool_call when lazy gateway fields stream in', () => {
  const gatewayTool =
    '{"provider":"built-in","server":"desktop","tool":"create_automation","arguments":{';
  const first = resolveStreamingToolPreviewEmit('tool_call', gatewayTool, {
    readyPreviewEmitted: false,
  });
  assert.equal(first.emit, true);

  const withTitle =
    '{"provider":"built-in","server":"desktop","tool":"create_automation","arguments":{"title":"AI 新闻日报"';
  const second = resolveStreamingToolPreviewEmit('tool_call', withTitle, first.nextState);
  assert.equal(second.emit, true);

  const withTrigger =
    '{"provider":"built-in","server":"desktop","tool":"create_automation","arguments":{"title":"AI 新闻日报","trigger":{"kind":"time","schedule":{"kind":"daily","hour":8,"minute":0}}}}';
  const third = resolveStreamingToolPreviewEmit('tool_call', withTrigger, second.nextState);
  assert.equal(third.emit, true);

  const unchanged = resolveStreamingToolPreviewEmit('tool_call', withTrigger, third.nextState);
  assert.equal(unchanged.emit, false);
});
