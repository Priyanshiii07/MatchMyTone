import { redirect } from "next/navigation";
import BackButton from "../components/BackButton";
import PageShell from "../components/PageShell";
import { getSession } from "../../lib/auth";
import InspirationBoard from "./InspirationBoard";

export default async function BoardPage() {
  if (!(await getSession())) redirect("/login?next=/board");
  return (
    <PageShell width="wide" className="module-board">
      <div className="page-toolbar"><BackButton fallback="/dashboard" /></div>
      <header className="page-intro reveal"><p className="eyebrow">Inspiration board</p><h1>Everything you <em>loved.</em></h1><p>Looks, styles, products and shades you&apos;ve saved. Your analysis history stays in your Results journal.</p></header>
      <InspirationBoard />
    </PageShell>
  );
}
