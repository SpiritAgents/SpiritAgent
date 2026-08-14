import type { ComponentProps, HTMLAttributes, ImgHTMLAttributes, InputHTMLAttributes } from "react";
import { Streamdown, type Components } from "streamdown";
import { FONT_WEIGHT_MEDIUM, FONT_WEIGHT_NORMAL } from "@/lib/typography";

import { cn } from "@/lib/utils";

const markdownComponents = {
  h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      className={cn(
        `mt-3 mb-2 text-lg ${FONT_WEIGHT_MEDIUM} tracking-tight text-foreground first:mt-0`,
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className={cn(
        `mt-3 mb-1.5 text-base ${FONT_WEIGHT_MEDIUM} tracking-tight text-foreground first:mt-0`,
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className={cn(
        `mt-2 mb-1 text-sm ${FONT_WEIGHT_MEDIUM} text-foreground first:mt-0`,
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h4
      className={cn(
        `mt-2 mb-1 text-sm ${FONT_WEIGHT_NORMAL} text-foreground first:mt-0`,
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className={cn("mb-2 text-sm leading-relaxed text-foreground/95 last:mb-0", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn(
        "mb-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground/95 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn(
        "mb-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground/95 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => (
    <li className={cn("break-words", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn(
        "mb-2 border-l-2 border-muted-foreground/35 py-0.5 pl-3 text-sm leading-relaxed text-muted-foreground last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: HTMLAttributes<HTMLHRElement>) => (
    <hr className={cn("my-4 border-border/60", className)} {...props} />
  ),
  a: ({ className, href, children, ...props }: ComponentProps<"a">) => (
    <a
      className={cn(
        "break-words text-primary underline underline-offset-2 hover:opacity-90",
        className,
      )}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  strong: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
    <strong className={cn(`${FONT_WEIGHT_MEDIUM} text-foreground`, className)} {...props} />
  ),
  em: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
    <em className={cn("italic", className)} {...props} />
  ),
  del: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
    <del className={cn("line-through text-muted-foreground", className)} {...props} />
  ),
  img: ({ className, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) => (
    // Markdown renderer must pass through arbitrary image URLs.
    // oxlint-disable-next-line nextjs/no-img-element
    <img className={cn("my-2 max-w-full rounded-md", className)} alt={alt ?? ""} {...props} />
  ),
  code: ({ className, children, ...props }: HTMLAttributes<HTMLElement>) => (
    <code
      className={cn(
        "break-words font-mono text-[0.85em] leading-relaxed text-foreground",
        "rounded-md border border-border/40 bg-muted/60 px-1 py-px",
        "[pre>&]:m-0 [pre>&]:block [pre>&]:w-full [pre>&]:max-w-none [pre>&]:rounded-none [pre>&]:border-0 [pre>&]:bg-transparent [pre>&]:p-0 [pre>&]:text-xs [pre>&]:whitespace-pre",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ className, children, ...props }: HTMLAttributes<HTMLPreElement>) => (
    <pre
      className={cn(
        "mb-2 max-w-full overflow-x-auto rounded-md border border-border/40 bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground last:mb-0",
        className,
      )}
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) => (
    <div className="my-2 max-w-full overflow-x-auto last:mb-0">
      <table
        className={cn(
          "w-full min-w-[12rem] border-collapse border border-border/50 text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className={cn("bg-muted/40", className)} {...props} />
  ),
  th: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className={cn(
        `border border-border/50 px-2 py-1.5 text-left ${FONT_WEIGHT_NORMAL} text-foreground`,
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) => (
    <td
      className={cn("border border-border/50 px-2 py-1.5 align-top text-foreground/95", className)}
      {...props}
    />
  ),
  tr: ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
    <tr className={className} {...props} />
  ),
  input: ({ type, className, ...props }: InputHTMLAttributes<HTMLInputElement>) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          readOnly
          className={cn("mr-1.5 align-middle", className)}
          {...props}
        />
      );
    }
    return <input type={type} className={className} {...props} />;
  },
} as Components;

export function MarkdownMessage({
  content,
  className,
  streaming = false,
}: {
  content: string;
  className?: string;
  streaming?: boolean;
}) {
  return (
    <Streamdown
      className={cn("min-w-0 break-words text-foreground/95", className)}
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown={streaming}
      components={markdownComponents}
    >
      {content}
    </Streamdown>
  );
}
