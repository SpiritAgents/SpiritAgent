import { LineBreakNode, ParagraphNode, TextNode, type Klass, type LexicalNode } from "lexical";

import { SpiritChipNode } from "@/lib/composer-lexical/nodes/spirit-chip-node";
import { SpiritParagraphNode } from "@/lib/composer-lexical/nodes/spirit-paragraph-node";

export const COMPOSER_LEXICAL_NODES: ReadonlyArray<Klass<LexicalNode>> = [
  SpiritChipNode,
  SpiritParagraphNode,
  ParagraphNode,
  TextNode,
  LineBreakNode,
];
