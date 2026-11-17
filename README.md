# Plan SPICA Droits

Page de présentation du plan de construction de la plateforme de gestion des droits SPICA (remplacement de Dabaz), en ligne.
Dupliqué du plan ORBYSS (`Yrsa-75/orbyss-plan`) : même code, autres données.

- `/` : page client en lecture seule, protégée par mot de passe (cookie valable 30 jours).
- `/admin` : console d'administration (connexion Supabase) pour activer / désactiver les blocs, saisir les jours d'un bloc (entier de 1 à 200, vide = « à chiffrer »), changer les statuts, cocher les sous-blocs, publier et restaurer une version. Les blocs du lot Cadrage (C) ne sont pas chiffrés.

## Pile

Next.js 16 (App Router) sur Vercel (région Paris, cdg1), Supabase (région Paris, eu-west-3).

## Variables d'environnement (Vercel)

| Nom | Rôle |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | URL du projet Supabase |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Clé publique Supabase (lecture protégée par RLS) |
| PLAN_VIEWER_SECRET | Secret serveur exigé pour lire le plan côté client (son empreinte SHA-256 est dans `plan_settings`) |
| CLIENT_PASSWORD | Mot de passe communiqué au client. Le changer déconnecte tous les visiteurs |

## Données

- `plan_versions` : une ligne par enregistrement, ajout seul (déclencheur qui refuse toute modification ou suppression). La version courante est la plus récente. Restaurer = republier une ancienne version comme nouvelle ligne.
- `plan_admins` : emails autorisés à modifier le plan. Ajouter un administrateur : `insert into plan_admins values ('email@exemple.fr');` puis créer son compte dans Supabase > Authentication > Users.
- `plan_settings` : empreinte du secret serveur.

## Changer le mot de passe client

Vercel > projet spica-droits-plan > Settings > Environment Variables > CLIENT_PASSWORD, puis redéployer.

## Contenu initial du plan

`data/seed.json` contient la version 1 du plan (familles, blocs, sous-blocs, jours, jalons). Il sert uniquement à remplir la base la première fois : ensuite, tout se modifie depuis `/admin` et chaque enregistrement crée une nouvelle version.

Familles : C Cadrage (non chiffré), S Socle, K Catalogue, D Contrats et droits, F Finances, R Reprise des données, T Transverse, X Plus tard. Les couleurs des familles sont dans `app/globals.css` (variables `--lot-...`).

## Installer sur une nouvelle base Supabase

1. Exécuter `supabase/migrations/001_plan.sql` puis `002_init_plan.sql`.
2. Enregistrer l'empreinte SHA-256 de `PLAN_VIEWER_SECRET` dans `plan_settings` (clé `viewer_secret_sha256`).
3. Ouvrir la page `/` une première fois : si la base est vide, `data/seed.json` est chargé automatiquement comme version n° 1 (fonction `init_plan`, sans effet ensuite).
4. Ajouter l'email de l'administrateur dans `plan_admins` et créer son compte dans Authentication > Users.
