/**
 * Go Kitty Go–style dancing cats (pump paws + bounce)
 */
(() => {
  const SVG = (variant = "a") => `
  <svg class="dance-cat dance-${variant}" viewBox="0 0 64 80" width="88" height="110" aria-hidden="true">
    <g class="cat-root">
      <!-- tail -->
      <path class="cat-tail" d="M44 48 C58 44, 58 28, 50 22" fill="none" stroke="#f0a04a" stroke-width="5" stroke-linecap="round"/>
      <!-- back arm (left) -->
      <g class="arm arm-l">
        <rect x="6" y="34" width="8" height="18" rx="4" fill="#f0a04a"/>
        <circle cx="10" cy="30" r="5" fill="#f0a04a"/>
        <circle cx="8" cy="28" r="1.4" fill="#ffb0a8"/>
        <circle cx="11" cy="27" r="1.2" fill="#ffb0a8"/>
        <circle cx="13" cy="29" r="1.2" fill="#ffb0a8"/>
      </g>
      <!-- body -->
      <ellipse cx="32" cy="50" rx="14" ry="16" fill="#f0a04a"/>
      <ellipse cx="32" cy="54" rx="8" ry="9" fill="#ffe0c2"/>
      <!-- stripes -->
      <rect x="24" y="42" width="16" height="3" rx="1.5" fill="#d97828" opacity="0.55"/>
      <rect x="25" y="48" width="14" height="3" rx="1.5" fill="#d97828" opacity="0.45"/>
      <!-- front arm (right) -->
      <g class="arm arm-r">
        <rect x="50" y="34" width="8" height="18" rx="4" fill="#f0a04a"/>
        <circle cx="54" cy="30" r="5" fill="#f0a04a"/>
        <circle cx="52" cy="28" r="1.4" fill="#ffb0a8"/>
        <circle cx="55" cy="27" r="1.2" fill="#ffb0a8"/>
        <circle cx="57" cy="29" r="1.2" fill="#ffb0a8"/>
      </g>
      <!-- legs -->
      <g class="legs">
        <rect class="leg-l" x="22" y="62" width="8" height="12" rx="3" fill="#f0a04a"/>
        <rect class="leg-r" x="34" y="62" width="8" height="12" rx="3" fill="#f0a04a"/>
        <ellipse cx="26" cy="74" rx="5" ry="3" fill="#e89040"/>
        <ellipse cx="38" cy="74" rx="5" ry="3" fill="#e89040"/>
      </g>
      <!-- head -->
      <g class="head">
        <circle cx="32" cy="24" r="14" fill="#f0a04a"/>
        <!-- ears -->
        <path d="M20 16 L22 4 L28 14 Z" fill="#f0a04a"/>
        <path d="M44 16 L42 4 L36 14 Z" fill="#f0a04a"/>
        <path d="M22 14 L23 7 L26 13 Z" fill="#ffb0a8"/>
        <path d="M42 14 L41 7 L38 13 Z" fill="#ffb0a8"/>
        <!-- face -->
        <circle cx="27" cy="23" r="1.8" fill="#2b2a28"/>
        <circle cx="37" cy="23" r="1.8" fill="#2b2a28"/>
        <path d="M32 26 L30 29 L34 29 Z" fill="#ff8b8b"/>
        <path d="M28 32 Q32 35 36 32" fill="none" stroke="#2b2a28" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="22" cy="28" r="2.2" fill="#ffb0a8" opacity="0.8"/>
        <circle cx="42" cy="28" r="2.2" fill="#ffb0a8" opacity="0.8"/>
      </g>
    </g>
  </svg>`;

  const GRAY = (variant = "a") => SVG(variant)
    .replaceAll("#f0a04a", "#9aa0a8")
    .replaceAll("#d97828", "#6e7480")
    .replaceAll("#e89040", "#8a9098")
    .replaceAll("#ffe0c2", "#e8e8ec");

  function mount(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  mount(document.querySelector(".side-cat-left"), SVG("a"));
  mount(document.querySelector(".side-cat-right"), GRAY("b"));
  mount(document.querySelector(".mobile-cat"), SVG("a"));
})();
