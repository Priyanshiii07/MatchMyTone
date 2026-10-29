import AuthCard from "../components/AuthCard";
import BackButton from "../components/BackButton";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function LoginPage() {
  return <main className="inner-page auth-page"><SiteHeader /><div className="auth-wrap"><div className="auth-column"><div className="page-toolbar"><BackButton fallback="/" scope="public" /></div><AuthCard mode="login" /></div></div><SiteFooter /></main>;
}
