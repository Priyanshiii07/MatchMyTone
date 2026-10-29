import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import VerifyEmail from "./VerifyEmail";

export const metadata = { title: "Verify your email · MatchMyTone" };

export default async function VerifyEmailPage({ searchParams }) {
  const token = (await searchParams)?.token;
  return <main className="inner-page auth-page"><SiteHeader /><div className="auth-wrap"><div className="auth-column"><VerifyEmail token={typeof token === "string" ? token : ""} /></div></div><SiteFooter /></main>;
}
