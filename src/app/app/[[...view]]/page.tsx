import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAcademicData } from "@/server/academic";
import { readStudent } from "@/server/student";
import { Plan } from "@/domain/types";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Application({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [{ view }, data, student] = await Promise.all([
    params,
    getAcademicData(),
    readStudent(session.user.id),
  ]);
  return (
    <Workspace
      data={data}
      initialState={student.state}
      demo={false}
      view={view?.[0] ?? "dashboard"}
      onboarded={student.onboarded}
      name={session.user.name ?? "Student"}
      initialPlans={student.draftPlans as unknown as Plan[]}
      savedPlans={student.plans.map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
