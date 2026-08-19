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
     (Experience, with the whole vertical timeline inside it) needs far
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

  /* ---------- Projects: bubble-grow, scroll-scrubbed ----------
     Separate from the .reveal observer above on purpose — Projects now
     lives outside the split grid as its own full-width section (see
     style.css's .projects-bubble rules) and gets a distinct "grows from
     a small bubble" treatment instead of the fade-up every other card
     uses.

     This used to toggle a .bubble-in class on/off, animated by a fixed-
     duration CSS transition — which read as an abrupt, canned pop
     regardless of how fast or slow the user was actually scrolling
     (Ignitus's report: "appearing fast," not tied to scroll). Replaced
     with the exact same technique as the Experience line-fill just below
     — a continuous 0–1 progress value, recomputed from real scroll
     position every rAF frame and written straight to a --bubble-progress
     CSS custom property, which style.css's calc()-based clip-path/
     transform consume directly. No CSS transition is left racing toward
     a target — the bubble's size at any instant IS the current scroll
     position, so it scrubs 1:1 with the user's scroll instead of playing
     a fixed-length animation.

     Progress is the minimum of two independent ramps, each keyed off one
     edge of the section (mirroring the old binary implementation's
     0.85/0.15 viewport-ratio reference points, now turned into ramps
     instead of hard cutoffs — so the design intent is unchanged, only
     the transition from "instant toggle" to "continuous" is new):
       enterProgress — ramps 0 → 1 as the section's TOP edge rises from
         the bottom of the viewport (rect.top === winH, just entering,
         progress 0) up to 15% down from the top of the viewport
         (rect.top === winH * 0.15, comfortably in view, progress 1).
         Scrolling back up so the section drops back below the fold
         naturally drives this back down to 0 — covers the "scrolled
         back above it" bidirectional case.
       exitProgress — ramps 1 → 0 as the section's BOTTOM edge falls from
         15% down from the top of the viewport (rect.bottom === winH *
         0.15, progress 1) to the very top of the viewport (rect.bottom
         === 0, fully scrolled past, progress 0). Scrolling back down
         after passing it naturally drives this back up to 1 — covers
         the "scrolled past it going down" bidirectional case.
     Taking the min() of both means the bubble is only ever fully grown
     while BOTH conditions hold (meaningfully past its top edge AND not
     yet meaningfully past its bottom edge), and shrinks smoothly the
     moment either edge starts to leave, in either scroll direction. */
  try {
    const projectsEl = document.getElementById("projects");
    if (projectsEl && !reduceMotion) {
      const ENTER_RATIO = 0.85; // enterProgress reaches 1 once the top edge has risen through this fraction of the viewport
      const EXIT_RATIO = 0.15; // exitProgress reaches 0 once the bottom edge has fallen through this fraction of the viewport

      function clamp01(value) {
        return Math.min(1, Math.max(0, value));
      }

      function updateProjectsBubble() {
        const rect = projectsEl.getBoundingClientRect();
        const winH = window.innerHeight;
        const enterProgress = clamp01((winH - rect.top) / (winH * ENTER_RATIO));
        const exitProgress = clamp01(rect.bottom / (winH * EXIT_RATIO));
        const progress = Math.min(enterProgress, exitProgress);
        projectsEl.style.setProperty("--bubble-progress", progress.toFixed(3));
      }

      root.classList.add("js-bubble");

      let bubbleTicking = false;
      window.addEventListener(
        "scroll",
        () => {
          if (!bubbleTicking) {
            requestAnimationFrame(() => {
              updateProjectsBubble();
              bubbleTicking = false;
            });
            bubbleTicking = true;
          }
        },
        { passive: true }
      );
      window.addEventListener("resize", updateProjectsBubble, { passive: true });
      updateProjectsBubble();
    }
  } catch (e) { /* CSS default already shows the panel fully expanded */ }

  /* ---------- Split layout: sticky About column ----------
     No JS needed here anymore. This used to toggle a .is-pinned-fixed
     class via a scroll-range check against .split-layout's own
     getBoundingClientRect() — a JS approximation of "stop pinning once
     the section ends" that could drift out of sync and let the column
     bleed past Education into the Projects section below it (a real bug
     Ignitus hit once Projects moved out to its own full-width section).
     Switched to plain CSS position: sticky (see .split-layout-pinned in
     style.css), which is spec-guaranteed to never render past its own
     containing block — the browser enforces that boundary on every
     frame natively, so there is no scroll-range math left to get wrong. */

  /* ---------- Experience: dynamic line (scroll-driven fill + "you are here") ----------
     The left-edge accent line fills in proportion to how far the user
     has actually scrolled through the Experience section (a real
     progress read-out, not a fixed-duration animation) via a cheap
     transform: scaleY() on .exp-line-fill — GPU-composited, no layout
     or paint cost per frame, replacing the old SVG stroke-dashoffset
     path draw now that the timeline is a single vertical column instead
     of a zigzag. Whichever role card is nearest the viewport center
     gets a live "active" highlight, unchanged in concept from before.
     Both behaviors are no-ops under prefers-reduced-motion: the line
     simply renders fully filled and no card is force-highlighted, so
     nothing moves on its own. */
  try {
    const experienceSection = document.getElementById("experience");
    const expLineFill = document.getElementById("expLineFill");
    const expItems = document.querySelectorAll(".exp-item");

    if (experienceSection && expLineFill) {
      if (reduceMotion) {
        expLineFill.style.transform = "scaleY(1)";
      } else {
        function updateExperienceLine() {
          const rect = experienceSection.getBoundingClientRect();
          const winH = window.innerHeight;
          const total = rect.height + winH;
          const passed = winH - rect.top;
          const progress = Math.min(1, Math.max(0, passed / total));
          expLineFill.style.transform = `scaleY(${progress})`;
        }

        function updateActiveRole() {
          if (!expItems.length) return;
          const viewportCenter = window.innerHeight / 2;
          let closest = null;
          let closestDist = Infinity;
          expItems.forEach((item) => {
            const card = item.querySelector(".job-card");
            if (!card) return;
            const cardRect = card.getBoundingClientRect();
            if (cardRect.bottom < 0 || cardRect.top > window.innerHeight) {
              item.classList.remove("is-active");
              return;
            }
            const cardCenter = cardRect.top + cardRect.height / 2;
            const dist = Math.abs(cardCenter - viewportCenter);
            if (dist < closestDist) { closestDist = dist; closest = item; }
          });
          expItems.forEach((item) => item.classList.toggle("is-active", item === closest));
        }

        let expTicking = false;
        function onExperienceScroll() {
          if (!expTicking) {
            requestAnimationFrame(() => {
              updateExperienceLine();
              updateActiveRole();
              expTicking = false;
            });
            expTicking = true;
          }
        }
        window.addEventListener("scroll", onExperienceScroll, { passive: true });
        window.addEventListener("resize", onExperienceScroll, { passive: true });
        updateExperienceLine();
        updateActiveRole();
      }
    }
  } catch (e) { /* the static vertical timeline already works with no JS */ }

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

  /* ---------- Success Factors: button opens/closes its own inline panel ---------- */
  try {
    document.querySelectorAll(".factors-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".exp-item");
        if (!item) return;
        const open = item.classList.toggle("factors-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? "✕ Close" : "🔍 Success Factors";
      });
    });
  } catch (e) { /* non-critical */ }
})();
