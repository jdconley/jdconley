const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

let activeCleanup = null;

export function openDialog(trigger, dialog) {
  if (!dialog || dialog.open) return;
  const page = document.querySelector("main");
  const previousOverflow = document.body.style.overflow;

  dialog.setAttribute("aria-modal", "true");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  document.body.style.overflow = "hidden";
  if (page && "inert" in page) page.inert = true;

  const controls = () => [...dialog.querySelectorAll(focusableSelector)].filter((node) => node.getClientRects().length > 0);
  const firstMeaningful = dialog.querySelector("input:not([disabled]), button:not(.dialog-close):not([disabled]), [href]") || controls()[0];

  const close = () => {
    if (!dialog.open && !dialog.hasAttribute("open")) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    document.body.style.overflow = previousOverflow;
    if (page && "inert" in page) page.inert = false;
    activeCleanup?.();
    activeCleanup = null;
    trigger?.focus();
  };

  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const items = controls();
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const onClick = (event) => { if (event.target === dialog) close(); };
  const onCancel = (event) => { event.preventDefault(); close(); };
  const closeButtons = [...dialog.querySelectorAll(".dialog-close, .dialog-close-action")];
  dialog.addEventListener("keydown", onKeydown);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("cancel", onCancel);
  closeButtons.forEach((button) => button.addEventListener("click", close));

  activeCleanup = () => {
    dialog.removeEventListener("keydown", onKeydown);
    dialog.removeEventListener("click", onClick);
    dialog.removeEventListener("cancel", onCancel);
    closeButtons.forEach((button) => button.removeEventListener("click", close));
  };
  requestAnimationFrame(() => firstMeaningful?.focus());
}
