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
    const backToTop = document.getElementById("back-to-top");
    const BACK_TO_TOP_THRESHOLD = 400;

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

    function updateBackToTop() {
      if (!backToTop) return;
      backToTop.classList.toggle("is-idle", window.scrollY < BACK_TO_TOP_THRESHOLD);
    }

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateProgress();
          updateParallax();
          updateBackToTop();
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    updateProgress();
    updateParallax();
    updateBackToTop();
  } catch (e) { /* purely decorative */ }

  /* ---------- Scroll-reveal sections (fail-safe: visible by default) ----------
     threshold: 0 (not a ratio like 0.1) deliberately — a ratio-based
     threshold fires once N% of the TARGET's own area is visible, which
     is target-height-dependent: a short card (About) crosses 10% of its
     own height after only a few px of scroll, while a very tall card
     (Experience, with the whole zigzag timeline inside it) needs far
     more scroll before 10% of its much larger height is visible. Since
     the split layout's pinned and scroll columns start at the identical
     document Y (same grid row), that mismatch was the root cause of the
     two columns appearing to reveal — and briefly sit at different
     vertical offsets via the translateY(--space-6) pre-reveal state — at
     different scroll positions. threshold: 0 fires as soon as any part
     of a target crosses the rootMargin boundary, which depends only on
     the target's top edge, not its height, so same-Y siblings reveal in
     sync regardless of how tall each one is. */
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
        { threshold: 0, rootMargin: "0px 0px -10% 0px" }
      );
      revealEls.forEach((el) => observer.observe(el));
      root.classList.add("js-reveal");
      setTimeout(() => revealEls.forEach((el) => el.classList.add("in-view")), 4000);
    }
  } catch (e) { /* CSS default already has .reveal visible */ }

  /* ---------- Split layout: fixed-position About column ----------
     Toggles .is-pinned-fixed on the pinned About card only while the
     split section's own vertical range straddles the pin offset — the
     same rAF-batched getBoundingClientRect pattern as the sticky action
     bar above, so the two "toggle a fixed element based on scroll range"
     features share one mental model. pinTopOffset is read from the CSS
     custom property (--pin-top-offset on .split-layout) rather than
     hard-coded a second time, so the JS activation point and the CSS
     `top` it snaps to can never drift out of sync with each other. */
  try {
    const splitLayout = document.querySelector(".split-layout");
    const pinnedCol = document.querySelector(".split-layout-pinned");
    const desktopQuery = window.matchMedia("(min-width: 980px)");

    if (splitLayout && pinnedCol) {
      function getPinTopOffset() {
        const raw = getComputedStyle(splitLayout).getPropertyValue("--pin-top-offset");
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 92; // matches the CSS calc() fallback
      }

      function updatePinnedColumn() {
        if (!desktopQuery.matches) {
          pinnedCol.classList.remove("is-pinned-fixed");
          return;
        }
        const rect = splitLayout.getBoundingClientRect();
        const pinTopOffset = getPinTopOffset();
        // Fixed only while the section's own range straddles the offset —
        // above it (not scrolled down enough yet, or scrolled back above
        // the section) or below it (section has fully scrolled past) both
        // fall back to normal static grid flow.
        const inRange = rect.top <= pinTopOffset && rect.bottom > pinTopOffset;
        pinnedCol.classList.toggle("is-pinned-fixed", inRange);
      }

      let pinTicking = false;
      window.addEventListener(
        "scroll",
        () => {
          if (!pinTicking) {
            requestAnimationFrame(() => {
              updatePinnedColumn();
              pinTicking = false;
            });
            pinTicking = true;
          }
        },
        { passive: true }
      );
      window.addEventListener("resize", updatePinnedColumn, { passive: true });
      updatePinnedColumn();
    }
  } catch (e) { /* CSS default keeps the column in normal static grid flow */ }

  /* ---------- Experience: dynamic path (scroll-driven line draw + "you are here") ----------
     The SVG line is drawn in proportion to how far the user has actually
     scrolled through the Experience section (a real progress read-out,
     not a fixed-duration animation), and whichever role card is nearest
     the viewport center gets a live "active" highlight — turning the
     static zigzag into something that visibly responds to scrolling,
     which is what "dynamic path" means here. Both behaviors are no-ops
     under prefers-reduced-motion: the path simply renders fully drawn
     and no card is force-highlighted, so nothing moves on its own. */
  try {
    const experienceSection = document.getElementById("experience");
    const zzPath = document.getElementById("zzPath");
    const zzItems = document.querySelectorAll(".zz-item");

    if (experienceSection && zzPath && "getTotalLength" in zzPath) {
      const pathLength = zzPath.getTotalLength();

      if (reduceMotion) {
        zzPath.style.strokeDasharray = "none";
        zzPath.style.strokeDashoffset = "0";
      } else {
        zzPath.style.strokeDasharray = String(pathLength);

        function updateExperiencePath() {
          const rect = experienceSection.getBoundingClientRect();
          const winH = window.innerHeight;
          const total = rect.height + winH;
          const passed = winH - rect.top;
          const progress = Math.min(1, Math.max(0, passed / total));
          zzPath.style.strokeDashoffset = String(pathLength * (1 - progress));
        }

        function updateActiveRole() {
          if (!zzItems.length) return;
          const viewportCenter = window.innerHeight / 2;
          let closest = null;
          let closestDist = Infinity;
          zzItems.forEach((item) => {
            const card = item.querySelector(".job-card");
            if (!card) return;
            const cardRect = card.getBoundingClientRect();
            if (cardRect.bottom < 0 || cardRect.top > window.innerHeight) {
              item.classList.remove("zz-active");
              return;
            }
            const cardCenter = cardRect.top + cardRect.height / 2;
            const dist = Math.abs(cardCenter - viewportCenter);
            if (dist < closestDist) { closestDist = dist; closest = item; }
          });
          zzItems.forEach((item) => item.classList.toggle("zz-active", item === closest));
        }

        let expTicking = false;
        function onExperienceScroll() {
          if (!expTicking) {
            requestAnimationFrame(() => {
              updateExperiencePath();
              updateActiveRole();
              expTicking = false;
            });
            expTicking = true;
          }
        }
        window.addEventListener("scroll", onExperienceScroll, { passive: true });
        window.addEventListener("resize", onExperienceScroll, { passive: true });
        updateExperiencePath();
        updateActiveRole();
      }
    }
  } catch (e) { /* the static zigzag layout already works with no JS */ }

  /* ---------- Sticky action bar: reveal once scrolled past the hero ---------- */
  try {
    const stickyBar = document.getElementById("sticky-bar");
    const heroEl = document.querySelector(".hero");
    if (stickyBar && heroEl) {
      function updateStickyBar() {
        const heroBottom = heroEl.getBoundingClientRect().bottom;
        stickyBar.classList.toggle("is-visible", heroBottom < 0);
      }
      let barTicking = false;
      window.addEventListener(
        "scroll",
        () => {
          if (!barTicking) {
            requestAnimationFrame(() => {
              updateStickyBar();
              barTicking = false;
            });
            barTicking = true;
          }
        },
        { passive: true }
      );
      updateStickyBar();
    }
  } catch (e) { /* the hero's own links already cover this functionality */ }

  /* ---------- Success Factors: button opens/closes the card on the other side ---------- */
  try {
    document.querySelectorAll(".factors-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".zz-item");
        if (!item) return;
        const open = item.classList.toggle("factors-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? "✕ Close" : "🔍 Success Factors";
      });
    });
  } catch (e) { /* non-critical */ }
})();
