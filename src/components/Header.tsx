"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cancel01Icon, Menu01Icon, Shield02Icon } from "hugeicons-react";
import { BrandWordmark, HydraMark, IconTile } from "@/components/ui";

const NAV = [
  { label: "Explorer", href: "/#explorer" },
  { label: "Rules", href: "/rules" },
  { label: "Reports", href: "/reports" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href.split("#")[0];
}

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[box-shadow,background-color,border-color] duration-300 ${
        scrolled
          ? "border-line bg-sand-100/95 shadow-[0_16px_36px_-24px_rgba(98,66,32,0.5)]"
          : "border-transparent bg-sand-100/95"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
        {/* Brand lockup */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <IconTile>
            <span className="p-1.5 text-clay-600 sm:p-2">
              <HydraMark className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
          </IconTile>
          <span className="min-w-0 leading-tight">
            <BrandWordmark className="block text-lg" />
            <span className="mono-label hidden whitespace-nowrap sm:block">supply-chain intel</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`nav-link px-3 py-2 text-sm font-medium ${
                isActive(pathname, item.href) ? "is-active" : ""
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/docs"
            className="clay-btn-ghost hidden items-center gap-2 px-4 py-2 text-sm sm:flex"
          >
            <Shield02Icon size={16} className="text-clay-600" />
            Docs
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="clay-btn-ghost flex items-center rounded-xl px-2.5 py-2 md:hidden"
          >
            {menuOpen ? <Cancel01Icon size={18} /> : <Menu01Icon size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="anim-rise border-t border-line bg-sand-100/95 px-4 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Primary mobile">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(pathname, item.href)
                    ? "bg-clay-100 text-clay-600"
                    : "text-ink-500 hover:bg-sand-200/70 hover:text-ink-900"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/docs"
              onClick={() => setMenuOpen(false)}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/docs"
                  ? "bg-clay-100 text-clay-600"
                  : "text-ink-500 hover:bg-sand-200/70 hover:text-ink-900"
              }`}
            >
              Docs
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
