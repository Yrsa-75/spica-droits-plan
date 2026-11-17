import { redirect } from "next/navigation";
import { hasAccess } from "@/lib/access";
import { login } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function Acces({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await hasAccess()) redirect("/");
  const { e } = await searchParams;
  return (
    <main className="center-page">
      <form action={login} className="panel">
        <div className="eyebrow"><span className="seal">S</span>SPICA · Gestion des droits · Plan de construction</div>
        <h1 className="panel-title">Accès réservé</h1>
        <p className="muted">Ce plan est confidentiel. Saisissez le mot de passe transmis par YRSA Communications.</p>
        <label className="lbl" htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className="inp" />
        {e && <p className="err" role="alert">Mot de passe incorrect. Vérifiez la saisie, majuscules comprises.</p>}
        <SubmitButton label="Ouvrir le plan" pending="Vérification…" />
      </form>
    </main>
  );
}
