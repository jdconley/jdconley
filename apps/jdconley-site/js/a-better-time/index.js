import { openDialog } from "./dialog.js";

document.querySelectorAll("[data-open-dialog]").forEach((trigger) => {
  trigger.addEventListener("click", () => openDialog(trigger, document.getElementById(trigger.dataset.openDialog)));
});

document.querySelector("[data-copy-share]")?.addEventListener("click", async (event) => {
  const feedback = event.currentTarget.parentElement.querySelector(".dialog-feedback");
  try {
    await navigator.clipboard.writeText(window.location.href);
    feedback.textContent = "Link copied.";
  } catch {
    feedback.textContent = "Copy the address from your browser to share.";
  }
});
