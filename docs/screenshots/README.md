# 📸 garden, all dressed up

A walk through every page in the default 🌹 Rosé Pine colors, ☀️ light on the left and 🌙 dark on the right. Everything you see is invented: the "sunbeam-labs" team, its repos, PRs, tickets and to-dos come from [`demo/fixtures.rb`](demo/fixtures.rb), not from GitHub, Jira or Todoist.

**🍔 English** · [🥐 Français](README.fr.md) · [🌽 Español](README.es.md) · [🍙 日本語](README.ja.md)  
🎨 [Every page in the other color schemes](palettes.md) · 🧺 [Each garden in every color](by-page/README.md)

## 🌻 home

The home page: what's ready to merge, waiting on your review, due today and on your plate in Jira.
![00-home](en/00-home.jpg)

## 💌 pr garden

Your open PRs, grouped into ready to merge, needs work, waiting on review and drafts, with a repo panel on the left.
![01-pr-garden](en/01-pr-garden.jpg)

The merged chip, for admiring what already landed.
![02-pr-garden-merged](en/02-pr-garden-merged.jpg)

## 👀 review garden

PRs that asked for your review by name.
![03-review-garden](en/03-review-garden.jpg)

The team tab, with one repo unchecked in the panel.
![04-review-garden-team](en/04-review-garden-team.jpg)

## 📝 task garden

The lists panel on the left, with today and late showing as tabs.
![05-task-garden](en/05-task-garden.jpg)

Planting a new task (`c`).
![06-task-garden-new-task](en/06-task-garden-new-task.jpg)

The keyboard help (`?`).
![07-task-garden-keyboard-help](en/07-task-garden-keyboard-help.jpg)

## 🌿 branch garden

One tab per repo in the panel, its branches showing PR state, upstream and worktree badges.
![08-branch-garden](en/08-branch-garden.jpg)

Tidying two merged branches at once.
![09-branch-garden-tidy](en/09-branch-garden-tidy.jpg)

## 🏡 worktree garden

One tab per repo of worktrees, including a ghost whose folder is gone.
![10-worktree-garden](en/10-worktree-garden.jpg)

## 🎟️ ticket garden

Your tickets in swimlanes by epic, with the sprints panel on the left.
![11-ticket-garden](en/11-ticket-garden.jpg)

A sprint tab, with everyone's tickets and per-lane people filters.
![12-ticket-garden-sprint](en/12-ticket-garden-sprint.jpg)

A ticket opened in the drawer.
![13-ticket-garden-ticket](en/13-ticket-garden-ticket.jpg)

## ⚙️ settings

Colors and language up top, which pages the sidebar shows, then hiding repos everywhere at once; the repo list comes from GitHub.
![14-settings](en/14-settings.jpg)

## Retaking them

The demo server runs the real pages with every API swapped for the invented data, and each `?scene=` stages a page (tabs, dialogs, saved filters). The shooter drives headless Chrome, so it needs Google Chrome installed; `gallery.rb` then rewrites these pages.

```sh
ruby docs/screenshots/demo/demo_garden.rb &                     # http://localhost:4750
ruby docs/screenshots/demo/shoot.rb docs/screenshots            # every scene, every language and palette
ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket  # just one scene
ruby docs/screenshots/demo/gallery.rb                           # rewrite the gallery pages
```

Scenes live in [`demo/scenes.rb`](demo/scenes.rb), captions in [`demo/gallery.rb`](demo/gallery.rb).
