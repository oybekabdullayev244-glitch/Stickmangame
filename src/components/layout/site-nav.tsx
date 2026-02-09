import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/play", label: "Play" },
  { href: "/about", label: "About" },
  { href: "/updates", label: "Updates" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function SiteNav() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-mark">
          Stick Arena Party
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>Stick Arena Party. Browser-first action game with optional rewarded bonuses.</p>
        <p>
          Contact placeholder: <a href="mailto:owner@example.com">owner@example.com</a>
        </p>
      </div>
    </footer>
  );
}
