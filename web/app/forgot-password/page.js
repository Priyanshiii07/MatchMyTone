import AuthCard from "../components/AuthCard";
import BackButton from "../components/BackButton";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function ForgotPasswordPage() {
  return <main className="inner-page auth-page"><SiteHeader /><div className="auth-wrap"><div className="auth-column"><div className="page-toolbar"><BackButton fallback="/login" scope="public" /></div><AuthCard mode="forgot" /></div></div><SiteFooter /></main>;
}
