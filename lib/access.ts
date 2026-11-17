import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Plan } from "./plan";
import seed from "@/data/seed.json";

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
  const viewer_secret = env("PLAN_VIEWER_SECRET");
  const { data, error } = await supabase.rpc("current_plan", { viewer_secret });
  if (error) {
    console.error("Lecture du plan impossible", error.message);
    return null;
  }
  if (data) return data as { data: Plan; created_at: string };

  // Aucune version en base : première installation. On charge data/seed.json une seule fois
  // (la fonction SQL refuse si une version existe déjà ou si le secret est faux).
  const init = await supabase.rpc("init_plan", { viewer_secret, seed });
  if (init.error || !init.data) {
    console.error("Plan vide et chargement initial impossible", init.error?.message);
    return null;
  }
  const again = await supabase.rpc("current_plan", { viewer_secret });
  if (again.error || !again.data) return null;
  return again.data as { data: Plan; created_at: string };
}
