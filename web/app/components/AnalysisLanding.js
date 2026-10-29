import Link from "next/link";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

export default function AnalysisLanding({ eyebrow, title, description, icon, detail, action = "Begin analysis" }) {
  return (
    <main className="inner-page">
      <SiteHeader />
      <div className="inner-content shell">
        <div className="page-intro">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <section className="feature-panel">
          <div className="analysis-icon" aria-hidden="true">{icon}</div>
          <h2>Made personal, from the first question.</h2>
          <p>{detail}</p>
          <div className="feature-next">
            <Link className="gold-button" href="/login">{action} <span aria-hidden="true">↗</span></Link>
            <Link className="text-link" href="/">Back to home</Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
