import assert from "node:assert/strict";
import { test } from "vitest";

import {
  applyFontSmoothingToDocument,
  FONT_SMOOTHING_CLASS,
  FONT_SMOOTHING_STORAGE_KEY,
  getStoredFontSmoothing,
  setStoredFontSmoothing,
} from "../../src/lib/font-smoothing.ts";

function withLocalStorage(run) {
  const previous = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  try {
    return run(store);
  } finally {
    globalThis.localStorage = previous;
  }
}

function withDocumentClassList(run) {
  const classes = new Set();
  const previous = globalThis.document;
  globalThis.document = {
    documentElement: {
      classList: {
        toggle(name, force) {
          if (force) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
        },
        contains(name) {
          return classes.has(name);
        },
      },
    },
  };
  try {
    return run(classes);
  } finally {
    globalThis.document = previous;
  }
}

test("getStoredFontSmoothing defaults to off", () => {
  withLocalStorage(() => {
    assert.equal(getStoredFontSmoothing(), false);
  });
});

test("getStoredFontSmoothing is on only when stored as true", () => {
  withLocalStorage((store) => {
    store.set(FONT_SMOOTHING_STORAGE_KEY, "false");
    assert.equal(getStoredFontSmoothing(), false);
    store.set(FONT_SMOOTHING_STORAGE_KEY, "true");
    assert.equal(getStoredFontSmoothing(), true);
  });
});

test("setStoredFontSmoothing writes true and clears when off", () => {
  withLocalStorage((store) => {
    setStoredFontSmoothing(true);
    assert.equal(store.get(FONT_SMOOTHING_STORAGE_KEY), "true");
    setStoredFontSmoothing(false);
    assert.equal(store.has(FONT_SMOOTHING_STORAGE_KEY), false);
  });
});

test("applyFontSmoothingToDocument toggles the html class", () => {
  withDocumentClassList((classes) => {
    applyFontSmoothingToDocument(true);
    assert.equal(classes.has(FONT_SMOOTHING_CLASS), true);
    applyFontSmoothingToDocument(false);
    assert.equal(classes.has(FONT_SMOOTHING_CLASS), false);
  });
});
