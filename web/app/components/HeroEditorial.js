import heroSlides from "../../lib/hero-slides.json";

/**
 * Editorial hero: real fashion photographs cross-fade slowly, each paired with the palette sampled from
 * that photo (lib/hero-slides.json, generated from the image pixels). CSS-only, so no JavaScript animation
 * library; prefers-reduced-motion shows the first slide still. Photo attribution is on the /credits page.
 */
export default function HeroEditorial() {
  const slides = heroSlides.slides;
  const duration = slides.length * 6;
  return (
    <div className="hero-editorial" style={{ "--slides": slides.length, "--cycle": `${duration}s` }}>
      <div className="hero-frame">
        {slides.map((slide, index) => (
          <figure key={slide.photo} className="hero-slide" style={{ "--i": index }}>
            <img src={`/assets/${slide.photo}`} alt={slide.alt} fetchPriority={index === 0 ? "high" : "low"} loading={index === 0 ? "eager" : "lazy"} decoding="async" />
            <figcaption>
              <span className="hero-slide-label">{slide.label}</span>
              <span className="hero-palette-strip" aria-label={`Colours from this photo: ${slide.palette.map((color) => color.name).join(", ")}`} role="img">
                {slide.palette.map((color, swatch) => <span key={color.hex} style={{ background: color.hex, "--s": swatch }} />)}
              </span>
            </figcaption>
          </figure>
        ))}
        <span className="hero-frame-line" aria-hidden="true" />
      </div>
      {heroSlides.accents.map((accent, index) => (
        <figure key={accent.photo} className={`hero-accent hero-accent-${index + 1}`} aria-hidden="true">
          <img src={`/assets/${accent.photo}`} alt="" loading="lazy" decoding="async" />
        </figure>
      ))}
      <div className="hero-swatches" aria-hidden="true">{heroSlides.swatches.map((hex, index) => <span key={hex} style={{ background: hex, "--i": index }} />)}</div>
    </div>
  );
}
