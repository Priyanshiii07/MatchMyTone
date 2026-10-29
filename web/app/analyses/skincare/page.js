import { redirect } from "next/navigation";
import PageShell from "../../components/PageShell";
import { getSession } from "../../../lib/auth";
import SkincareQuiz from "./SkincareQuiz";

export default async function SkincareAnalysisPage() {
  if (!(await getSession())) redirect("/login?next=/analyses/skincare");
  return <PageShell width="narrow" className="module-skincare"><SkincareQuiz /></PageShell>;
}
