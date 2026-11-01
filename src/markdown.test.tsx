/** @jsxImportSource react */
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownRenderer } from "./markdown";

describe("Sobes Markdown", () => {
  it("renders answer highlights across emphasis but preserves markers inside code", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        content={"[[m:Main **point**]] [[t:Term]] [[e:O(1)]] [[c:Warning]] `[[t:literal]]`"}
      />,
    );

    expect(html).toContain('<mark data-hl="m">Main <strong>point</strong></mark>');

    for (const kind of ["t", "e", "c"]) {
      expect(html).toContain(`data-hl="${kind}"`);
    }

    expect(html).toContain("<code>[[t:literal]]</code>");
  });

  it("renders GFM, code highlighting and both kinds of math delimiters", () => {
    const content =
      "| Name | Cost |\n| --- | --- |\n| map | O(1) |\n\n- [x] Ready\n\n```go\nfunc main() {}\n```\n\n\\(x^2\\)\n\n\\[y^2\\]";
    const html = renderToStaticMarkup(<MarkdownRenderer content={content} />);

    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("hljs-keyword");
    expect(html).toContain('class="katex"');
    expect(html).toContain("katex-display");
  });

  it("sanitizes optional HTML and never embeds a remote image", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer
        allowSafeHtml
        content={
          '<u>Underlined</u><img src="https://example.com/image.png" onerror="alert(1)"><script>alert(2)</script><iframe src="https://example.com"></iframe>'
        }
      />,
    );

    expect(html).toContain("<u>Underlined</u>");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<img");
  });

  it("trims partial streaming markers, keeps normal brackets and handles empty input", () => {
    expect(renderToStaticMarkup(<MarkdownRenderer isStreaming content="Text [[t" />)).not.toContain(
      "[[t",
    );

    expect(renderToStaticMarkup(<MarkdownRenderer content="a[b[0]]" />)).toContain("a[b[0]]");
    expect(renderToStaticMarkup(<MarkdownRenderer content={null} />)).toBe(
      '<div class="sobes-markdown"></div>',
    );
  });

  it("ships fonts inline instead of asking the frame to load local assets", async () => {
    const pkg = await Bun.file(
      new URL("../examples/bundles/meeting-library.json", import.meta.url),
    ).json();

    expect(pkg.ui.css).toContain("data:font/woff2;base64,");
    expect(pkg.ui.css).not.toContain("url(fonts/");
    expect(new TextEncoder().encode(JSON.stringify(pkg)).length).toBeLessThanOrEqual(
      32 * 1024 * 1024,
    );
  });
});
