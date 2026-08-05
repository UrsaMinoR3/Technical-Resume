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
