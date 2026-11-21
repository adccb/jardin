# 📸 garden, sur son trente-et-un

Une visite de chaque page dans les couleurs par défaut 🍭 fairyfloss, ☀️ en clair à gauche et 🌙 en sombre à droite. Tout ce que tu vois est inventé : l'équipe « sunbeam-labs », ses dépôts, ses PR, ses tickets et ses tâches viennent de [`demo/fixtures.rb`](demo/fixtures.rb), pas de GitHub, Jira ou Todoist.

[🍔 English](README.md) · **🥐 Français** · [🌽 Español](README.es.md) · [🍙 日本語](README.ja.md)  
🎨 [Chaque page dans les autres palettes (en anglais)](palettes.md)

## 💌 jardin des PR

Tes PR ouvertes, rangées en prêtes à merger, à retravailler, en attente de relecture et brouillons, avec la liste des dépôts à gauche.
![01-pr-garden](fr/01-pr-garden.jpg)

Le filtre « fusionnées », pour admirer ce qui a déjà atterri.
![02-pr-garden-merged](fr/02-pr-garden-merged.jpg)

## 👀 jardin des relectures

Les PR qui t'ont demandée par ton nom.
![03-review-garden](fr/03-review-garden.jpg)

L'onglet équipe, avec un dépôt décoché et un autre mis de côté dans les cachés.
![04-review-garden-team](fr/04-review-garden-team.jpg)

## 📝 jardin des tâches

Le filtre Todoist du jour en onglets, tes propres tâches en dessous, et la liste des terminées ouverte.
![05-task-garden](fr/05-task-garden.jpg)

Planter une nouvelle tâche (`c`).
![06-task-garden-new-task](fr/06-task-garden-new-task.jpg)

L'aide du clavier (`?`).
![07-task-garden-keyboard-help](fr/07-task-garden-keyboard-help.jpg)

## 🌿 jardin des branches

Les branches locales avec l'état de leur PR, leur upstream et leur worktree.
![08-branch-garden](fr/08-branch-garden.jpg)

Ranger deux branches mergées d'un coup.
![09-branch-garden-tidy](fr/09-branch-garden-tidy.jpg)

Les worktrees, dont un fantôme dont le dossier a disparu.
![10-branch-garden-worktrees](fr/10-branch-garden-worktrees.jpg)

## 🎟️ jardin des tickets

Tes tickets en couloirs par epic, avec la liste des sprints à gauche.
![11-ticket-garden](fr/11-ticket-garden.jpg)

Un onglet de sprint, avec les tickets de toute l'équipe et un filtre par personne dans chaque couloir.
![12-ticket-garden-sprint](fr/12-ticket-garden-sprint.jpg)

Un ticket ouvert dans le tiroir.
![13-ticket-garden-ticket](fr/13-ticket-garden-ticket.jpg)

## 🎨 couleurs

Le menu des couleurs en bas de la barre latérale, au-dessus de celui des langues.
![14-color-menu](fr/14-color-menu.jpg)

## Les refaire

Le serveur de démo fait tourner les vraies pages, avec chaque API remplacée par les données inventées, et chaque `?scene=` met une page en scène (onglets, fenêtres, filtres enregistrés). Le photographe pilote Chrome sans interface, donc il faut que Google Chrome soit installé ; `gallery.rb` réécrit ensuite ces pages.

```sh
ruby docs/screenshots/demo/demo_garden.rb &                     # http://localhost:4750
ruby docs/screenshots/demo/shoot.rb docs/screenshots            # chaque scène, langue et palette
ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket  # juste une scène
ruby docs/screenshots/demo/gallery.rb                           # réécrire les galeries
```

Les scènes vivent dans [`demo/scenes.rb`](demo/scenes.rb), les légendes dans [`demo/gallery.rb`](demo/gallery.rb).
