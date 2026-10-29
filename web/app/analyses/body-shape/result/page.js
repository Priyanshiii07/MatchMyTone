import { redirect } from "next/navigation";
import PageShell from "../../../components/PageShell";
import QuizResult from "../../../components/QuizResult";
import { getSession } from "../../../../lib/auth";

export default async function BodyResultPage() {
  if (!(await getSession())) redirect("/login?next=/analyses/body-shape");
  return <PageShell width="wide" className="module-body"><QuizResult kind="body" /></PageShell>;
}
