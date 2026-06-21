/* ── Article image gallery / lightbox ────────────────────────────────────── */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // Collect cover image first, then all prose images in document order.
    const imgs = [];
    const cover = document.getElementById("article-cover");
    if (cover) imgs.push(cover);
    document.querySelectorAll(".prose img").forEach(function (img) {
      imgs.push(img);
    });
    document.querySelectorAll(".reference-gallery-image").forEach(function (img) {
      imgs.push(img);
    });

    if (imgs.length === 0) return;

    let current = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    // ── Build overlay ────────────────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.id = "gallery-overlay";
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Image gallery");
    overlay.innerHTML =
      '<div id="gallery-backdrop"></div>' +
      '<button id="gallery-close" aria-label="Close gallery">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      "</button>" +
      '<button id="gallery-prev" aria-label="Previous image">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
      "</button>" +
      '<button id="gallery-next" aria-label="Next image">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
      "</button>" +
      '<div id="gallery-content"><img id="gallery-img" src="" alt="" /></div>' +
      '<div id="gallery-counter"></div>';
    document.body.appendChild(overlay);

    const galleryImg = document.getElementById("gallery-img");
    const counter = document.getElementById("gallery-counter");
    const closeBtn = document.getElementById("gallery-close");
    const prevBtn = document.getElementById("gallery-prev");
    const nextBtn = document.getElementById("gallery-next");
    const backdrop = document.getElementById("gallery-backdrop");

    // ── Open / close ─────────────────────────────────────────────────────────
    function open(index) {
      current = ((index % imgs.length) + imgs.length) % imgs.length;
      galleryImg.src = imgs[current].src;
      galleryImg.alt = imgs[current].alt || "";
      counter.textContent =
        imgs.length > 1 ? current + 1 + " / " + imgs.length : "";
      prevBtn.style.display = imgs.length > 1 ? "" : "none";
      nextBtn.style.display = imgs.length > 1 ? "" : "none";
      overlay.classList.add("active");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }

    function close() {
      overlay.classList.remove("active");
      document.body.style.overflow = "";
    }

    function prev() {
      open(current - 1);
    }
    function next() {
      open(current + 1);
    }

    // ── Make source images clickable ─────────────────────────────────────────
    imgs.forEach(function (img, i) {
      img.style.cursor = "pointer";
      img.addEventListener("click", function () {
        open(i);
      });
    });

    // ── Controls ─────────────────────────────────────────────────────────────
    closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    prevBtn.addEventListener("click", prev);
    nextBtn.addEventListener("click", next);

    // ── Keyboard ─────────────────────────────────────────────────────────────
    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("active")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    });

    // ── Touch swipe ──────────────────────────────────────────────────────────
    overlay.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
      },
      { passive: true },
    );

    overlay.addEventListener(
      "touchend",
      function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        // Only count as a horizontal swipe if horizontal movement dominates.
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
          if (dx < 0) next();
          else prev();
        }
      },
      { passive: true },
    );
  });
})();
