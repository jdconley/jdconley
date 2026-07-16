import { openDialog } from "./dialog.js";
import { SHARE_IMAGE_VERSION } from "./share-image-version.js";

function imageUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = "/a-better-time/share.png";
  parsed.searchParams.set("v", SHARE_IMAGE_VERSION);
  return parsed.href;
}

export function createShareController({ trigger, dialog, getUrl, navigatorImpl = navigator }) {
  const preview = dialog.querySelector("[data-share-preview]");
  const download = dialog.querySelector("[data-download-share]");
  const copy = dialog.querySelector("[data-copy-share]");
  const feedback = dialog.querySelector(".dialog-feedback");
  const imageError = dialog.querySelector("[data-share-error]");

  function prepare(url) {
    const image = imageUrl(url);
    preview.src = image;
    download.href = image;
    imageError.textContent = "";
  }

  trigger.addEventListener("click", async () => {
    const url = getUrl();
    if (typeof navigatorImpl.share === "function") {
      try {
        await navigatorImpl.share({ title: "A Better Time", text: "See what a clock that follows the sun could feel like.", url });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    prepare(url);
    openDialog(trigger, dialog);
  });
  copy.addEventListener("click", async () => {
    try {
      await navigatorImpl.clipboard.writeText(getUrl());
      feedback.textContent = "Link copied.";
    } catch {
      feedback.textContent = "Copy the address from your browser to share.";
    }
  });
  preview.addEventListener("error", () => {
    imageError.textContent = "Image preview unavailable. You can still copy the link.";
    preview.hidden = true;
  });
  preview.addEventListener("load", () => { preview.hidden = false; imageError.textContent = ""; });
}
