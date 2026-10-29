import { redirect } from "next/navigation";
import PageShell from "../../../components/PageShell";
import QuizResult from "../../../components/QuizResult";
import { getSession } from "../../../../lib/auth";

export default async function SkincareResultPage() {
  if (!(await getSession())) redirect("/login?next=/analyses/skincare");
  return <PageShell width="wide" className="module-skincare"><QuizResult kind="skincare" /></PageShell>;
}
