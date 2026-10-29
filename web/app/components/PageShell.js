import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

/** Standard page frame: header, decorated background and a centred content column. */
export default function PageShell({ children, authenticated = true, width = "default", footer = true, className = "" }) {
  return (
    <main className={`inner-page ${className}`.trim()}>
      <SiteHeader authenticated={authenticated} />
      <div className={`inner-content shell shell-${width}`}>{children}</div>
      {footer && <SiteFooter authenticated={authenticated} />}
    </main>
  );
}
