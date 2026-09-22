"use client";

/** The ☰ in every page's breadcrumb was a plain <span> -- decorative,
 * no onClick -- while globals.css hides .sidebar entirely below 850px
 * with nothing replacing it, so mobile users had no navigation at all.
 * This is the one real toggle: shows the sidebar as an overlay drawer
 * (see globals.css's body.sidebar-open rule). Deliberately does NOT
 * auto-close on route change -- Piyas wants it to stay open across
 * navigation until explicitly toggled shut. */
export default function MobileSidebarToggle() {
  return (
    <button
      type="button"
      className="menu-lines"
      aria-label="Toggle navigation menu"
      onClick={() => document.body.classList.toggle("sidebar-open")}
    >
      ☰
    </button>
  );
}
