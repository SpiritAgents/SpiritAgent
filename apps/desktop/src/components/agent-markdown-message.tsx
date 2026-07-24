import {
  createContext,
  memo,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { Block, parseMarkdownIntoBlocks, type BlockProps } from "streamdown";
import type { Pluggable } from "unified";

import type { ReadManagedImagePreviewDataUrl } from "@/components/markdown-image";
import type { ReadManagedVideoPreviewUrl } from "@/components/markdown-video";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { MarkdownTone } from "@/lib/markdown-message-components";
import {
  SpiritStreamdownMarkdown,
  type SpiritStreamdownMarkdownProps,
} from "@/components/spirit-streamdown-markdown";

/** Char-level + zero stagger: each stream delta animates in parallel (not serial / per-paragraph batch). */
const streamingAnimateOptions = {
  animation: "slideUp" as const,
  duration: 160,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sep: "char" as const,
  stagger: 0,
};

function isAnimateRehypePlugin(entry: Pluggable): boolean {
  const fn = Array.isArray(entry) ? entry[0] : entry;
  return typeof fn === "function" && /^rehypeAnimate/.test(fn.name ?? "");
}

type StreamBlockAnimateContextValue = {
  lastBlockIndex: number;
  /** Tail-block char length committed after the previous paint (used instead of getLastRenderCharCount). */
  frozenCharCountRef: MutableRefObject<number>;
};

const StreamBlockAnimateContext = createContext<StreamBlockAnimateContextValue>({
  lastBlockIndex: 0,
  frozenCharCountRef: { current: 0 },
});

type StreamdownAnimatePlugin = NonNullable<BlockProps["animatePlugin"]>;

/**
 * Block calls getLastRenderCharCount() then setPrevContentLength(result). In practice get()
 * often returns 0 (Strict Mode / multi-instance), so every character re-animates. Return our
 * committed string length instead and drain the real counter.
 */
function wrapStreamingAnimatePlugin(
  plugin: StreamdownAnimatePlugin,
  getCommittedCharCount: () => number,
): StreamdownAnimatePlugin {
  return {
    ...plugin,
    getLastRenderCharCount() {
      plugin.getLastRenderCharCount();
      return getCommittedCharCount();
    },
    setPrevContentLength(length: number) {
      plugin.setPrevContentLength(length);
    },
  };
}

export type StreamBlockCache = { content: string; blocks: string[] };

const FOOTNOTE_SYNTAX = /\[\^/;

/**
 * 流式内容只会尾部追加：复用上一次已完成的非尾块，只重解析上次尾块起点之后的
 * 文本，避免每个 delta 对全文做第二次 marked lexer 解析（Streamdown 内部已为渲染
 * 解析过一次，此处仅为动画记账）。
 *
 * 含脚注语法（[^…]）时 streamdown 的 parseMarkdownIntoBlocks 会把整个文档作为
 * 单块返回（与前缀无关），此时回退全量解析以保持与其内部分块一致。
 */
export function parseStreamBlocksIncrementally(
  cache: StreamBlockCache | null,
  content: string,
): StreamBlockCache {
  if (cache && cache.content === content) {
    return cache;
  }
  if (
    cache &&
    cache.blocks.length > 1 &&
    content.length > cache.content.length &&
    content.startsWith(cache.content) &&
    !FOOTNOTE_SYNTAX.test(content)
  ) {
    const tailBlock = cache.blocks[cache.blocks.length - 1]!;
    const tailStart = cache.content.length - tailBlock.length;
    // marked 个别结构的 token.raw 覆盖可能不连续（blocks 拼接 ≠ 原文），
    // 尾块对不上末尾时放弃增量路径，退回全量解析。
    if (tailStart >= 0 && cache.content.slice(tailStart) === tailBlock) {
      return {
        content,
        blocks: [
          ...cache.blocks.slice(0, -1),
          ...parseMarkdownIntoBlocks(content.slice(tailStart)),
        ],
      };
    }
  }
  return { content, blocks: parseMarkdownIntoBlocks(content) };
}

function StreamingAnimateBlock(props: BlockProps) {
  const { index, content, animatePlugin, rehypePlugins, ...rest } = props;
  const { lastBlockIndex, frozenCharCountRef } = useContext(StreamBlockAnimateContext);
  const isTailBlock = index === lastBlockIndex;

  const blockRehypePlugins = useMemo(() => {
    if (isTailBlock || !rehypePlugins) return rehypePlugins;
    return rehypePlugins.filter((entry) => !isAnimateRehypePlugin(entry));
  }, [isTailBlock, rehypePlugins]);

  const blockPlugin = useMemo(() => {
    if (!isTailBlock || !animatePlugin) return null;
    return wrapStreamingAnimatePlugin(
      animatePlugin,
      () => frozenCharCountRef.current,
    );
  }, [animatePlugin, frozenCharCountRef, isTailBlock]);

  return (
    <Block
      {...rest}
      index={index}
      content={content}
      rehypePlugins={blockRehypePlugins}
      animatePlugin={blockPlugin}
    />
  );
}

export type AgentMarkdownMessageProps = Pick<
  SpiritStreamdownMarkdownProps,
  | "content"
  | "className"
  | "tone"
  | "size"
  | "allowHtml"
  | "readManagedImagePreviewDataUrl"
  | "readManagedVideoPreviewUrl"
  | "readLocalImagePreviewDataUrl"
  | "localImageBaseDir"
> & {
  streaming?: boolean;
};

function AgentMarkdownMessageImpl({
  content,
  streaming = false,
  className,
  tone = "default",
  size = "default",
  allowHtml = false,
  readManagedImagePreviewDataUrl,
  readManagedVideoPreviewUrl,
  readLocalImagePreviewDataUrl,
  localImageBaseDir,
}: AgentMarkdownMessageProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionActive = streaming && !prefersReducedMotion;

  const streamBlocksCacheRef = useRef<StreamBlockCache | null>(null);
  const streamBlocks = useMemo(() => {
    if (!motionActive) {
      streamBlocksCacheRef.current = null;
      return [];
    }
    const next = parseStreamBlocksIncrementally(streamBlocksCacheRef.current, content);
    streamBlocksCacheRef.current = next;
    return next.blocks;
  }, [content, motionActive]);

  const lastBlockIndex = Math.max(0, streamBlocks.length - 1);
  const tailBlockLength = motionActive
    ? streamBlocks[lastBlockIndex]?.length ?? 0
    : 0;

  // Multi-block streaming: only the tail block animates new chars, so prev-length must
  // track the tail block (not the whole doc). Reset to 0 when a new tail block begins
  // (its content is entirely new) so its first chars animate; updated to the committed
  // tail length after each paint so subsequent growth only animates the delta.
  const frozenCharCountRef = useRef(0);
  const prevTailIndexRef = useRef(-1);
  if (motionActive && lastBlockIndex !== prevTailIndexRef.current) {
    prevTailIndexRef.current = lastBlockIndex;
    frozenCharCountRef.current = 0;
  }

  useLayoutEffect(() => {
    frozenCharCountRef.current = motionActive ? tailBlockLength : 0;
  }, [tailBlockLength, motionActive]);

  const streamBlockAnimateContext = useMemo(
    () => ({ lastBlockIndex, frozenCharCountRef }),
    [lastBlockIndex, frozenCharCountRef],
  );

  return (
    <StreamBlockAnimateContext.Provider value={streamBlockAnimateContext}>
      <SpiritStreamdownMarkdown
        content={content}
        streaming={streaming}
        className={className}
        tone={tone}
        size={size}
        allowHtml={allowHtml}
        readManagedImagePreviewDataUrl={readManagedImagePreviewDataUrl}
        readManagedVideoPreviewUrl={readManagedVideoPreviewUrl}
        readLocalImagePreviewDataUrl={readLocalImagePreviewDataUrl}
        localImageBaseDir={localImageBaseDir}
        BlockComponent={motionActive ? StreamingAnimateBlock : undefined}
        isAnimating={motionActive}
        animated={motionActive ? streamingAnimateOptions : false}
      />
    </StreamBlockAnimateContext.Provider>
  );
}

/**
 * Markdown 渲染是 props 的纯函数（content 字符串 + 稳定回调）；多轮流式期间每次轮询会重渲
 * 整个会话列表，未变消息若重跑 streamdown + shiki 高亮成本极高。按 props 浅比较跳过即可。
 */
export const AgentMarkdownMessage = memo(AgentMarkdownMessageImpl);

export type { MarkdownTone };
