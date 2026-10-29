import Link from "next/link";
import Logo from "./Logo";

export default function SiteFooter({ authenticated = false }) {
  return (
    <footer className="site-footer shell">
      <Link className="footer-brand" href="/" aria-label="MatchMyTone home"><Logo size={28} /></Link>
      <p>Personal styling, made clear.</p>
      <nav className="footer-links" aria-label="Footer">
        {authenticated
          ? <><Link href="/dashboard">Dashboard</Link><Link href="/results">Results</Link><Link href="/profile">Profile</Link><Link href="/credits">Photo credits</Link></>
          : <><Link href="/about">About</Link><Link href="/login">Log in</Link><Link href="/signup">Create account</Link><Link href="/credits">Photo credits</Link></>}
      </nav>
    </footer>
  );
}
