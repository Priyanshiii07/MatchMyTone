import { redirect } from "next/navigation";
import PageShell from "../../components/PageShell";
import QuizRunner from "../../components/QuizRunner";
import { bodyQuestions } from "../../../lib/analysis";
import { getSession } from "../../../lib/auth";

export default async function BodyShapePage() {
  if (!(await getSession())) redirect("/login?next=/analyses/body-shape");
  return <PageShell width="narrow" className="module-body"><QuizRunner module="body" title="Body Shape Quiz" intro="Eight questions about how clothes fit and where you notice changes. Your answers describe proportions only — every shape is a good shape." questions={bodyQuestions} resultPath="/analyses/body-shape/result" /></PageShell>;
}
