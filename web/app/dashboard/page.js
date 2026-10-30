import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardBackdrop from "../components/DashboardBackdrop";
import Icon from "../components/Icon";
import ModuleArt from "../components/ModuleArt";
import PageShell from "../components/PageShell";
import { MODULES } from "../components/ui";
import { apiGetWithSession, getSession } from "../../lib/auth";
import { catalogSourceText } from "../../lib/preferences";

const analyses = [
  { module: "color", text: "Find the colors that make you glow, from one live selfie.", meta: "Camera · about a minute" },
  { module: "skincare", text: "A morning and evening routine built from your skin's real needs.", meta: "10 questions + optional extras" },
  { module: "body", text: "Clothing ideas for your proportions, in the styling you choose.", meta: "8 questions" },
  { module: "face", text: "Hairstyles, frames, grooming and accessories that frame your face.", meta: "7 questions" },
];

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/dashboard");
  const prefs = await apiGetWithSession("/users/preferences");
  const resolved = prefs?.resolved;
  const firstName = String(user.name || "").split(/\s+/)[0];
  return (
    <PageShell width="wide" className="dashboard-page">
      <DashboardBackdrop />
      <header className="dashboard-welcome reveal">
        <p className="eyebrow"><Icon name="sparkle" size={14} /> Welcome back</p>
        <h1>Hello, <em>{firstName}</em>.</h1>
        <p>Choose an analysis to continue your style discovery.</p>
        {resolved && !resolved.needs_choice && <p className="styling-chip"><Icon name="hanger" size={16} />{catalogSourceText(resolved)}</p>}
      </header>
      {resolved?.needs_choice && (
        <aside className="prompt-card dashboard-prompt reveal">
          <Icon name="hanger" size={22} />
          <p><strong>Which styling ideas would you like?</strong> Choose men&apos;s, women&apos;s or unisex — until then, clothing and hair ideas stay gender-neutral.</p>
          <Link className="btn btn-primary btn-small" href="/profile/edit#style-preferences">Choose styling</Link>
        </aside>
      )}
      <ul className="analysis-grid">
        {analyses.map((analysis, index) => {
          const config = MODULES[analysis.module];
          return (
            <li key={analysis.module} className="reveal" style={{ animationDelay: `${index * 80}ms` }}>
              <article className="analysis-card">
                <ModuleArt module={analysis.module} catalog={resolved?.catalog} />
                <h2>{config.title}</h2>
                <p>{analysis.text}</p>
                <span className="card-meta">{analysis.meta}</span>
                <div className="card-actions">
                  <Link className="card-cta" href={config.href}>Start<Icon name="arrow-right" size={16} /></Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <ul className="tool-grid">
        <li className="reveal"><Link className="tool-card tool-stylist" href="/stylist"><Icon name="sparkle" size={22} /><span><strong>AI stylist</strong><small>Ask questions or generate occasion looks from your saved results.</small></span><Icon name="arrow-right" size={16} /></Link></li>
        <li className="reveal"><Link className="tool-card tool-board" href="/board"><Icon name="heart" size={22} /><span><strong>Inspiration board</strong><small>Your saved styles, looks and products in one place.</small></span><Icon name="arrow-right" size={16} /></Link></li>
        <li className="reveal"><Link className="tool-card tool-results" href="/results"><Icon name="journal" size={22} /><span><strong>Results journal</strong><small>Every saved analysis, ready to reopen or download.</small></span><Icon name="arrow-right" size={16} /></Link></li>
      </ul>
    </PageShell>
  );
}
