import { Workspace } from "@/components/workspace";
import { demoData } from "@/server/academic";
import { generatePlans } from "@/domain/planner";
import { demoState } from "@/data/demo";
export default async function Demo({
  params,
}: {
  params: Promise<{ view?: string[] }>;
}) {
  const { view } = await params;
  return (
    <Workspace
      data={demoData}
      initialState={demoState}
      demo
      view={view?.[0] ?? "dashboard"}
      onboarded
      name="Alex"
      initialPlans={generatePlans(
        demoData,
        demoData.programs[0],
        { courses: demoState.courses, programs: demoState.programs },
        demoState.preferences,
      )}
    />
  );
}
