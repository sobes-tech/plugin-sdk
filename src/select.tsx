/** @jsxImportSource react */
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  /** Plain text for typeahead when the label contains more than text. */
  textValue?: string;
}

export interface SelectProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "defaultValue" | "value" | "name" | "form" | "type" | "onChange" | "dir"
> {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: ReactNode;
  name?: string;
  form?: string;
  required?: boolean;
  dir?: "ltr" | "rtl";
  onOpenChange?: (open: boolean) => void;
  children?: never;
  onChange?: never;
  multiple?: never;
  size?: never;
}

/** Single selection rendered inside the plugin document, including its popup. */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  {
    options,
    value,
    defaultValue = "",
    onValueChange,
    placeholder = "Select…",
    name,
    form,
    required,
    disabled,
    dir,
    onOpenChange,
    className,
    id: suppliedId,
    multiple,
    size,
    ...triggerProps
  },
  forwardedRef,
) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const trigger = useRef<HTMLButtonElement | null>(null);
  const initialValue = useRef(defaultValue);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [reservedHeight, setReservedHeight] = useState(0);
  const openingViewport = useRef({ width: 0, height: 0 });
  const openingSequence = useRef(0);
  const pointerPressed = useRef(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>();
  const unavailable = disabled || !options.length;
  const selectedValue = value ?? uncontrolledValue;
  const selected = options.find((option) => option.value === selectedValue);
  const [inheritedDirection, setInheritedDirection] = useState<"ltr" | "rtl">("ltr");
  const values = new Set(options.map((option) => option.value));

  if (options.some((option) => !option.value) || values.size !== options.length) {
    throw new Error("Select options must have unique, nonempty string values");
  }

  if (multiple !== undefined || size !== undefined) {
    throw new Error("Select supports single selection only; multiple and size are not supported");
  }

  useEffect(
    () => () => {
      openingSequence.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!dir && trigger.current) {
      setInheritedDirection(getComputedStyle(trigger.current).direction === "rtl" ? "rtl" : "ltr");
    }
  }, [dir]);

  useEffect(() => {
    if (unavailable && (open || pendingOpen)) {
      openingSequence.current += 1;
      setPendingOpen(false);
      setOpen(false);
      setReservedHeight(0);

      if (open) {
        onOpenChange?.(false);
      }
    }
  }, [unavailable, open, pendingOpen, onOpenChange]);

  useEffect(() => {
    const owner = trigger.current?.form;

    if (!owner || value !== undefined) {
      return;
    }

    const reset = (event: Event) => {
      queueMicrotask(() => {
        if (!event.defaultPrevented) {
          setUncontrolledValue(initialValue.current);
        }
      });
    };

    owner.addEventListener("reset", reset);

    return () => owner.removeEventListener("reset", reset);
  }, [value, form]);

  useLayoutEffect(() => {
    if (!pendingOpen || unavailable) {
      return;
    }

    const button = trigger.current;
    const window = button?.ownerDocument.defaultView;

    if (!button || !window) {
      return;
    }

    const sequence = openingSequence.current;
    const document = button.ownerDocument;
    let frame = 0;
    let active = true;
    let layoutReady = false;

    const cancel = () => {
      openingSequence.current += 1;
      pointerPressed.current = false;
      setPendingOpen(false);
      setReservedHeight(0);
    };

    const finish = () => {
      layoutReady = true;

      if (pointerPressed.current) {
        return;
      }

      window.clearTimeout(fallback);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      frame = window.requestAnimationFrame(() => {
        if (!active || openingSequence.current !== sequence) {
          return;
        }

        setPendingOpen(false);
        setOpen(true);
        onOpenChange?.(true);
      });
    };

    const resize = () => {
      if (window.innerWidth !== openingViewport.current.width) {
        cancel();
      } else if (window.innerHeight > openingViewport.current.height) {
        finish();
      }
    };

    const pointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof window.Node) || !button.contains(event.target)) {
        cancel();
      }
    };

    const pointerUp = () => {
      pointerPressed.current = false;

      if (layoutReady) {
        finish();
      }
    };

    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };

    // Reserve while the Radix popup is still unmounted: Radix intentionally
    // closes on window resize, including a host resizing this iframe.
    const fallback = window.setTimeout(finish, 120);

    window.addEventListener("resize", resize);
    window.addEventListener("blur", cancel);
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("pointerup", pointerUp, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("keydown", keyDown, true);

    if (window.innerHeight > openingViewport.current.height) {
      finish();
    }

    return () => {
      active = false;
      window.clearTimeout(fallback);

      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("pointerup", pointerUp, true);
      document.removeEventListener("pointercancel", cancel, true);
      document.removeEventListener("keydown", keyDown, true);
    };
  }, [pendingOpen, unavailable, onOpenChange]);

  return (
    <span
      className="sobes-select-root"
      onInvalidCapture={(event) => {
        // The hidden text value validates, but focus and feedback belong to the
        // visible React trigger. Native select menus are never involved.
        event.preventDefault();
        trigger.current?.focus();
      }}
    >
      <SelectPrimitive.Root
        value={selectedValue}
        onValueChange={(next) => {
          if (unavailable) {
            return;
          }

          if (value === undefined) {
            setUncontrolledValue(next);
          }

          onValueChange?.(next);
        }}
        disabled={unavailable}
        dir={dir ?? inheritedDirection}
        open={open && !unavailable}
        onOpenChange={(next) => {
          if (next && unavailable) {
            return;
          }

          if (!next) {
            openingSequence.current += 1;
            pointerPressed.current = false;
            setPendingOpen(false);
            setReservedHeight(0);
            setOpen(false);
            onOpenChange?.(false);

            return;
          }

          if (pendingOpen) {
            openingSequence.current += 1;
            setPendingOpen(false);
            setReservedHeight(0);

            return;
          }

          if (trigger.current) {
            const style = getComputedStyle(trigger.current);

            setPopupStyle({
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
            });

            if (!dir) {
              setInheritedDirection(style.direction === "rtl" ? "rtl" : "ltr");
            }

            const rowHeight = Math.max(32, (Number.parseFloat(style.lineHeight) || 20) + 14);
            const menuHeight = Math.min(320, options.length * rowHeight + 8);
            const rect = trigger.current.getBoundingClientRect();
            const window = trigger.current.ownerDocument.defaultView!;
            const available = Math.max(rect.top - 8, window.innerHeight - rect.bottom - 12);

            if (available < menuHeight) {
              openingSequence.current += 1;
              openingViewport.current = { width: window.innerWidth, height: window.innerHeight };
              setReservedHeight(menuHeight + 24);
              setPendingOpen(true);

              return;
            }
          }

          setOpen(true);
          onOpenChange?.(true);
        }}
      >
        <SelectPrimitive.Trigger
          {...triggerProps}
          id={id}
          form={form}
          aria-required={required || undefined}
          onPointerDown={(event) => {
            triggerProps.onPointerDown?.(event);

            if (!event.defaultPrevented && event.button === 0) {
              pointerPressed.current = true;
            }
          }}
          onKeyDown={(event) => {
            pointerPressed.current = false;
            triggerProps.onKeyDown?.(event);
          }}
          className={["sobes-input", "sobes-select", className].filter(Boolean).join(" ")}
          ref={(node) => {
            trigger.current = node;

            if (typeof forwardedRef === "function") {
              forwardedRef(node);
            } else if (forwardedRef) {
              forwardedRef.current = node;
            }
          }}
        >
          <SelectPrimitive.Value placeholder={placeholder}>{selected?.label}</SelectPrimitive.Value>
          <SelectPrimitive.Icon asChild>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="m4 6 4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            collisionPadding={8}
            className="sobes-select-content"
            aria-labelledby={id}
            style={popupStyle}
          >
            <SelectPrimitive.ScrollUpButton className="sobes-select-scroll" aria-hidden="true">
              ⌃
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="sobes-select-viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  textValue={option.textValue}
                  className="sobes-select-option"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="sobes-select-check" aria-hidden="true">
                    ✓
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="sobes-select-scroll" aria-hidden="true">
              ⌄
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      <input
        type="text"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        form={form}
        required={required}
        disabled={unavailable}
        value={selected?.value ?? ""}
        onChange={() => {}}
      />
      {(open || pendingOpen) && !unavailable && reservedHeight > 0 && (
        <span
          aria-hidden="true"
          className="sobes-select-space"
          style={{ height: reservedHeight }}
        />
      )}
    </span>
  );
});
