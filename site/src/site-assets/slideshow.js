/**
 * slideshow.js — Slideshow block runtime.
 *
 * Finds all [data-slideshow] elements and initializes each independently.
 * Handles slide transitions (slide/fade/scale), auto-advance timer,
 * pointer/touch swipe gestures, arrow buttons, and dot indicators.
 *
 * Loaded in the live site (via base.njk) and in the WYSIWYG iframe
 * (injected by iframeRenderer.ts).
 *
 * postMessage protocol (for WYSIWYG iframe):
 *   { type: "slideshow-goto", slideshowId: string, index: number }
 *     → Navigate the named slideshow to the given slide index
 */

(function () {
  "use strict";

  /** Map from slideshowId → instance (for postMessage targeting). */
  var instances = {};

  /**
   * Determine enter/exit CSS class names based on transition type, direction,
   * and whether we are going forward (next) or backward (prev).
   */
  function getTransitionClasses(transition, direction, goingForward) {
    if (transition === "fade") {
      return { enter: "slide-enter-fade", exit: "slide-exit-fade" };
    }
    if (transition === "scale") {
      return { enter: "slide-enter-scale", exit: "slide-exit-scale" };
    }
    // "slide" — directional
    if (direction === "vertical") {
      return goingForward
        ? { enter: "slide-enter-bottom", exit: "slide-exit-top" }
        : { enter: "slide-enter-top", exit: "slide-exit-bottom" };
    }
    // horizontal (default)
    return goingForward
      ? { enter: "slide-enter-right", exit: "slide-exit-left" }
      : { enter: "slide-enter-left", exit: "slide-exit-right" };
  }

  function initSlideshow(el) {
    var sid = el.dataset.slideshowId || el.id || String(Math.random());
    var slides = Array.from(el.querySelectorAll("[data-slide-index]")).sort(
      function (a, b) {
        return Number(a.dataset.slideIndex) - Number(b.dataset.slideIndex);
      },
    );
    var dots = Array.from(el.querySelectorAll(".slideshow-dot"));
    var count = slides.length;

    if (count === 0) return;

    var transition = el.dataset.slideshowTransition || "slide";
    var direction = el.dataset.slideshowDirection || "horizontal";
    var duration = parseInt(el.dataset.slideshowDuration, 10) || 500;
    var autoAdvanceMs = parseInt(el.dataset.slideshowAutoAdvance, 10) || 0;
    var loop = el.dataset.slideshowLoop !== "false";
    var swipeEnabled = el.dataset.slideshowSwipe !== "false";

    // Respect prefers-reduced-motion
    var prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      duration = 0;
      autoAdvanceMs = 0;
    }

    var activeIndex = 0;
    var transitioning = false;
    var timer = null;

    // Initial aria state
    function updateAria() {
      slides.forEach(function (s, i) {
        s.setAttribute("aria-hidden", i === activeIndex ? "false" : "true");
      });
    }
    updateAria();

    function updateDots(idx) {
      dots.forEach(function (d, i) {
        d.classList.toggle("active", i === idx);
      });
    }

    function stopTimer() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startTimer() {
      stopTimer();
      if (autoAdvanceMs > 0 && count > 1) {
        timer = setInterval(function () {
          goto(activeIndex + 1, true);
        }, autoAdvanceMs);
      }
    }

    function goto(nextIndex, goingForward) {
      if (count <= 1) return;
      if (transitioning) return;

      // Handle loop / boundary
      if (nextIndex >= count) {
        if (!loop) return;
        nextIndex = 0;
      }
      if (nextIndex < 0) {
        if (!loop) return;
        nextIndex = count - 1;
      }
      if (nextIndex === activeIndex) return;

      transitioning = true; // lock immediately so rapid clicks are ignored

      var leaving = slides[activeIndex];
      var entering = slides[nextIndex];
      var next = nextIndex; // capture for closure
      var cls = getTransitionClasses(
        transition,
        direction,
        goingForward !== false,
      );

      // Step 1 — snap the entering slide to its off-screen starting position.
      entering.classList.add(cls.enter);

      // Step 2 — wait two animation frames so the browser has painted the
      // starting position, then begin the transition.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          leaving.classList.remove("slide-active");
          leaving.classList.add(cls.exit);
          entering.classList.remove(cls.enter);
          entering.classList.add("slide-active");

          // Step 3 — clean up after the CSS transition finishes.
          setTimeout(function () {
            leaving.classList.remove(cls.exit);
            activeIndex = next;
            updateDots(activeIndex);
            updateAria();
            transitioning = false;
            startTimer();
          }, duration + 50);
        });
      });
    }

    // ── Arrow buttons ───────────────────────────────────────────────────────

    var prevBtn = el.querySelector(".slideshow-prev");
    var nextBtn = el.querySelector(".slideshow-next");

    if (prevBtn) {
      prevBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        stopTimer();
        goto(activeIndex - 1, false);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        stopTimer();
        goto(activeIndex + 1, true);
      });
    }

    // ── Dot clicks ──────────────────────────────────────────────────────────

    dots.forEach(function (dot) {
      dot.addEventListener("click", function (e) {
        e.stopPropagation();
        var idx = parseInt(dot.dataset.dotIndex, 10);
        if (isNaN(idx)) return;
        stopTimer();
        goto(idx, idx > activeIndex);
      });
    });

    // ── Swipe / drag gesture ──────────────────────────────────────────────────
    //
    // IMPORTANT: We do NOT call setPointerCapture eagerly on pointerdown.
    // Capturing the pointer immediately on every pointerdown redirects the
    // subsequent pointerup to the slideshow element, which breaks the browser's
    // click-event synthesis for child elements (arrow and dot buttons).
    //
    // Instead we only capture in pointermove once the gesture clearly moves
    // along the slideshow axis — preventing page-scroll without breaking clicks.

    if (swipeEnabled && count > 1) {
      var startX = 0;
      var startY = 0;
      var tracking = false;
      var captured = false;

      el.addEventListener("pointerdown", function (e) {
        if (e.button !== 0 && e.pointerType !== "touch") return;
        startX = e.clientX;
        startY = e.clientY;
        tracking = true;
        captured = false;
      });

      el.addEventListener(
        "pointermove",
        function (e) {
          if (!tracking) return;
          var dx = Math.abs(e.clientX - startX);
          var dy = Math.abs(e.clientY - startY);

          if (!captured) {
            // Capture only once the user has moved more along the slideshow axis
            // than the cross-axis — confirming it is a swipe, not a page scroll.
            var onAxis =
              direction === "vertical" ? dy > dx && dy > 8 : dx > dy && dx > 8;
            if (onAxis) {
              try {
                el.setPointerCapture(e.pointerId);
              } catch (_) {}
              captured = true;
            }
          }

          // Only prevent default (page scroll) once a swipe is confirmed.
          if (captured) {
            e.preventDefault();
          }
        },
        { passive: false },
      );

      el.addEventListener("pointerup", function (e) {
        if (!tracking) return;
        tracking = false;
        captured = false;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        var thresh = 50;
        if (direction === "vertical") {
          if (dy < -thresh) {
            stopTimer();
            goto(activeIndex + 1, true);
          } else if (dy > thresh) {
            stopTimer();
            goto(activeIndex - 1, false);
          }
        } else {
          if (dx < -thresh) {
            stopTimer();
            goto(activeIndex + 1, true);
          } else if (dx > thresh) {
            stopTimer();
            goto(activeIndex - 1, false);
          }
        }
      });

      el.addEventListener("pointercancel", function () {
        tracking = false;
        captured = false;
      });
    }

    // ── Pause on hover / focus ──────────────────────────────────────────────

    el.addEventListener("mouseenter", stopTimer);
    el.addEventListener("focusin", stopTimer);
    el.addEventListener("mouseleave", startTimer);
    el.addEventListener("focusout", startTimer);

    // ── Store instance for postMessage targeting ────────────────────────────

    instances[sid] = { el: el, goto: goto };

    startTimer();
  }

  function initAll() {
    instances = {};
    Array.from(document.querySelectorAll("[data-slideshow]")).forEach(
      initSlideshow,
    );
  }

  // ── postMessage protocol (WYSIWYG iframe) ───────────────────────────────────

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (!msg || !msg.type) return;
    if (msg.type === "slideshow-goto") {
      var inst = instances[msg.slideshowId];
      if (!inst) return;
      var idx = parseInt(msg.index, 10);
      if (!isNaN(idx)) inst.goto(idx, idx > 0);
    }
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  window.__slideshowInitAll = initAll;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
