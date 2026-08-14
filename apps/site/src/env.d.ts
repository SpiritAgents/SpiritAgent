interface SpiritDesktopApi {
  platform?: "darwin" | "win32" | "linux";
  popupApplicationMenu(
    section: "file" | "edit" | "view" | "window" | "help",
    clientX: number,
    clientY: number,
  ): Promise<void>;
  executeWindowAction?(action: string): void;
  resetSession?(): void;
  readNativeBackdropBlur?(): boolean;
  ptyCreate(request: {
    cwd: string;
    cols: number;
    rows: number;
  }): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  ptyWrite(id: string, data: string): void;
  ptyResize(id: string, cols: number, rows: number): void;
  ptyKill(id: string): Promise<void>;
  openSystemTerminal(cwd: string): Promise<void>;
  ptySubscribe(callbacks: {
    onData: (payload: { id: string; data: string }) => void;
    onExit: (payload: { id: string; exitCode: number; signal?: number }) => void;
  }): () => void;
  readClipboardText(): string;
  writeClipboardText(text: string): void;
}

interface Window {
  spiritDesktop?: SpiritDesktopApi;
}
