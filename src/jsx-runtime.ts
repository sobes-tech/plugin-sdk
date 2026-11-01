import type { JsonObject, JsonValue, PluginBlock, PluginElementTag } from "./index";

export type Child = PluginBlock | string | number | boolean | null | undefined | Child[];

export type ElementProps = Record<string, JsonValue | Child | undefined>;

export type Component = (props: ElementProps & { children?: Child }) => PluginBlock;

function children(value: Child): PluginBlock[] {
  if (Array.isArray(value)) {
    return value.flatMap(children);
  }

  if (value == null || typeof value === "boolean") {
    return [];
  }

  if (typeof value === "string" || typeof value === "number") {
    return [{ type: "text", text: String(value) }];
  }

  return [value];
}

export function jsx(type: PluginElementTag | Component, values: ElementProps | null): PluginBlock {
  const props = values ?? {};

  if (typeof type === "function") {
    return type(props);
  }

  const { children: child, ...attributes } = props;

  // JSON data only: event handlers are named actions, never host JS closures.
  for (const value of Object.values(attributes)) {
    if (typeof value === "function") {
      throw new Error("Use action names for plugin events");
    }
  }

  return {
    type: "element",
    tag: type,
    props: attributes as JsonObject,
    children: children(child as Child),
  };
}

export const jsxs = jsx;

export const jsxDEV = jsx;

export const Fragment: Component = (props) => jsx("stack", props);

export namespace JSX {
  export type Element = PluginBlock;

  export interface ElementChildrenAttribute {
    children: unknown;
  }

  export type IntrinsicElements = { [Tag in PluginElementTag]: ElementProps };
}
