import { redirect } from "next/navigation";
import PageShell from "../../../components/PageShell";
import QuizResult from "../../../components/QuizResult";
import { getSession } from "../../../../lib/auth";

export default async function FaceResultPage() {
  if (!(await getSession())) redirect("/login?next=/analyses/face-shape");
  return <PageShell width="wide" className="module-face"><QuizResult kind="face" /></PageShell>;
}
