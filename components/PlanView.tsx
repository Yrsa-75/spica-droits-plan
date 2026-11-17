"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { type Bloc, type Lot, type Plan, STATUS_VAR, fmt, frDate, has, progress, totals } from "@/lib/plan";

type Props = {
  plan: Plan;
  editable: boolean;
  onChange?: (next: Plan) => void;
  badge?: ReactNode;
  updatedLabel?: string;
};

type View = { lot: string; show: "all" | "in" | "out" | "tbd"; status: string; q: string; open: Record<string, boolean> };
const LS = "spica-droits-plan-view-v1";
const lotColor = (l: Lot) => `var(--lot-${l.color})`;

export default function PlanView({ plan, editable, onChange, badge, updatedLabel }: Props) {
  const [view, setView] = useState<View>({ lot: "all", show: "all", status: "all", q: "", open: {} });
  const [loaded, setLoaded] = useState(false);

  // Préférences d'affichage propres à chaque visiteur (filtres, fiches ouvertes)
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(LS) || "null");
      if (v) setView((cur) => ({ ...cur, ...v }));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(LS, JSON.stringify(view)); } catch {}
  }, [view, loaded]);

  const t = useMemo(() => totals(plan), [plan]);
  const byId = useMemo(() => Object.fromEntries(plan.blocs.map((b) => [b.id, b])), [plan]);

  const update = (id: string, fn: (b: Bloc) => Bloc) => {
    if (!editable || !onChange) return;
    onChange({ ...plan, blocs: plan.blocs.map((b) => (b.id === id ? fn(b) : b)) });
  };

  const matches = (b: Bloc) => {
    if (view.lot !== "all" && b.lot !== view.lot) return false;
    if (view.status !== "all" && b.status !== view.status) return false;
    if (view.show === "in" && !b.scope) return false;
    if (view.show === "out" && b.scope) return false;
    if (view.show === "tbd") {
      const open = b.subs.some((s) => !has(s, "d") && (has(s, "t") || has(s, "q")));
      if (!open && !(b.days === null && b.lot !== "C")) return false;
    }
    if (view.q) {
      const hay = `${b.id} ${b.name} ${b.obj} ${b.subs.map((s) => s.t).join(" ")}`.toLowerCase();
      if (!hay.includes(view.q.toLowerCase())) return false;
    }
    return true;
  };
  const shown = plan.blocs.filter(matches);

  const goTo = (id: string) => {
    setView((v) => ({ ...v, lot: "all", status: "all", q: "", show: "all", open: { ...v.open, [id]: true } }));
    setTimeout(() => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow"><span className="seal">S</span>SPICA · Gestion des droits · Plan de construction v1</div>
          <h1>Tout ce que nous allons construire, bloc par bloc</h1>
          <p className="lede">
            Socle, catalogue, contrats et droits, finances, reprise des données Dabaz, travaux transverses et idées pour plus tard.
            Les blocs actifs forment le périmètre chiffré ; les blocs hachurés sont hors périmètre à ce stade.
          </p>
        </div>
        <div className="mode">
          {badge}
          {updatedLabel && <span>{updatedLabel}</span>}
        </div>
      </header>

      <section className="kpis" aria-label="Synthèse">
        <div className="kpi"><span className="lab">Périmètre actif</span><span className="val">{t.blocs} <small>blocs</small></span>
          <span className="foot"><b>{t.subs}</b> sous-blocs{t.unpriced ? <> · <b>{t.unpriced}</b> à chiffrer</> : null}</span></div>
        <div className="kpi"><span className="lab">Charge estimée</span><span className="val">{fmt(t.res)} <small>jours</small></span>
          <span className="foot"><b>{fmt(t.days)}</b> j + réserve de {Math.round(plan.meta.reserve * 100)} %</span></div>
        <div className="kpi"><span className="lab">Montant développement</span><span className="val">{fmt(t.eur)} <small>€ HT</small></span>
          <span className="foot">à {fmt(plan.meta.rate)} € HT / jour, hors services tiers</span></div>
        <div className="kpi"><span className="lab">Avancement</span>
          <span className="val">{t.subs ? Math.round((t.subsDone * 100) / t.subs) : 0} <small>% des sous-blocs</small></span>
          <div className="stack" aria-hidden="true">
            {plan.statuses.map((s) => (t.byStatus[s] ? <span key={s} title={`${s} : ${t.byStatus[s]}`} style={{ width: `${(t.byStatus[s] * 100) / t.blocs}%`, background: `var(${STATUS_VAR[s]})` }} /> : null))}
          </div>
          <span className="foot"><b>{t.tbd}</b> points à définir · <b>{t.q}</b> questions ouvertes</span></div>
      </section>

      <div className="legend">
        {plan.statuses.map((s) => <span key={s}><i className="dot" style={{ background: `var(${STATUS_VAR[s]})` }} />{s}</span>)}
        <span><i className="hatch-sw" />Hors périmètre</span>
        <span><em className="tag tbd" style={{ margin: 0 }}>À définir</em></span>
        <span><em className="tag q" style={{ margin: 0 }}>Question ouverte</em></span>
      </div>

      <section className="sec" id="carte">
        <div className="sec-h"><h2>Carte du projet</h2><p>Cliquez sur un bloc pour ouvrir sa fiche détaillée.</p></div>
        <div className="map">
          {plan.lots.map((l) => {
            const bl = plan.blocs.filter((b) => b.lot === l.id);
            const on = bl.filter((b) => b.scope);
            const d = on.reduce((a, b) => a + (b.days || 0), 0);
            return (
              <div className="lane" key={l.id} style={{ ["--lc" as string]: lotColor(l) }}>
                <div className="lane-h"><b>{l.name}</b><small>{on.length} / {bl.length} blocs actifs{d ? ` · ${fmt(d)} j` : ""}</small></div>
                <div className="tiles">
                  {bl.map((b) => {
                    const p = progress(b);
                    return (
                      <button key={b.id} className={`tile${b.scope ? "" : " off"}`} onClick={() => goTo(b.id)}
                        title={`${b.id} ${b.name} · ${b.status}${b.scope ? "" : " · hors périmètre"}`}>
                        <span className="tid">{b.id}<i className="dot" style={{ background: `var(${STATUS_VAR[b.status]})` }} /></span>
                        <span className="tn">{b.name}</span>
                        <span className="tf"><span className="mono">{b.days ? `${b.days} j` : b.lot === "C" ? "cadrage" : "à chiffrer"}</span><span className="num">{p.d}/{p.n}</span></span>
                        <span className="mini"><i style={{ width: `${p.p}%` }} /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sec">
        <div className="sec-h"><h2>Jalons cibles</h2><p>Hypothèse : démarrage le 07/12/2026, deux flux en parallèle. Dates à recaler sur la fin du contrat Dabaz.</p></div>
        <div className="road"><ol>
          {plan.jalons.map((j) => {
            const l = plan.lots.find((x) => x.id === j[2]) || plan.lots[0];
            return <li key={j[0] + j[1]} className={j[0] <= today ? "past" : ""} style={{ ["--lc" as string]: lotColor(l) }}>
              <div className="d">{frDate(j[0])}</div><div className="t">{j[1]}</div></li>;
          })}
        </ol></div>
      </section>

      <div className="bar" id="detail"><div className="bar-in">
        <label className="field"><span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Rechercher un bloc, une tâche" value={view.q} aria-label="Rechercher"
            onChange={(e) => setView({ ...view, q: e.target.value })} /></label>
        <label className="field"><select aria-label="Lot" value={view.lot} onChange={(e) => setView({ ...view, lot: e.target.value })}>
          <option value="all">Tous les lots</option>{plan.lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label className="field"><select aria-label="Statut" value={view.status} onChange={(e) => setView({ ...view, status: e.target.value })}>
          <option value="all">Tous les statuts</option>{plan.statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="seg" role="group" aria-label="Afficher">
          {([["all", "Tout"], ["in", "Actifs"], ["out", "Hors périmètre"], ["tbd", "À définir"]] as const).map(([k, lab]) => (
            <button key={k} aria-pressed={view.show === k} onClick={() => setView({ ...view, show: k })}>{lab}</button>))}
        </div>
        <button className="btn" onClick={() => setView({ ...view, open: Object.fromEntries(shown.map((b) => [b.id, true])) })}>Tout déplier</button>
        <button className="btn" onClick={() => setView({ ...view, open: {} })}>Tout replier</button>
        <span className="count">{shown.length} bloc{shown.length > 1 ? "s" : ""} affiché{shown.length > 1 ? "s" : ""}</span>
      </div></div>

      {plan.lots.map((l) => {
        const bl = plan.blocs.filter((b) => b.lot === l.id && matches(b));
        if (!bl.length) return null;
        const all = plan.blocs.filter((b) => b.lot === l.id && b.scope);
        const d = all.reduce((a, b) => a + (b.days || 0), 0);
        return (
          <section className="lot" key={l.id} style={{ ["--lc" as string]: lotColor(l) }}>
            <div className="lot-h"><h3><span>{l.id}</span>{l.name}</h3><p>{l.sub}</p>
              <span className="tot">{d ? <><b className="num">{fmt(d)} j</b> actifs · </> : null}{all.length} bloc{all.length > 1 ? "s" : ""} actif{all.length > 1 ? "s" : ""}</span></div>
            <div className="cards">
              {bl.map((b) => (
                <Card key={b.id} b={b} lot={l} plan={plan} byId={byId} editable={editable} open={!!view.open[b.id]}
                  onToggle={() => setView({ ...view, open: { ...view.open, [b.id]: !view.open[b.id] } })}
                  onGo={goTo} update={update} />
              ))}
            </div>
          </section>
        );
      })}
      {!shown.length && <div className="empty" style={{ marginTop: 24 }}>Aucun bloc ne correspond à ces filtres.</div>}

      <footer className="foot-note">
        <span>Plan établi par YRSA Communications pour SPICA à partir des exports Dabaz du 16/11/2026.</span>
        <span>Chiffrage provisoire tant que les exports des ventes, cessions et contrats n'ont pas été analysés.</span>
      </footer>
    </div>
  );
}

function Card({ b, lot, plan, byId, editable, open, onToggle, onGo, update }: {
  b: Bloc; lot: Lot; plan: Plan; byId: Record<string, Bloc>; editable: boolean; open: boolean;
  onToggle: () => void; onGo: (id: string) => void; update: (id: string, fn: (b: Bloc) => Bloc) => void;
}) {
  const p = progress(b);
  const sc = `var(${STATUS_VAR[b.status] || "--s0"})`;
  const broken = b.scope ? b.deps.filter((d) => byId[d] && !byId[d].scope) : [];
  const needed = plan.blocs.filter((x) => x.deps.includes(b.id));

  return (
    <article className={`card${b.scope ? "" : " off"}${open ? " open" : ""}`} id={`c-${b.id}`} style={{ ["--lc" as string]: lotColor(lot) }}>
      <div className="chead">
        <button className="exp" onClick={onToggle} aria-expanded={open} aria-controls={`b-${b.id}`}>
          <span className="chev" aria-hidden="true">›</span><span className="cid">{b.id}</span>
        </button>
        <button className="exp" onClick={onToggle} tabIndex={-1} style={{ minWidth: 0 }}><span className="cname">{b.name}</span></button>
        <div className="ctrl">
          <span className="prog" title="Sous-blocs réalisés"><span className="pb"><i style={{ width: `${p.p}%` }} /></span><span className="num">{p.d}/{p.n}</span></span>
          {editable && b.lot !== "C" ? (
            <DaysInput value={b.days} id={b.id} onCommit={(n) => update(b.id, (x) => ({ ...x, days: n }))} />
          ) : b.days ? <span className="days">{b.days} j</span> : <span className="days none">{b.lot === "C" ? "inclus" : "à chiffrer"}</span>}
          {editable ? (
            <select className="pill" style={{ ["--sc" as string]: sc }} value={b.status} aria-label={`Statut de ${b.id}`}
              onChange={(e) => update(b.id, (x) => ({ ...x, status: e.target.value }))}>
              {plan.statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          ) : (
            <span className="pill" style={{ ["--sc" as string]: sc }}><i className="dot" />{b.status}</span>
          )}
          {editable ? (
            <label className="sw" title={b.scope ? "Dans le périmètre" : "Hors périmètre"}>
              <input type="checkbox" checked={b.scope} aria-label={`${b.id} dans le périmètre`}
                onChange={(e) => update(b.id, (x) => ({ ...x, scope: e.target.checked }))} />
              <span className="track" /><span>{b.scope ? "Actif" : "Inactif"}</span>
            </label>
          ) : (
            <span className={`scope-chip${b.scope ? " on" : ""}`}>{b.scope ? "Dans le périmètre" : "Hors périmètre"}</span>
          )}
        </div>
        <div className="cobj">{b.obj}</div>
        {broken.length > 0 && <div className="warnline">⚠ Ce bloc dépend de {broken.join(", ")}, actuellement hors périmètre.</div>}
      </div>
      {open && (
        <div className="cbody" id={`b-${b.id}`}>
          <div className="facts">
            {b.note && <div className="note">{b.note}</div>}
            <div className="fact"><div className="k">Entrées</div><div className="v">{b.in}</div></div>
            <div className="fact"><div className="k">Sorties</div><div className="v">{b.out}</div></div>
            <div className="fact"><div className="k">Dépend de</div><div className="chips">
              {b.deps.length ? b.deps.map((d) => (
                <button key={d} className={`chip dep${byId[d] && !byId[d].scope && b.scope ? " bad" : ""}`} title={byId[d]?.name} onClick={() => onGo(d)}>{d}</button>
              )) : <span className="chip">Aucune</span>}
            </div></div>
            {needed.length > 0 && <div className="fact"><div className="k">Nécessaire à</div><div className="chips">
              {needed.map((x) => <button key={x.id} className="chip dep" title={x.name} onClick={() => onGo(x.id)}>{x.id}</button>)}
            </div></div>}
            <div className="fact"><div className="k">Complexité · criticité</div><div className="chips"><span className="chip">{b.cx}</span><span className="chip">{b.crit}</span></div></div>
          </div>
          <ul className="subs">
            <li className="k">Sous-blocs et livrables</li>
            {b.subs.map((s, i) => {
              const d = has(s, "d");
              return (
                <li key={i} className={`sub${d ? " done" : ""}`}>
                  <input type="checkbox" checked={d} disabled={!editable} aria-label={`Réalisé : ${s.t}`}
                    onChange={(e) => update(b.id, (x) => ({
                      ...x,
                      subs: x.subs.map((y, j) => (j === i ? { ...y, f: e.target.checked ? y.f.replace("d", "") + "d" : y.f.replace("d", "") } : y)),
                    }))} />
                  <span className="st">{s.t}{has(s, "t") && <em className="tag tbd">À définir</em>}{has(s, "q") && <em className="tag q">Question ouverte</em>}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}

// Saisie des jours (console d'administration uniquement).
// Vide = « à chiffrer ». Jours entiers de 1 à 200, validés à la sortie du champ ou avec Entrée.
function DaysInput({ value, id, onCommit }: { value: number | null; id: string; onCommit: (n: number | null) => void }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [err, setErr] = useState(false);
  useEffect(() => { setDraft(value == null ? "" : String(value)); setErr(false); }, [value]);
  const commit = () => {
    const t = draft.trim();
    if (t === "") { setErr(false); if (value !== null) onCommit(null); return; }
    const n = Number(t.replace(",", "."));
    if (!Number.isInteger(n) || n < 1 || n > 200) { setErr(true); return; }
    setErr(false);
    if (n !== value) onCommit(n);
  };
  return (
    <label className={`days-edit${err ? " bad" : ""}${value == null ? " empty" : ""}`}
      title={err ? "Saisissez un nombre entier de jours entre 1 et 200, ou laissez vide pour « à chiffrer »" : "Charge en jours-homme. Laisser vide pour « à chiffrer »"}>
      <input type="text" inputMode="numeric" value={draft} placeholder="à chiffrer" aria-label={`Jours de ${id}`}
        aria-invalid={err} maxLength={3}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(value == null ? "" : String(value)); setErr(false); } }} />
      <span>j</span>
    </label>
  );
}
