# 📸 garden, all dressed up

A walk through every page, ☀️ light on the left and 🌙 dark on the right. Everything you see is invented: the
"sunbeam-labs" team, its repos, PRs, tickets and to-dos come from [`demo/fixtures.rb`](demo/fixtures.rb), not from
GitHub, Jira or Todoist.

🇫🇷 [Cette visite existe aussi en français.](README.fr.md)

## 💌 pr garden

Your open PRs, grouped into ready to merge, needs work, waiting on review and drafts, with a repo panel on the left.
![pr garden](en/01-pr-garden.png)

The merged chip, for admiring what already landed.
![pr garden, merged](en/02-pr-garden-merged.png)

## 👀 review garden

PRs that asked for your review by name.
![review garden](en/03-review-garden.png)

The team tab, with one repo unticked and another tucked into the hidden group.
![review garden, team tab](en/04-review-garden-team.png)

## 📝 task garden

Today's Todoist filter in tabs, your own tasks below, and the done list open.
![task garden](en/05-task-garden.png)

Planting a new task (`c`).
![task garden, new task](en/06-task-garden-new-task.png)

The keyboard help (`?`).
![task garden, keyboard help](en/07-task-garden-keyboard-help.png)

## 🌿 branch garden

Local branches with their PR state, upstream and worktree badges.
![branch garden](en/08-branch-garden.png)

Tidying two merged branches at once.
![branch garden, tidy dialog](en/09-branch-garden-tidy.png)

Worktrees, including a ghost whose folder is gone.
![branch garden, worktrees](en/10-branch-garden-worktrees.png)

## 🎟️ ticket garden

Your tickets in swimlanes by epic, with the sprints panel on the left.
![ticket garden](en/11-ticket-garden.png)

A sprint tab, with everyone's tickets and per-lane people filters.
![ticket garden, sprint](en/12-ticket-garden-sprint.png)

A ticket opened in the drawer.
![ticket garden, ticket drawer](en/13-ticket-garden-ticket.png)

## Retaking them

The demo server runs the real pages with every API swapped for the invented data, and each `?scene=` stages a page
(tabs, dialogs, saved filters). The shooter drives headless Chrome, so it needs Google Chrome installed.

```sh
ruby docs/screenshots/demo/demo_garden.rb &                      # http://localhost:4750
ruby docs/screenshots/demo/shoot.rb docs/screenshots             # all 13 scenes × en/fr
ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket   # just one
```

Scenes live in [`demo/scenes.rb`](demo/scenes.rb); add one there and it's picked up by both.
