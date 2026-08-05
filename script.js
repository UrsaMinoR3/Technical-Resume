(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Theme toggle ---------- */
  try {
    const toggle = document.getElementById("theme-toggle");
    const stored = localStorage.getItem("theme");
    if (stored) root.setAttribute("data-theme", stored);
    if (toggle) {
      toggle.addEventListener("click", () => {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const current = root.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
        const next = current === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);
      });
    }
  } catch (e) { /* never block the rest of the page for this */ }

  /* ---------- Scroll progress bar + hero photo parallax ---------- */
  // Only ever moves/scales the decorative photo layer — never touches
  // opacity on real content (see the mobile-visibility fix from before).
  try {
    const progressBar = document.getElementById("progress-bar");
    const heroPhoto = document.getElementById("hero-photo");

    function updateProgress() {
      if (!progressBar) return;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
    }

    function updateParallax() {
      if (reduceMotion || !heroPhoto) return;
      const scrollTop = window.scrollY;
      heroPhoto.style.transform = `scale(1.12) translateY(${scrollTop * 0.22}px)`;
    }

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateProgress();
          updateParallax();
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    updateProgress();
    updateParallax();
  } catch (e) { /* purely decorative */ }

  /* ---------- Scroll-reveal sections (fail-safe: visible by default) ---------- */
  try {
    const revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && !reduceMotion && revealEls.length) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
      );
      revealEls.forEach((el) => observer.observe(el));
      root.classList.add("js-reveal");
      setTimeout(() => revealEls.forEach((el) => el.classList.add("in-view")), 4000);
    }
  } catch (e) { /* CSS default already has .reveal visible */ }

  /* ---------- Flip cards: tap-to-flip for touch (hover already works via CSS) ---------- */
  try {
    document.querySelectorAll(".flip-card").forEach((card) => {
      card.addEventListener("click", () => card.classList.toggle("is-flipped"));
    });
  } catch (e) { /* non-critical */ }

  /* ============================================================
     Pixel-cat mascot — jumps to a corner of whatever's being
     hovered, cycling through a handful of its 25 poses. Pure
     decoration (pointer-events:none on the element itself), so a
     failure here can never block or hide real content.
     ============================================================ */
  try {
    if (!("ontouchstart" in window)) { // desktop/mouse only — touch users get tap-to-flip instead
      const mascot = document.getElementById("mascot");
      const mascotImg = document.getElementById("mascot-img");
      const FRAME_DIR = "img/cat-frames/";
      const HOVER_FRAMES = ["cat-05", "cat-13", "cat-17", "cat-00", "cat-01", "cat-04", "cat-16", "cat-20"];
      const TARGET_SELECTOR = ".card, .icon-item, .flip-card, #theme-toggle, .profile-photo";

      let currentTarget = null;
      let hideTimer = null;

      function pickFrame() {
        return HOVER_FRAMES[Math.floor(Math.random() * HOVER_FRAMES.length)];
      }

      function positionAt(el) {
        const rect = el.getBoundingClientRect();
        const mascotSize = 56;
        const margin = 8;
        let left, useLeftCorner;

        if (rect.right + mascotSize + margin < window.innerWidth) {
          left = rect.right - mascotSize * 0.4;
          useLeftCorner = false;
        } else {
          left = rect.left - mascotSize * 0.6;
          useLeftCorner = true;
        }
        let top = rect.top - mascotSize * 0.5;
        top = Math.max(margin, Math.min(top, window.innerHeight - mascotSize - margin));
        left = Math.max(margin, Math.min(left, window.innerWidth - mascotSize - margin));

        mascot.style.transform = `translate(${left}px, ${top}px)`;
        mascot.classList.toggle("is-flipped", useLeftCorner);
        mascotImg.src = FRAME_DIR + pickFrame() + ".png";
        mascot.classList.add("is-visible");
      }

      document.addEventListener("mouseover", (e) => {
        const el = e.target.closest(TARGET_SELECTOR);
        if (el && el !== currentTarget) {
          currentTarget = el;
          clearTimeout(hideTimer);
          positionAt(el);
        }
      });

      document.addEventListener("mouseout", (e) => {
        const el = e.target.closest(TARGET_SELECTOR);
        const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(TARGET_SELECTOR) : null;
        if (el && el === currentTarget && !to) {
          currentTarget = null;
          hideTimer = setTimeout(() => mascot.classList.remove("is-visible"), 200);
        }
      });

      window.addEventListener("scroll", () => {
        if (currentTarget) positionAt(currentTarget);
      }, { passive: true });
    }
  } catch (e) { /* mascot is a fun extra, never critical */ }
})();
