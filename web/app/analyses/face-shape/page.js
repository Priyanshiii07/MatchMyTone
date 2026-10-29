import { redirect } from "next/navigation";
import PageShell from "../../components/PageShell";
import QuizRunner from "../../components/QuizRunner";
import { faceQuestions } from "../../../lib/analysis";
import { getSession } from "../../../lib/auth";

export default async function FaceShapePage() {
  if (!(await getSession())) redirect("/login?next=/analyses/face-shape");
  return <PageShell width="narrow" className="module-face"><QuizRunner module="face" title="Face Shape Quiz" intro="Seven questions about your forehead, cheekbones and jawline. A mirror helps, but go with what you see." questions={faceQuestions} resultPath="/analyses/face-shape/result" /></PageShell>;
}
