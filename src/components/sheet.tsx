"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useI18n } from "@/lib/i18n";

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  fullScreen?: boolean;
  busy?: boolean;
  returnFocus?: RefObject<HTMLElement | null>;
};

export function Sheet({
  title,
  children,
  onClose,
  fullScreen = false,
  busy = false,
  returnFocus,
}: Props) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = returnFocus?.current ?? document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [returnFocus]);

  function close() {
    if (busy) return;
    if (
      dialog.current?.querySelector('form[data-dirty="true"]') &&
      !window.confirm(t("Discard your unsaved changes?"))
    ) {
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={`app-sheet ${fullScreen ? "app-sheet-full" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="sheet-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Close {{title}}", { title })}
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className="sheet-content">{children}</div>
    </dialog>
  );
}
