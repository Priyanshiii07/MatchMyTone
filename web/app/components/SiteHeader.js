"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navigateTo } from "../../lib/browser";
import Icon from "./Icon";
import Logo from "./Logo";

export default function SiteHeader({ authenticated = false }) {
  const pathname = usePathname();
  const [leaving, setLeaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  async function logout() {
    setLeaving(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally { navigateTo("/login"); }
  }
  const current = (href) => (pathname === href || pathname?.startsWith(`${href}/`) ? "page" : undefined);
  const links = authenticated ? [["/dashboard", "Dashboard"], ["/results", "Results"], ["/stylist", "AI stylist"], ["/board", "Inspiration board"], ["/profile", "Profile"]] : [["/", "Home"], ["/about", "About"], ["/login", "Login"], ["/signup", "Register"]];

  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Link className="brand" href={authenticated ? "/dashboard" : "/"} aria-label="MatchMyTone home"><Logo size={36} /></Link>
        {authenticated ? (
          <nav className="header-nav" aria-label="Primary navigation">
            <Link href="/dashboard" className="nav-link hide-small" aria-current={current("/dashboard")}>Dashboard</Link>
            <Link href="/results" className="nav-link hide-small" aria-current={current("/results")}>Results</Link>
            <Link href="/stylist" className="nav-link hide-small" aria-current={current("/stylist")}>Stylist</Link>
            <Link href="/board" className="nav-link hide-small" aria-current={current("/board")}>Board</Link>
            <Link href="/profile" className="profile-button" aria-label="Open profile" aria-current={current("/profile")}><Icon name="user" size={18} /></Link>
            <button className="header-logout" type="button" onClick={logout} disabled={leaving}>{leaving ? "Logging out…" : "Logout"}</button>
          </nav>
        ) : (
          <nav className="header-nav" aria-label="Primary navigation">
            <Link className="nav-link hide-small" href="/login" aria-current={current("/login")}>Login</Link>
            <Link className="btn btn-primary btn-small hide-small" href="/signup">Register</Link>
          </nav>
        )}
        <button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
          <Icon name={menuOpen ? "close" : "menu"} size={20} />
        </button>
      </div>
      {menuOpen && (
        <nav id="mobile-menu" className="mobile-menu shell" aria-label="Mobile navigation">
          {links.map(([href, label]) => <Link key={href} href={href} aria-current={current(href)} onClick={() => setMenuOpen(false)}>{label}</Link>)}
        </nav>
      )}
    </header>
  );
}
