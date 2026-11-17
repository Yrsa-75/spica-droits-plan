"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import PlanView from "@/components/PlanView";
import { supabaseBrowser } from "@/lib/browser";
import { type Plan, frDateTime, isValidPlan } from "@/lib/plan";

type Version = { id: number; created_at: string; created_by_email: string | null; note: string | null };
type Current = Version & { data: Plan };

export default function Admin() {
  const sb = supabaseBrowser();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [work, setWork] = useState<Plan | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied" | "error">("idle");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [histOpen, setHistOpen] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  const load = useCallback(async () => {
    setState("loading");
    const { data, error } = await sb.from("plan_versions")
      .select("id, created_at, created_by_email, note, data").order("id", { ascending: false }).limit(1);
    if (error) { setState("error"); return; }
    if (!data || !data.length) { setState("denied"); return; }
    const row = data[0] as Current;
    setCurrent(row); setWork(row.data); setState("idle");
  }, [sb]);

  useEffect(() => { if (session) load(); }, [session, load]);

  const dirty = useMemo(() => !!current && !!work && JSON.stringify(work.blocs) !== JSON.stringify(current.data.blocs), [current, work]);

  // Prévenir la perte de modifications non enregistrées
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  async function save(plan: Plan, noteText: string) {
    if (!current || !isValidPlan(plan)) { setFlash({ kind: "err", text: "Le plan est incomplet, rien n'a été enregistré." }); return; }
    setSaving(true); setFlash(null);
    const next: Plan = { ...plan, meta: { ...plan.meta, updatedAt: new Date().toISOString().slice(0, 10), version: (current.data.meta.version || 1) + 1 } };
    const { data, error } = await sb.from("plan_versions")
      .insert({ data: next, note: noteText.trim() || null })
      .select("id, created_at, created_by_email, note, data").single();
    setSaving(false);
    if (error || !data) { setFlash({ kind: "err", text: "L'enregistrement a échoué. Vérifiez votre connexion puis réessayez." }); return; }
    const row = data as Current;
    setCurrent(row); setWork(row.data); setNote("");
    setFlash({ kind: "ok", text: `Version n° ${row.id} enregistrée. Le client la voit dès maintenant.` });
  }

  if (!ready) return <main className="center-page"><p className="muted">Chargement…</p></main>;
  if (!session) return <Login />;

  const badge = (
    <span className="admin-actions">
      <span className="badge edit"><i />Administration</span>
      <button className="btn sm" onClick={() => setHistOpen(true)}>Historique</button>
      <a className="btn sm" href="/" target="_blank" rel="noreferrer">Vue client</a>
      <button className="btn sm" onClick={() => sb.auth.signOut()}>Se déconnecter</button>
    </span>
  );

  if (state === "denied") return (
    <main className="center-page"><div className="panel">
      <h1 className="panel-title">Accès refusé</h1>
      <p className="muted">Le compte {session.user.email} n'est pas administrateur de ce plan.</p>
      <button className="btn wide" onClick={() => sb.auth.signOut()}>Changer de compte</button>
    </div></main>
  );
  if (state === "error") return (
    <main className="center-page"><div className="panel">
      <h1 className="panel-title">Plan indisponible</h1>
      <p className="muted">La base de données ne répond pas. Réessayez dans un instant.</p>
      <button className="btn primary wide" onClick={load}>Réessayer</button>
    </div></main>
  );
  if (!work || !current) return <main className="center-page"><p className="muted">Chargement du plan…</p></main>;

  return (
    <>
      <PlanView plan={work} editable onChange={setWork} badge={badge}
        updatedLabel={`Version n° ${current.id} du ${frDateTime(current.created_at)}`} />
      {(dirty || flash) && (
        <div className="save" role="region" aria-label="Enregistrement">
          {dirty ? (
            <>
              <p>Modifications non enregistrées. Le client ne les voit pas encore.</p>
              <input className="inp dark" placeholder="Note de version (facultatif)" value={note} maxLength={200}
                onChange={(e) => setNote(e.target.value)} aria-label="Note de version" />
              <button className="btn" disabled={saving} onClick={() => { setWork(current.data); setFlash(null); }}>Annuler</button>
              <button className="btn primary" disabled={saving} onClick={() => save(work, note)}>{saving ? "Enregistrement…" : "Enregistrer et publier"}</button>
            </>
          ) : flash && (
            <>
              <p className={flash.kind === "err" ? "err-inv" : ""}>{flash.text}</p>
              <button className="btn" onClick={() => setFlash(null)}>Fermer</button>
            </>
          )}
        </div>
      )}
      {histOpen && <History onClose={() => setHistOpen(false)} currentId={current.id} dirty={dirty}
        onRestore={async (id) => {
          const { data, error } = await sb.from("plan_versions").select("data").eq("id", id).single();
          if (error || !data) { setFlash({ kind: "err", text: "Impossible de charger cette version." }); return; }
          await save((data as { data: Plan }).data, `Restauration de la version n° ${id}`);
          setHistOpen(false);
        }} />}
    </>
  );
}

function Login() {
  const sb = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="center-page">
      <form className="panel" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pwd });
        setBusy(false);
        if (error) setErr("Email ou mot de passe incorrect.");
      }}>
        <div className="eyebrow"><span className="seal">S</span>SPICA · Administration du plan</div>
        <h1 className="panel-title">Connexion</h1>
        <p className="muted">Espace réservé à YRSA Communications pour mettre à jour le plan.</p>
        <label className="lbl" htmlFor="em">Email</label>
        <input id="em" className="inp" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="lbl" htmlFor="pw">Mot de passe</label>
        <input id="pw" className="inp" type="password" autoComplete="current-password" required value={pwd} onChange={(e) => setPwd(e.target.value)} />
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
    </main>
  );
}

function History({ onClose, onRestore, currentId, dirty }: { onClose: () => void; onRestore: (id: number) => Promise<void>; currentId: number; dirty: boolean }) {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<Version[] | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    sb.from("plan_versions").select("id, created_at, created_by_email, note").order("id", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data as Version[]) || []));
  }, [sb]);
  return (
    <div className="drawer-bg" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Historique des versions">
        <div className="drawer-h"><h2>Historique des versions</h2><button className="btn sm" onClick={onClose}>Fermer</button></div>
        <p className="muted small">Chaque enregistrement crée une version. Restaurer une ancienne version en crée une nouvelle : rien n'est jamais effacé.</p>
        {dirty && <p className="err small">Vous avez des modifications non enregistrées : une restauration les remplacera.</p>}
        {!rows ? <p className="muted">Chargement…</p> : (
          <ol className="hist">
            {rows.map((r) => (
              <li key={r.id} className={r.id === currentId ? "cur" : ""}>
                <div><b className="mono">n° {r.id}</b> · {frDateTime(r.created_at)}{r.id === currentId && <span className="tag q">Actuelle</span>}</div>
                <div className="muted small">{r.note || "Sans note"}{r.created_by_email ? ` · ${r.created_by_email}` : ""}</div>
                {r.id !== currentId && (confirmId === r.id ? (
                  <div className="hist-confirm">
                    <span className="small">Publier à nouveau cette version ?</span>
                    <button className="btn sm primary" disabled={busy} onClick={async () => { setBusy(true); await onRestore(r.id); setBusy(false); }}>{busy ? "…" : "Confirmer"}</button>
                    <button className="btn sm" onClick={() => setConfirmId(null)}>Annuler</button>
                  </div>
                ) : <button className="btn sm" onClick={() => setConfirmId(r.id)}>Restaurer</button>)}
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
