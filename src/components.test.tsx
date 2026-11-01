/** @jsxImportSource react */
import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, Button, Field, Input, Pill, Select, Tabs, TogglePill } from "./components";

describe("React components", () => {
  it("labels fields and links validation messages to the input", () => {
    const html = renderToStaticMarkup(
      <Field label="Title" error="Required" controlId="title">
        <Input />
      </Field>,
    );

    expect(html).toContain('for="title"');
    expect(html).toContain('id="title"');
    expect(html).toContain('aria-describedby="title-hint"');
    expect(html).toContain('aria-invalid="true"');
  });

  it("keeps button and pill actions accessible", () => {
    const html = renderToStaticMarkup(
      <>
        <Button busy>Save</Button>
        <Pill tone="success" onRemove={() => {}} removeLabel="Remove filter">
          Ready
        </Pill>
        <TogglePill selected>Selected</TogglePill>
        <Badge>New</Badge>
      </>,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Remove filter"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("sobes-tone-success");
  });

  it("connects tabs to their panels and retains inactive content", () => {
    const html = renderToStaticMarkup(
      <Tabs
        value="one"
        onValueChange={() => {}}
        items={[
          { value: "one", label: "First", content: <p>One</p> },
          { value: "two", label: "Second", content: <p>Two</p> },
        ]}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('hidden=""');
  });

  it("renders a labeled React select trigger and keeps native form machinery hidden", () => {
    const html = renderToStaticMarkup(
      <Field label="Category" controlId="category" error="Choose a category">
        <Select
          name="category"
          required
          defaultValue="notes"
          options={[
            { value: "notes", label: "Notes" },
            { value: "meetings", label: "Meetings" },
          ]}
        />
      </Field>,
    );

    expect(html).toContain('<button type="button" role="combobox"');
    expect(html).toContain('id="category"');
    expect(html).toContain('for="category"');
    expect(html).toContain('aria-describedby="category-hint"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Notes");
    const input = html.match(/<input[^>]+>/)?.[0] ?? "";

    for (const attribute of [
      'type="text"',
      'hidden=""',
      'aria-hidden="true"',
      'tabindex="-1"',
      'name="category"',
      'required=""',
      'value="notes"',
    ]) {
      expect(input).toContain(attribute);
    }
  });

  it("shows a placeholder until selected and rejects ambiguous option values", () => {
    const html = renderToStaticMarkup(
      <Select placeholder="Choose a category" options={[{ value: "notes", label: "Notes" }]} />,
    );

    expect(html).toContain("Choose a category");
    expect(html).toContain('data-placeholder=""');
    expect(html).toContain('value=""');
    expect(() =>
      renderToStaticMarkup(<Select options={[{ value: "", label: "Empty" }]} />),
    ).toThrow("nonempty");

    expect(() =>
      renderToStaticMarkup(
        <Select
          options={[
            { value: "same", label: "One" },
            { value: "same", label: "Two" },
          ]}
        />,
      ),
    ).toThrow("unique");
  });

  it("keeps an initially empty required form value empty and associates external forms", () => {
    const html = renderToStaticMarkup(
      <Select
        form="outside"
        name="category"
        required
        placeholder="Choose"
        options={[{ value: "notes", label: "Notes" }]}
      />,
    );
    const input = html.match(/<input[^>]+>/)?.[0] ?? "";
    const trigger = html.match(/<button[^>]+>/)?.[0] ?? "";

    for (const attribute of ['name="category"', 'form="outside"', 'required=""', 'value=""']) {
      expect(input).toContain(attribute);
    }

    expect(trigger).toContain('form="outside"');
    expect(html).not.toContain('<select aria-hidden="true" required=');
  });
});
