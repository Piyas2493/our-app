"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** The ☰ in every page's breadcrumb was a plain <span> -- decorative,
 * no onClick -- while globals.css hides .sidebar entirely below 850px
 * with nothing replacing it, so mobile users had no navigation at all.
 * This is the one real toggle: shows the sidebar as an overlay drawer
 * (see globals.css's body.sidebar-open rule) and auto-closes on route
 * change so it doesn't stay open after tapping a nav link. */
export default function MobileSidebarToggle() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.remove("sidebar-open");
  }, [pathname]);

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
