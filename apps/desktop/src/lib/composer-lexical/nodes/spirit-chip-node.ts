import { createElement, type ReactElement } from "react";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";

import { SpiritChipDecorator } from "@/components/composer-lexical/chips/spirit-chip-decorator";
import {
  spiritChipPlainText,
  type SpiritChipPayload,
} from "@/lib/composer-lexical/spirit-chip-payload";

export type SerializedSpiritChipNode = Spread<
  {
    payload: SpiritChipPayload;
  },
  SerializedLexicalNode
>;

export class SpiritChipNode extends DecoratorNode<ReactElement> {
  __payload: SpiritChipPayload;

  static getType(): string {
    return "spirit-chip";
  }

  static clone(node: SpiritChipNode): SpiritChipNode {
    return new SpiritChipNode(node.__payload, node.__key);
  }

  constructor(payload: SpiritChipPayload, key?: NodeKey) {
    super(key);
    this.__payload = payload;
  }

  static importJSON(serialized: SerializedSpiritChipNode): SpiritChipNode {
    return $createSpiritChipNode(serialized.payload);
  }

  exportJSON(): SerializedSpiritChipNode {
    return {
      ...super.exportJSON(),
      type: "spirit-chip",
      version: 1,
      payload: this.__payload,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.setAttribute("data-spirit-chip", "true");
    span.setAttribute("contenteditable", "false");
    return span;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  // 基类默认返回 slots 文本（chip 无 slots 即 ""），复制/全选会丢 chip；输出 canonical 文本
  getTextContent(): string {
    return spiritChipPlainText(this.__payload);
  }

  // 基类 exportDOM 复用 createDOM（空 span），text/html 同样丢 chip；输出带 canonical 文本的语义化 span
  exportDOM(): DOMExportOutput {
    const span = document.createElement("span");
    span.setAttribute("data-spirit-chip", "true");
    span.setAttribute("data-chip-kind", this.__payload.kind);
    span.textContent = spiritChipPlainText(this.__payload);
    return { element: span };
  }

  decorate(): ReactElement {
    return createElement(SpiritChipDecorator, { payload: this.__payload });
  }

  getPayload(): SpiritChipPayload {
    return this.__payload;
  }

  setPayload(payload: SpiritChipPayload): void {
    const writable = this.getWritable();
    writable.__payload = payload;
  }
}

export function $createSpiritChipNode(payload: SpiritChipPayload): SpiritChipNode {
  return $applyNodeReplacement(new SpiritChipNode(payload));
}

export function $isSpiritChipNode(node: LexicalNode | null | undefined): node is SpiritChipNode {
  return node instanceof SpiritChipNode;
}
