# 📸 garden, all dressed up

A walk through every page in the default 🍭 fairyfloss colors, ☀️ light on the left and 🌙 dark on the right. Everything you see is invented: the "sunbeam-labs" team, its repos, PRs, tickets and to-dos come from [`demo/fixtures.rb`](demo/fixtures.rb), not from GitHub, Jira or Todoist.

**🍔 English** · [🥐 Français](README.fr.md) · [🌽 Español](README.es.md) · [🍙 日本語](README.ja.md)  
🎨 [Every page in the other color schemes](palettes.md)

## 💌 pr garden

Your open PRs, grouped into ready to merge, needs work, waiting on review and drafts, with a repo panel on the left.
![01-pr-garden](en/01-pr-garden.jpg)

The merged chip, for admiring what already landed.
![02-pr-garden-merged](en/02-pr-garden-merged.jpg)

## 👀 review garden

PRs that asked for your review by name.
![03-review-garden](en/03-review-garden.jpg)

The team tab, with one repo unchecked and another tucked into the hidden group.
![04-review-garden-team](en/04-review-garden-team.jpg)

## 📝 task garden

Today's Todoist filter in tabs, your own tasks below, and the done list open.
![05-task-garden](en/05-task-garden.jpg)

Planting a new task (`c`).
![06-task-garden-new-task](en/06-task-garden-new-task.jpg)

The keyboard help (`?`).
![07-task-garden-keyboard-help](en/07-task-garden-keyboard-help.jpg)

## 🌿 branch garden

Local branches with their PR state, upstream and worktree badges.
![08-branch-garden](en/08-branch-garden.jpg)

Tidying two merged branches at once.
![09-branch-garden-tidy](en/09-branch-garden-tidy.jpg)

Worktrees, including a ghost whose folder is gone.
![10-branch-garden-worktrees](en/10-branch-garden-worktrees.jpg)

## 🎟️ ticket garden

Your tickets in swimlanes by epic, with the sprints panel on the left.
![11-ticket-garden](en/11-ticket-garden.jpg)

A sprint tab, with everyone's tickets and per-lane people filters.
![12-ticket-garden-sprint](en/12-ticket-garden-sprint.jpg)

A ticket opened in the drawer.
![13-ticket-garden-ticket](en/13-ticket-garden-ticket.jpg)

## 🎨 colors

The color menu at the bottom of the sidebar, above the language one.
![14-color-menu](en/14-color-menu.jpg)

## Retaking them

The demo server runs the real pages with every API swapped for the invented data, and each `?scene=` stages a page (tabs, dialogs, saved filters). The shooter drives headless Chrome, so it needs Google Chrome installed; `gallery.rb` then rewrites these pages.

```sh
ruby docs/screenshots/demo/demo_garden.rb &                     # http://localhost:4750
ruby docs/screenshots/demo/shoot.rb docs/screenshots            # every scene, every language and palette
ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket  # just one scene
ruby docs/screenshots/demo/gallery.rb                           # rewrite the gallery pages
```

Scenes live in [`demo/scenes.rb`](demo/scenes.rb), captions in [`demo/gallery.rb`](demo/gallery.rb).
