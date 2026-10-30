import Link from "next/link";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import ModuleArt from "./components/ModuleArt";
import PaletteDemo from "./components/PaletteDemo";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import HeroStickers from "./components/HeroStickers";
import StyleArt from "./components/StyleArt";

const FEATURES = [
  ["color", "Color Analysis", "One live selfie reveals your undertone and seasonal palette, then turns it into outfit combinations you can wear."],
  ["skincare", "Skincare Analysis", "A short quiz becomes a morning and evening routine built from your skin's needs — with shaving, workout and makeup care if you want it."],
  ["face", "Face Analysis", "Hairstyles, frames and accessories that suit your face shape and your hair."],
  ["body", "Body Analysis", "Clothing ideas for your proportions in men's, women's or unisex styling — no measurements needed."],
];
const STEPS = [
  ["user", "Tell us what you like", "Choose men's, women's or unisex styling, plus the occasions you dress for. Everything is optional."],
  ["sparkle", "Run an analysis", "A live selfie for color, short questionnaires for skin, face and body."],
  ["journal", "Keep your guide", "Results, saved styles and printable summaries stay in your private journal."],
];
// Illustrated stickers (the home page only); recommendation pages use real photographs.
const CATALOG_PREVIEW = [
  ["Men's styling", [["shirt", "Oxford shirt", "#5B6C8F"], ["nehru-jacket", "Nehru jacket", "#005F60"], ["hair-quiff", "Quiff", "#5B3A29"]]],
  ["Women's styling", [["saree", "Saree", "#C2593F"], ["blazer", "Belted blazer", "#C98B9B"], ["hair-lob", "Layered lob", "#6B3F2A"]]],
  ["Unisex styling", [["hoodie", "Hoodie", "#6B705C"], ["denim-jacket", "Denim jacket", "#5B6C8F"], ["hair-shag", "Modern shag", "#4A3426"]]],
];

export default function WelcomePage() {
  return (
    <main className="welcome-page">
      <SiteHeader />
      <section className="welcome-hero shell">
        <div className="welcome-copy reveal">
          <Logo size={72} className="hero-logo" />
          <p className="eyebrow"><Icon name="sparkle" size={14} /> Personal color & style, for everyone</p>
          <h1 className="hero-headline">Discover the colors and styles that feel like <em>you.</em></h1>
          <p>MatchMyTone reads your palette from a live selfie and turns quick questionnaires into a styling guide for your face, body and skin — in the styling you choose.</p>
          <div className="action-group"><Link className="btn btn-primary" href="/signup">Discover your style<Icon name="arrow-right" /></Link><Link className="btn btn-quiet" href="#analyses">Explore the analyses</Link></div>
          <p className="hero-login">Already have an account? <Link href="/login">Log in</Link></p>
        </div>
        <HeroStickers />
      </section>

      <section id="analyses" className="shell home-section" aria-labelledby="features-title">
        <header className="home-section-head"><p className="eyebrow">Four analyses</p><h2 id="features-title">Everything about your style, in one place</h2></header>
        <ul className="feature-grid">{FEATURES.map(([module, title, text], index) => (
          <li key={module} className="feature-card reveal" style={{ animationDelay: `${index * 70}ms` }}>
            <ModuleArt module={module} catalog="unisex" />
            <h3>{title}</h3><p>{text}</p>
            <Link className="card-cta" href="/signup">Start<Icon name="arrow-right" size={16} /></Link>
          </li>
        ))}</ul>
      </section>

      <section className="shell home-section" aria-labelledby="how-title">
        <header className="home-section-head"><p className="eyebrow">How it works</p><h2 id="how-title">Three steps to your personal guide</h2></header>
        <ol className="steps-grid">{STEPS.map(([icon, title, text], index) => (
          <li key={title} className="step-card"><span className="step-number">{index + 1}</span><Icon name={icon} size={22} /><h3>{title}</h3><p>{text}</p></li>
        ))}</ol>
      </section>

      <section className="shell home-section" aria-labelledby="catalog-title">
        <header className="home-section-head"><p className="eyebrow">Styling for everyone</p><h2 id="catalog-title">Your recommendations, your way</h2><p>Gender on your profile is only a starting point — pick men&apos;s, women&apos;s or unisex at any time. A few examples from the catalog:</p></header>
        <div className="catalog-preview">{CATALOG_PREVIEW.map(([title, items]) => (
          <article key={title} className="catalog-column">
            <h3>{title}</h3>
            <ul>{items.map(([art, label, color]) => <li key={art}><span className="sticker catalog-sticker"><StyleArt art={art} color={color} /></span>{label}</li>)}</ul>
          </article>
        ))}</div>
      </section>

      <section className="shell home-section palette-section" aria-labelledby="demo-title">
        <header className="home-section-head"><p className="eyebrow">Try it</p><h2 id="demo-title">See a palette come to life</h2><p>Pick a sample palette and watch it flow into real pieces — your own analysis does this with your colors.</p></header>
        <PaletteDemo />
      </section>

      <section className="shell home-section privacy-band" aria-labelledby="privacy-title">
        <Icon name="check" size={22} />
        <div><h2 id="privacy-title">Private by design</h2><p>Your selfie is used only for your color analysis and isn&apos;t stored as an image. Style preferences are optional and never guessed from a photo. Your results belong to your account only.</p></div>
      </section>
      <SiteFooter />
    </main>
  );
}
