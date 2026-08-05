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
  } catch (e) { /* theme toggle is a nice-to-have, never block the rest of the page for it */ }

  /* ---------- Scroll progress bar + parallax blobs ---------- */
  // Deliberately does NOT touch opacity on any real content — only decorative
  // blob positions move. A mobile browser's address-bar-collapse scroll jumps
  // must never be able to make the resume text disappear.
  try {
    const progressBar = document.getElementById("progress-bar");
    const blobs = document.querySelectorAll(".blob");

    function updateProgress() {
      if (!progressBar) return;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, pct)) + "%";
    }

    function updateParallax() {
      if (reduceMotion) return;
      const scrollTop = window.scrollY;
      blobs.forEach((blob, i) => {
        const speed = 0.15 + i * 0.08;
        blob.style.transform = `translateY(${scrollTop * speed}px)`;
      });
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
  } catch (e) { /* purely decorative — never let this break content below */ }

  /* ---------- Scroll-reveal sections ---------- */
  // Only switch content into the "hidden until revealed" mode (html.js-reveal)
  // once the observer is actually set up and watching every element — if
  // anything here throws, .reveal content stays visible via its CSS default.
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

      // Safety net: if for any reason (viewport quirk, timing) an element
      // never gets marked in-view, force it visible after a few seconds
      // rather than leave it permanently hidden.
      setTimeout(() => {
        revealEls.forEach((el) => el.classList.add("in-view"));
      }, 4000);
    }
  } catch (e) { /* CSS default already has .reveal visible — safe to no-op */ }
})();
