import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Plan } from "./plan";

export const ACCESS_COOKIE = "spica_droits_acces";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

// Jeton d'accès client : dérivé du mot de passe et du secret serveur.
// Changer CLIENT_PASSWORD déconnecte automatiquement tous les visiteurs.
export function accessToken() {
  return createHash("sha256").update(`${env("CLIENT_PASSWORD")}:${env("PLAN_VIEWER_SECRET")}`).digest("hex");
}

export function passwordMatches(input: string) {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(env("CLIENT_PASSWORD")).digest();
  return timingSafeEqual(a, b);
}

export async function hasAccess() {
  const c = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!c) return false;
  const expected = accessToken();
  return c.length === expected.length && timingSafeEqual(Buffer.from(c), Buffer.from(expected));
}

// Lecture du plan courant via une fonction SQL qui exige le secret serveur :
// la clé publique seule ne permet pas de lire le plan.
export async function getCurrentPlan(): Promise<{ data: Plan; created_at: string } | null> {
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc("current_plan", { viewer_secret: env("PLAN_VIEWER_SECRET") });
  if (error || !data) {
    console.error("Lecture du plan impossible", error?.message);
    return null;
  }
  return data as { data: Plan; created_at: string };
}
