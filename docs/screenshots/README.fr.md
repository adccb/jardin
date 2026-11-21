# 📸 garden, sur son trente-et-un

Une visite de chaque page, ☀️ en clair à gauche et 🌙 en sombre à droite. Tout ce que tu vois est inventé :
l'équipe « sunbeam-labs », ses dépôts, ses PR, ses tickets et ses tâches viennent de
[`demo/fixtures.rb`](demo/fixtures.rb), pas de GitHub, Jira ou Todoist.

🇬🇧 [This tour is also in English.](README.md)

## 💌 jardin des PR

Tes PR ouvertes, rangées en prêtes à merger, à retravailler, en attente de relecture et brouillons, avec la liste
des dépôts à gauche.
![jardin des PR](fr/01-pr-garden.png)

Le filtre « fusionnées », pour admirer ce qui a déjà atterri.
![jardin des PR, fusionnées](fr/02-pr-garden-merged.png)

## 👀 jardin des relectures

Les PR qui t'ont demandée par ton nom.
![jardin des relectures](fr/03-review-garden.png)

L'onglet équipe, avec un dépôt décoché et un autre mis de côté dans les cachés.
![jardin des relectures, onglet équipe](fr/04-review-garden-team.png)

## 📝 jardin des tâches

Le filtre Todoist du jour en onglets, tes propres tâches en dessous, et la liste des terminées ouverte.
![jardin des tâches](fr/05-task-garden.png)

Planter une nouvelle tâche (`c`).
![jardin des tâches, nouvelle tâche](fr/06-task-garden-new-task.png)

L'aide du clavier (`?`).
![jardin des tâches, aide du clavier](fr/07-task-garden-keyboard-help.png)

## 🌿 jardin des branches

Les branches locales avec l'état de leur PR, leur upstream et leur worktree.
![jardin des branches](fr/08-branch-garden.png)

Ranger deux branches mergées d'un coup.
![jardin des branches, rangement](fr/09-branch-garden-tidy.png)

Les worktrees, dont un fantôme dont le dossier a disparu.
![jardin des branches, worktrees](fr/10-branch-garden-worktrees.png)

## 🎟️ jardin des tickets

Tes tickets en couloirs par epic, avec la liste des sprints à gauche.
![jardin des tickets](fr/11-ticket-garden.png)

Un onglet de sprint, avec les tickets de toute l'équipe et un filtre par personne dans chaque couloir.
![jardin des tickets, sprint](fr/12-ticket-garden-sprint.png)

Un ticket ouvert dans le tiroir.
![jardin des tickets, tiroir du ticket](fr/13-ticket-garden-ticket.png)

## Les refaire

Le serveur de démo fait tourner les vraies pages, avec chaque API remplacée par les données inventées, et chaque
`?scene=` met une page en scène (onglets, fenêtres, filtres enregistrés). Le photographe pilote Chrome sans interface,
donc il faut que Google Chrome soit installé.

```sh
ruby docs/screenshots/demo/demo_garden.rb &                      # http://localhost:4750
ruby docs/screenshots/demo/shoot.rb docs/screenshots             # les 13 scènes × en/fr
ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket   # juste une
```

Les scènes vivent dans [`demo/scenes.rb`](demo/scenes.rb) ; ajoutes-en une et les deux scripts la prennent en compte.
