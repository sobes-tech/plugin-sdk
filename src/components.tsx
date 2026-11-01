/** @jsxImportSource react */
import {
  cloneElement,
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import "./components.css";

export { Select, type SelectOption, type SelectProps } from "./select";

const classes = (...values: (string | undefined | false)[]) => values.filter(Boolean).join(" ");

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

type BlockProps = HTMLAttributes<HTMLDivElement>;

export function Page({
  width = "content",
  className,
  ...props
}: BlockProps & { width?: "content" | "full" }) {
  return (
    <div
      className={classes("sobes-page", width === "full" && "sobes-page-full", className)}
      {...props}
    />
  );
}

export function Stack({ gap = 16, className, style, ...props }: BlockProps & { gap?: number }) {
  return <div className={classes("sobes-stack", className)} style={{ gap, ...style }} {...props} />;
}

export function Row({
  gap = 8,
  wrap = true,
  className,
  style,
  ...props
}: BlockProps & { gap?: number; wrap?: boolean }) {
  return (
    <div
      className={classes("sobes-row", className)}
      style={{ gap, flexWrap: wrap ? "wrap" : "nowrap", ...style }}
      {...props}
    />
  );
}

export function Grid({
  columns = 2,
  gap = 16,
  className,
  style,
  ...props
}: BlockProps & { columns?: number; gap?: number }) {
  return (
    <div
      className={classes("sobes-grid", className)}
      style={
        { "--sobes-columns": Math.max(1, Math.min(6, columns)), gap, ...style } as CSSProperties
      }
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={classes("sobes-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: BlockProps) {
  return <div className={classes("sobes-card-header", className)} {...props} />;
}

export function CardContent({ className, ...props }: BlockProps) {
  return <div className={classes("sobes-card-content", className)} {...props} />;
}

export function Heading({
  level = 2,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 | 4 }) {
  const Tag = level === 1 ? "h1" : level === 2 ? "h2" : level === 3 ? "h3" : "h4";

  return (
    <Tag className={classes("sobes-heading", "sobes-heading-" + level, className)} {...props} />
  );
}

export function Text({
  muted = false,
  small = false,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { muted?: boolean; small?: boolean }) {
  return (
    <p
      className={classes("sobes-text", muted && "sobes-muted", small && "sobes-small", className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={classes("sobes-page-header", className)} {...props}>
      <Stack gap={6}>
        <Heading level={1}>{title}</Heading>
        {description && <Text muted>{description}</Text>}
      </Stack>
      {actions && <Row>{actions}</Row>}
    </header>
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  busy?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    busy,
    disabled,
    className,
    type = "button",
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={classes(
        "sobes-button",
        "sobes-button-" + variant,
        "sobes-button-" + size,
        className,
      )}
      {...props}
    >
      {busy && <Spinner label="" />} {children}
    </button>
  );
});

export function Pill({
  tone = "neutral",
  onRemove,
  removeLabel = "Remove",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className={classes("sobes-pill", "sobes-tone-" + tone, className)} {...props}>
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="sobes-pill-remove"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={classes("sobes-badge", "sobes-tone-" + tone, className)} {...props} />;
}

export function TogglePill({
  selected,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={classes("sobes-toggle-pill", className)}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={classes("sobes-input", className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={classes("sobes-input", "sobes-textarea", className)}
      {...props}
    />
  );
});

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type">
>(function Checkbox({ className, ...props }, ref) {
  return (
    <input ref={ref} type="checkbox" className={classes("sobes-checkbox", className)} {...props} />
  );
});

export function Switch({
  checked,
  onCheckedChange,
  className,
  onClick,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "role"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={classes("sobes-switch", className)}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          onCheckedChange(!checked);
        }
      }}
      {...props}
    >
      <span />
    </button>
  );
}

export function Field({
  label,
  description,
  error,
  children,
  controlId,
  className,
  ...props
}: Omit<BlockProps, "children"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  controlId?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}) {
  const generatedId = useId();
  const id = controlId ?? children.props.id ?? generatedId;
  const hint = error || description;

  return (
    <div className={classes("sobes-field", className)} {...props}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        "aria-describedby":
          classes(children.props["aria-describedby"], !!hint && id + "-hint") || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })}
      {hint && (
        <div
          id={id + "-hint"}
          className={classes("sobes-small", error ? "sobes-error" : "sobes-muted")}
          role={error ? "alert" : undefined}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

export function Separator({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={classes("sobes-separator", className)} {...props} />;
}

export function Spinner({
  label = "Loading",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { label?: string }) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label || undefined}
      aria-hidden={!label || undefined}
      className={classes("sobes-spinner", className)}
      {...props}
    />
  );
}

export function Progress({
  value,
  label,
  max = 100,
}: {
  value: number;
  max?: number;
  label: string;
}) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;

  return (
    <progress
      className="sobes-progress"
      max={safeMax}
      value={Number.isFinite(value) ? Math.min(safeMax, Math.max(0, value)) : 0}
      aria-label={label}
    />
  );
}

export function EmptyState({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classes("sobes-empty", className)}>
      {icon && <div aria-hidden="true">{icon}</div>}
      <Heading level={3}>{title}</Heading>
      {description && <Text muted>{description}</Text>}
      {actions && <Row>{actions}</Row>}
    </div>
  );
}

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  content?: ReactNode;
}

export function Tabs({
  items,
  value,
  onValueChange,
  label = "Tabs",
  className,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  const id = useId();
  const active =
    items.find((item) => item.value === value && !item.disabled) ??
    items.find((item) => !item.disabled);

  return (
    <div className={classes("sobes-tabs", className)}>
      <div
        role="tablist"
        aria-label={label}
        className="sobes-tab-list"
        onKeyDown={(event) => {
          const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];

          if (!keys.includes(event.key)) {
            return;
          }

          const enabled = items.filter((item) => !item.disabled);

          if (!enabled.length) {
            return;
          }

          const current = enabled.findIndex((item) => item.value === active?.value);
          const index =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? enabled.length - 1
                : (current + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) %
                  enabled.length;

          event.preventDefault();
          onValueChange(enabled[index].value);
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="tab"]:not(:disabled)',
          );

          buttons[index]?.focus();
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={id + "-tab-" + index}
            aria-selected={active?.value === item.value}
            aria-controls={item.content !== undefined ? id + "-panel-" + index : undefined}
            tabIndex={active?.value === item.value ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            {item.label}
          </button>
        ))}
      </div>
      {items.map(
        (item, index) =>
          item.content !== undefined && (
            <div
              key={item.value}
              role="tabpanel"
              id={id + "-panel-" + index}
              aria-labelledby={id + "-tab-" + index}
              hidden={active?.value !== item.value}
              tabIndex={0}
            >
              {item.content}
            </div>
          ),
      )}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="sobes-table-scroll">
      <table className={classes("sobes-table", className)} {...props} />
    </div>
  );
}

export { MarkdownRenderer, MarkdownRendererExtended, type MarkdownRendererProps } from "./markdown";
