// Types et calculs partagés entre la page client et la console d'administration.

export type Sub = { t: string; f: string }; // f : d = réalisé, t = à définir, q = question ouverte
export type Bloc = {
  id: string;
  lot: string;
  name: string;
  days: number | null;
  status: string;
  scope: boolean;
  obj: string;
  in: string;
  out: string;
  deps: string[];
  cx: string;
  crit: string;
  subs: Sub[];
  note: string | null;
};
export type Lot = { id: string; name: string; sub: string; color: string };
export type Plan = {
  meta: { rate: number; reserve: number; updatedAt: string; version: number };
  statuses: string[];
  lots: Lot[];
  blocs: Bloc[];
  jalons: [string, string, string][];
};

export const STATUS_VAR: Record<string, string> = {
  "À cadrer": "--s0",
  "Cadré": "--s1",
  "En construction": "--s2",
  "En test": "--s3",
  "Validé": "--s4",
  "En production": "--s5",
};

export const has = (s: Sub, f: string) => (s.f || "").includes(f);

export function progress(b: Bloc) {
  const n = b.subs.length;
  const d = b.subs.filter((s) => has(s, "d")).length;
  return { n, d, p: n ? Math.round((d * 100) / n) : 0 };
}

export function totals(plan: Plan) {
  const t = {
    days: 0, blocs: 0, unpriced: 0, tbd: 0, q: 0, subs: 0, subsDone: 0,
    byStatus: {} as Record<string, number>, res: 0, eur: 0,
  };
  plan.statuses.forEach((s) => (t.byStatus[s] = 0));
  for (const b of plan.blocs) {
    if (!b.scope) continue;
    t.blocs++;
    if (b.days) t.days += b.days;
    else if (b.lot !== "C") t.unpriced++;
    t.byStatus[b.status] = (t.byStatus[b.status] || 0) + 1;
    for (const s of b.subs) {
      t.subs++;
      if (has(s, "d")) t.subsDone++;
      else {
        if (has(s, "t")) t.tbd++;
        if (has(s, "q")) t.q++;
      }
    }
  }
  t.res = Math.round(t.days * (1 + plan.meta.reserve));
  t.eur = t.res * plan.meta.rate;
  return t;
}

export const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
export const frDate = (iso: string) => {
  const d = iso.slice(0, 10).split("-");
  return `${d[2]}/${d[1]}/${d[0]}`;
};
export const frDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(iso));

// Contrôle minimal de forme avant enregistrement, pour ne jamais écrire un plan cassé.
export function isValidPlan(p: unknown): p is Plan {
  const x = p as Plan;
  return !!x && Array.isArray(x.blocs) && Array.isArray(x.lots) && Array.isArray(x.statuses) &&
    !!x.meta && typeof x.meta.rate === "number" && x.blocs.every((b) => typeof b.id === "string" && Array.isArray(b.subs));
}
