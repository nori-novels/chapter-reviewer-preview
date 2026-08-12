"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import styles from "./glossaryReview.module.css";

export interface GlossarySelectOption<T extends string> {
  value: T;
  label: string;
}

export interface GlossarySelectControl {
  focus: (options?: FocusOptions) => void;
}

export interface GlossarySelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly GlossarySelectOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
  ref?: Ref<GlossarySelectControl>;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
}

// Listbox trigger with the small solid triangle affordance. The menu is
// portalled into the owning dialog so it escapes the table's scroll clipping.
export function GlossarySelect<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
  ref,
}: GlossarySelectProps<T>) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [ownerDialog, setOwnerDialog] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<MenuPosition>({ left: 0, top: 0, width: 0 });

  useImperativeHandle(ref, () => ({
    focus: (focusOptions) => triggerRef.current?.focus(focusOptions),
  }), []);

  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const placeMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const width = Math.max(150, rect.width);
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    const below = rect.bottom + 6;
    const top = menuHeight > 0 && below + menuHeight > window.innerHeight - 8
      ? Math.max(8, rect.top - menuHeight - 6)
      : below;
    setPosition({ left: Math.max(8, left), top, width });
  }, []);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setOwnerDialog(null);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const show = useCallback((index = selectedIndex) => {
    if (disabled || options.length === 0) return;
    const dialog = triggerRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    setActiveIndex(index);
    setOwnerDialog(dialog);
    setOpen(true);
  }, [disabled, options.length, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const reposition = () => placeMenu();
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", dismiss, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", dismiss, true);
    };
  }, [close, open, placeMenu]);

  useEffect(() => {
    if (open) requestAnimationFrame(placeMenu);
  }, [open, placeMenu]);

  useEffect(() => {
    if (!disabled) return;
    const frame = requestAnimationFrame(() => close());
    return () => cancelAnimationFrame(frame);
  }, [close, disabled]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close(true);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        show(event.key === "ArrowUp" ? options.length - 1 : selectedIndex);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + delta + options.length) % options.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close();
    }
  }

  const selected = options[selectedIndex];
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className={styles.selectTrigger}
        aria-label={`${label}: ${selected?.label ?? value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        {...(open ? { "aria-activedescendant": optionId(activeIndex) } : {})}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label ?? value}</span>
        <span className={styles.selectTriangle} data-select-triangle="" aria-hidden="true" />
      </button>
      {open && ownerDialog && createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          className={styles.selectMenu}
          style={position}
        >
          {options.map((option, index) => (
            <div
              id={optionId(index)}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex}
              className={styles.selectOption}
              onMouseEnter={() => setActiveIndex(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>,
        ownerDialog,
      )}
    </>
  );
}
