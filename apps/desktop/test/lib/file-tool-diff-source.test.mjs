import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FILE_DIFF_TOOL_NAMES,
  resolveFileToolDiffSource,
} from '../../src/lib/file-tool-diff-source.ts';

test('FILE_DIFF_TOOL_NAMES includes four file/plan tools', () => {
  assert.equal(FILE_DIFF_TOOL_NAMES.size, 4);
  assert.ok(FILE_DIFF_TOOL_NAMES.has('create_file'));
  assert.ok(FILE_DIFF_TOOL_NAMES.has('create_plan'));
  assert.ok(FILE_DIFF_TOOL_NAMES.has('edit_file'));
  assert.ok(FILE_DIFF_TOOL_NAMES.has('delete_file'));
});

test('resolveFileToolDiffSource returns undefined when collapsed', () => {
  const tool = {
    toolName: 'create_file',
    phase: 'preview',
    headline: '创建',
    detailLines: [],
    streamingArgumentsJson: '{"path":"a.ts","content":"hello"}',
  };
  assert.equal(resolveFileToolDiffSource(tool, { open: false }), undefined);
});

test('resolveFileToolDiffSource parses streaming create_file content', () => {
  const tool = {
    toolName: 'create_file',
    phase: 'preview',
    headline: '创建',
    detailLines: [],
    streamingArgumentsJson: '{"path":"src/a.ts","content":"line1\\nline2',
  };
  const result = resolveFileToolDiffSource(tool, { open: true });
  assert.ok(result && typeof result === 'object' && 'modified' in result);
  assert.equal(result.original, '');
  assert.equal(result.modified, 'line1\nline2');
  assert.equal(result.relativePath, 'src/a.ts');
  assert.equal(result.languageId, 'typescript');
});

test('resolveFileToolDiffSource parses complete edit_file from argsExcerpt', () => {
  const request = {
    path: 'm.ts',
    old_text: 'a\nb',
    new_text: 'a\nc',
  };
  const tool = {
    toolName: 'edit_file',
    phase: 'succeeded',
    headline: '编辑',
    detailLines: [],
    argsExcerpt: JSON.stringify(request, null, 2),
  };
  const result = resolveFileToolDiffSource(tool, { open: true });
  assert.deepEqual(result, {
    relativePath: 'm.ts',
    languageId: 'typescript',
    original: 'a\nb',
    modified: 'a\nc',
  });
});

test('resolveFileToolDiffSource uses delete baseline', () => {
  const tool = {
    toolName: 'delete_file',
    phase: 'succeeded',
    headline: '删除',
    detailLines: [],
    deleteFileBaselineText: 'gone\nsoon',
    argsExcerpt: JSON.stringify({ path: 'x.txt' }, null, 2),
  };
  const result = resolveFileToolDiffSource(tool, { open: true });
  assert.equal(result.original, 'gone\nsoon');
  assert.equal(result.modified, '');
});

test('resolveFileToolDiffSource maps create_plan name to plans path', () => {
  const tool = {
    toolName: 'create_plan',
    phase: 'preview',
    headline: '计划',
    detailLines: [],
    streamingArgumentsJson: '{"name":"my-plan","content":"# Plan"}',
  };
  const result = resolveFileToolDiffSource(tool, { open: true });
  assert.equal(result.relativePath, 'plans/my-plan.md');
  assert.equal(result.modified, '# Plan');
});

test('resolveFileToolDiffSource reports truncated argsExcerpt', () => {
  const tool = {
    toolName: 'create_file',
    phase: 'succeeded',
    headline: '创建',
    detailLines: [],
    argsExcerpt: '{"path":"big.ts","content":"unclosed',
  };
  assert.equal(resolveFileToolDiffSource(tool, { open: true }), 'truncated');
});
