/**
 * animations.js — Per-block animation trigger logic.
 *
 * Finds all [data-anim-trigger] elements and attaches the configured trigger
 * directly to that element. Each block independently controls its own animation.
 *
 * Loaded in the live site (via base.njk) and in the WYSIWYG iframe
 * (injected by iframeRenderer.ts).
 *
 * postMessage protocol (for WYSIWYG iframe):
 *   { type: "anim-preview-start" } → enter preview/loop mode
 *   { type: "anim-preview-stop" }  → exit preview mode, reset all
 */

(function () {
  "use strict";

  /** Trigger the animation on a single element. */
  function runBlock(el) {
    el.classList.remove("anim-running");
    // Force reflow so removing+re-adding restarts the CSS animation.
    void el.offsetWidth;
    el.classList.add("anim-running");
  }

  /** Remove the running state from a single element. */
  function resetBlock(el) {
    el.classList.remove("anim-running");
  }

  /**
   * Loop a single element: run it, wait for animationend, pause 500ms, repeat.
   */
  function loopBlock(el) {
    runBlock(el);
    function onEnd() {
      el.removeEventListener("animationend", onEnd);
      if (!document.body.hasAttribute("data-anim-preview")) return;
      setTimeout(function () {
        if (!document.body.hasAttribute("data-anim-preview")) return;
        loopBlock(el);
      }, 500);
    }
    el.addEventListener("animationend", onEnd);
  }

  function initBlocks() {
    var blocks = Array.from(document.querySelectorAll("[data-anim-trigger]"));
    var isPreview = document.body.hasAttribute("data-anim-preview");

    blocks.forEach(function (el) {
      // Remove any previously attached listeners by cloning (only safe on reinit)
      var trigger = el.dataset.animTrigger || "scroll";
      var once = el.dataset.animOnce !== "false"; // default true

      if (isPreview) {
        loopBlock(el);
        return;
      }

      if (trigger === "load") {
        runBlock(el);
        return;
      }

      if (trigger === "scroll") {
        var observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                runBlock(el);
                if (once) observer.disconnect();
              } else if (!once) {
                resetBlock(el);
              }
            });
          },
          { threshold: 0.15 },
        );
        observer.observe(el);
        return;
      }

      if (trigger === "hover") {
        el.addEventListener("mouseenter", function () {
          runBlock(el);
        });
        if (!once) {
          el.addEventListener("mouseleave", function () {
            resetBlock(el);
          });
        }
        return;
      }

      if (trigger === "click") {
        el.addEventListener("click", function () {
          runBlock(el);
          if (!once) {
            el.addEventListener(
              "animationend",
              function () {
                resetBlock(el);
              },
              { once: true },
            );
          }
        });
        return;
      }
    });
  }

  // ── postMessage protocol for WYSIWYG iframe ──────────────────────────────

  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "anim-preview-start") {
      document.body.setAttribute("data-anim-preview", "");
      initBlocks();
    } else if (event.data && event.data.type === "anim-preview-stop") {
      document.body.removeAttribute("data-anim-preview");
      document.querySelectorAll("[data-anim-trigger]").forEach(resetBlock);
    }
  });

  // ── Init ─────────────────────────────────────────────────────────────────

  // Expose for the WYSIWYG iframe to re-run after DOM updates (updateBlocks).
  window.__animInitBlocks = initBlocks;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBlocks);
  } else {
    initBlocks();
  }
})();
