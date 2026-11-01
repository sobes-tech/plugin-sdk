/** @jsxImportSource react */
import { memo, type CSSProperties } from "react";
import Markdown, { type Components, type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import {
  normalizeMathDelimiters,
  rehypeRawLineBreaks,
  remarkAnswerHighlights,
  trimPartialAnswerHighlight,
} from "./markdown-core";
import "katex/dist/katex.min.css";
import "./markdown.css";

export interface MarkdownRendererProps {
  content: string | string[] | null | undefined;
  answerHighlights?: boolean;
  isStreaming?: boolean;
  allowSafeHtml?: boolean;
  className?: string;
  style?: CSSProperties;
  componentOverrides?: Partial<Components>;
  /** Explicit host API callback, e.g. app.openExternal (requires app.openExternal permission). */
  onOpenLink?: (url: string) => void;
}
const normalRemarks = [remarkGfm, remarkMath];
const answerRemarks = [...normalRemarks, remarkAnswerHighlights];
const safeHtmlSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "mark", "caption", "colgroup", "col"],
  attributes: { ...defaultSchema.attributes, col: ["span"], colgroup: ["span"], mark: ["dataHl"] },
  strip: [...(defaultSchema.strip ?? []), "style"],
};
const highlighting: NonNullable<Options["rehypePlugins"]> = [
  [rehypeKatex, { strict: "ignore", trust: false }],
  [rehypeHighlight, { detect: false }],
];
const normalRehype: NonNullable<Options["rehypePlugins"]> = [rehypeRawLineBreaks, ...highlighting];
const htmlRehype: NonNullable<Options["rehypePlugins"]> = [
  rehypeRaw,
  [rehypeSanitize, safeHtmlSchema],
  ...highlighting,
];

/** Sobes Markdown: GFM, code, math and [[m/t/e/c:…]] answer highlights, inside the plugin sandbox. */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  answerHighlights = true,
  isStreaming = false,
  allowSafeHtml = false,
  className,
  style,
  componentOverrides,
  onOpenLink,
}: MarkdownRendererProps) {
  const text = Array.isArray(content) ? content.join("") : (content ?? "");
  const value = normalizeMathDelimiters(
    answerHighlights && isStreaming ? trimPartialAnswerHighlight(text) : text,
  );
  const components: Components = {
    a: ({ children, href }) => (
      <a
        href={href}
        title={href}
        onClick={(event) => {
          event.preventDefault();

          if (href) {
            onOpenLink?.(href);
          }
        }}
      >
        {children}
      </a>
    ),
    // Remote images cannot bypass permissions. Authors can provide screenshot data URLs.
    img: ({ src, alt }) =>
      src && /^(?:data:image\/(?:png|jpeg|gif|webp);base64,|blob:)/i.test(src) ? (
        <img src={src} alt={alt ?? ""} />
      ) : (
        <span className="sobes-markdown-image-alt">{alt ?? ""}</span>
      ),
    table: ({ children }) => (
      <div className="sobes-markdown-table">
        <table>{children}</table>
      </div>
    ),
    ...componentOverrides,
  };

  return (
    <div className={["sobes-markdown", className].filter(Boolean).join(" ")} style={style}>
      <Markdown
        remarkPlugins={answerHighlights ? answerRemarks : normalRemarks}
        rehypePlugins={allowSafeHtml ? htmlRehype : normalRehype}
        components={components}
      >
        {value}
      </Markdown>
    </div>
  );
});

export const MarkdownRendererExtended = MarkdownRenderer;
