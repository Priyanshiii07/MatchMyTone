import { redirect } from "next/navigation";
import BackButton from "../components/BackButton";
import PageShell from "../components/PageShell";
import { getSession } from "../../lib/auth";
import StylistStudio from "./StylistStudio";

export default async function StylistPage({ searchParams }) {
  if (!(await getSession())) redirect("/login?next=/stylist");
  const params = await searchParams;
  const pick = (value) => (Array.isArray(value) ? value[0] : value) || "";
  return (
    <PageShell width="wide" className="module-stylist">
      <div className="page-toolbar"><BackButton fallback="/dashboard" /></div>
      <header className="page-intro reveal"><p className="eyebrow">Your AI stylist</p><h1>Personal styling, <em>on request.</em></h1><p>Ask questions or create outfits for any occasion. Everything is based on your own saved analyses — your selfie is never analysed again.</p></header>
      <StylistStudio initialTab={pick(params?.tab) === "looks" ? "looks" : "chat"} module={pick(params?.module)} question={pick(params?.ask).slice(0, 300)} />
    </PageShell>
  );
}
