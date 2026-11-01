// Shared with the Sobes desktop renderer.
const answerHighlightTokenPattern = () => /\[\[([mtec]):|\]\]/g;

// Подсветка главного в ответах Copilot: `[[m:…]]` → `<mark data-hl="m">`. Строковый тег, а не
// React-компонент: fade-in стриминга (animateNewWords) и подсчёт слов обходят только такие.
// Маркер действует в пределах одного родителя (абзац, ячейка, пункт списка); незакрытый —
// подсвечивает до конца родителя, так ответ выглядит и во время стриминга.
type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

const SKIPPED = new Set(["code", "inlineCode", "math", "inlineMath", "html"]);

const highlightNode = (kind: string): MdNode => ({
  type: "answerHighlight",
  data: { hName: "mark", hProperties: { dataHl: kind } },
  children: [],
});

function transformChildren(parent: MdNode): void {
  if (!parent.children || SKIPPED.has(parent.type)) {
    return;
  }

  const result: MdNode[] = [];
  let open: MdNode | null = null;
  const push = (node: MdNode) => (open ? open.children!.push(node) : result.push(node));

  for (const child of parent.children) {
    if (child.type !== "text" || (!child.value?.includes("[[") && !child.value?.includes("]]"))) {
      transformChildren(child);
      push(child);
      continue;
    }

    const value = child.value;
    const pattern = answerHighlightTokenPattern();
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(value)) !== null) {
      const isClose = match[0] === "]]";

      // Непарная `]]` — обычный текст (`a[b[0]]`); вложенный маркер снимается без подсветки.
      if (isClose && !open) {
        continue;
      }

      if (match.index > last) {
        push({ type: "text", value: value.slice(last, match.index) });
      }

      last = match.index + match[0].length;

      if (isClose) {
        open = null;
      } else if (!open) {
        const node = highlightNode(match[1]!);

        result.push(node);
        open = node;
      }
    }

    if (last < value.length) {
      push({ type: "text", value: value.slice(last) });
    }
  }

  parent.children = result;
}

export const remarkAnswerHighlights = () => (tree: MdNode) => transformChildren(tree);

// Пока ответ стримится, начало маркера (`[[`, `[[m`) приходит раньше двоеточия — не мигать им.
const PARTIAL_OPEN_AT_END = /\[\[[mtec]?$/;

export const trimPartialAnswerHighlight = (content: string): string =>
  content.replace(PARTIAL_OPEN_AT_END, "");

type HtmlTreeNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HtmlTreeNode[];
};

const LINE_BREAK_TAG = /<\/?br\s*\/?>/i;
const LINE_BREAK_TAGS = /<\/?br\s*\/?>/gi;
const NON_LINE_BREAK_TAG = /<(?!\/?br\s*\/?>)[a-z!/]/i;

const isLineBreakRaw = (node: HtmlTreeNode): boolean =>
  node.type === "raw" &&
  LINE_BREAK_TAG.test(node.value ?? "") &&
  !NON_LINE_BREAK_TAG.test(node.value ?? "");

// `<br>` в начале строки открывает HTML-блок до пустой строки: `"<br>\nтекст"` — одна raw-нода.
const splitLineBreakRaw = (value: string): HtmlTreeNode[] =>
  value
    .split(LINE_BREAK_TAGS)
    .flatMap((text, index) => [
      ...(index > 0 ? [{ type: "element", tagName: "br", properties: {}, children: [] }] : []),
      ...(text ? [{ type: "text", value: text }] : []),
    ]);

const replaceRawLineBreaks = (node: HtmlTreeNode): void => {
  if (!node.children) {
    return;
  }

  const rawChildren = node.children.filter((child) => child.type === "raw");
  const convertLineBreaks = rawChildren.length > 0 && rawChildren.every(isLineBreakRaw);

  node.children = node.children.flatMap((child) => {
    if (child.type === "raw") {
      return convertLineBreaks ? splitLineBreakRaw(child.value ?? "") : [child];
    }

    replaceRawLineBreaks(child);

    return [child];
  });
};

export const rehypeRawLineBreaks = () => replaceRawLineBreaks;

const CODE_SEGMENT_SPLIT = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g;

export const normalizeMathDelimiters = (content: string): string => {
  if (!content.includes("\\[") && !content.includes("\\(")) {
    return content;
  }

  return content
    .split(CODE_SEGMENT_SPLIT)
    .map((segment, i) => {
      if (i % 2 === 1) {
        return segment;
      } // код-блоки не трогаем

      return segment
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr: string) => `\n$$\n${expr.trim()}\n$$\n`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr: string) => `$${expr.trim()}$`);
    })
    .join("");
};
