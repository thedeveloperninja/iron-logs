import { useEffect, useRef, useState, type ReactNode } from "react";

/** Bottom sheet on phones, centered dialog on wide screens. Esc or tapping outside closes it. */
export function Sheet({ title, onClose, children, actions }: {
  title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        <div className="sheet-h">
          <h3 className="grow">{title}</h3>
          {actions}
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sheet-b">{children}</div>
      </div>
    </div>
  );
}

/** Inline two-step confirmation (the app never uses browser confirm dialogs). */
export function ConfirmButton({ label, confirmLabel, question, onConfirm, className = "btn ghost danger", disabled }: {
  label: string; confirmLabel: string; question: string; onConfirm: () => void; className?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <span className="confirm" role="group">
      <span>{question}</span>
      <button type="button" className="btn small danger" onClick={() => { setOpen(false); onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="btn small" onClick={() => setOpen(false)}>Cancel</button>
    </span>
  );
}

