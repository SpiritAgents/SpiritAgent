import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

let monacoWorkersConfigured = false;

/** Must be called once before the first `monaco.editor.create`. */
export function ensureMonacoWorkers(): void {
  if (monacoWorkersConfigured || typeof globalThis === "undefined") {
    return;
  }
  monacoWorkersConfigured = true;
  (
    globalThis as unknown as {
      MonacoEnvironment: { getWorker: (_workerId: string, _label: string) => Worker };
    }
  ).MonacoEnvironment = {
    getWorker() {
      return new EditorWorker();
    },
  };
}
