import Link from "next/link";
import BackButton from "../components/BackButton";
import PageShell from "../components/PageShell";

export default function AboutPage() {
  return (
    <PageShell authenticated={false} width="narrow">
      <div className="page-toolbar"><BackButton fallback="/" scope="public" /></div>
      <header className="page-intro reveal"><p className="eyebrow">About MatchMyTone</p><h1>Your style is <em>personal.</em></h1><p>MatchMyTone brings color, skincare, body-shape and face-shape guidance into one warm, practical space. Our goal is not to put you in a box — it is to help you notice what already feels like you.</p></header>
      <section className="profile-card reveal"><h2>Discover, save, return</h2><p>Take a guided analysis, explore the recommendations, and keep your results in your private journal whenever you need a little inspiration.</p><Link className="btn btn-primary" href="/signup">Start discovering</Link></section>
    </PageShell>
  );
}
