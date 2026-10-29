import BackButton from "../components/BackButton";
import PageShell from "../components/PageShell";
import credits from "../../lib/photo-credits.json";

export const metadata = { title: "Photo credits · MatchMyTone" };

/** Attribution for the freely licensed photographs used in recommendations (required by their CC licences). */
export default function CreditsPage() {
  const entries = Object.entries(credits).sort(([a], [b]) => a.localeCompare(b));
  return (
    <PageShell authenticated={false} width="wide">
      <div className="page-toolbar"><BackButton fallback="/" scope="public" /></div>
      <header className="page-intro reveal"><p className="eyebrow">Photo credits</p><h1>The photographers behind <em>the looks.</em></h1><p>Recommendation photos are freely licensed images from Wikimedia Commons, cropped to a consistent size. They show the style of each idea, not a specific product for sale.</p></header>
      <ul className="credits-list">{entries.map(([file, credit]) => (
        <li key={file}>
          <img src={`/assets/${file}`} alt="" loading="lazy" decoding="async" />
          <span><a href={credit.source} target="_blank" rel="noopener noreferrer">{credit.title}</a><small>{credit.author} · {credit.licence_url ? <a href={credit.licence_url} target="_blank" rel="noopener noreferrer">{credit.licence}</a> : credit.licence} · cropped and resized</small></span>
        </li>
      ))}</ul>
    </PageShell>
  );
}
