import assert from 'node:assert/strict';
import test from 'node:test';

import {
  File,
  FileCode,
  FileJson,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';

import {
  workspaceExplorerIcon,
  workspaceExplorerIconForPath,
} from '../../src/lib/workspace-explorer-icon.ts';

test('workspaceExplorerIcon maps common filenames and extensions', () => {
  assert.equal(workspaceExplorerIcon('package.json', 'file'), FileJson);
  assert.equal(workspaceExplorerIcon('App.tsx', 'file'), FileCode);
  assert.equal(workspaceExplorerIcon('README.md', 'file'), FileText);
  assert.equal(workspaceExplorerIcon('logo.png', 'file'), ImageIcon);
  assert.equal(workspaceExplorerIcon('notes', 'file'), File);
});

test('workspaceExplorerIconForPath uses basename from relative paths', () => {
  assert.equal(workspaceExplorerIconForPath('src/App.tsx'), FileCode);
  assert.equal(workspaceExplorerIconForPath('docs/README.md'), FileText);
});
