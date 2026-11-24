import { useEffect, useRef, type ReactNode } from "react";

export function AccountDialog({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);
  return <dialog ref={dialog} className="account-dialog" aria-label={title} onCancel={event => {
    event.preventDefault();
    onClose();
  }}>
    <button type="button" className="account-close" aria-label="Close dialog" onClick={onClose}>×</button>
    <h2>{title}</h2>
    {children}
  </dialog>;
}
