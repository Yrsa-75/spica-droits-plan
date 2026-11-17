import { redirect } from "next/navigation";
import PlanView from "@/components/PlanView";
import { getCurrentPlan, hasAccess } from "@/lib/access";
import { frDateTime } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasAccess())) redirect("/acces");
  const current = await getCurrentPlan();
  if (!current) {
    return (
      <main className="center-page">
        <div className="panel">
          <h1 className="panel-title">Plan momentanément indisponible</h1>
          <p className="muted">Le plan n'a pas pu être chargé. Réessayez dans quelques minutes ; si le problème persiste, prévenez YRSA Communications.</p>
        </div>
      </main>
    );
  }
  return (
    <PlanView
      plan={current.data}
      editable={false}
      badge={<span className="badge"><i />Consultation</span>}
      updatedLabel={`Mis à jour le ${frDateTime(current.created_at)}`}
    />
  );
}
