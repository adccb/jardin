# 🌸 garden

A cute little suite of local dev tools, in English, French, Spanish or Japanese. One stdlib-Ruby server, one page per tool, emoji nav down the left, and a ⚙️ settings page at the bottom of it for colors (🌹 Rosé Pine, 🐈 Catppuccin, 🌲 Everforest, 🦊 Nightfox, 🧛 Dracula, 🌃 Tokyo Night), language (🍔/🥐/🌽/🍙) and hidden repos.

```sh
~/src/garden/bin/garden            # opens http://localhost:4747
~/src/garden/bin/garden --help
```

| tool | what it does |
|---|---|
| 💌 pr garden (home) | your authored PRs across chosen repos, grouped into ready to merge / needs work / waiting / drafts |
| 👀 review garden | open PRs anywhere on GitHub waiting on your review, split into asked-you-by-name and asked-your-team |
| 📝 task garden | a keyboard-driven view of your Todoist day (`c` to add, `x` to finish, `?` for keys): pick which lists show as tabs (today, late, inbox, upcoming) |
| 🌿 branch garden | view and bulk-tidy local branches across `~/src` repos, one tab per repo you pick (the default branch never shows) |
| 🏡 worktree garden | the same for git worktrees: remove them (and their branches) and prune the ghosts (the main checkout never shows) |
| 🎟️ ticket garden | your assigned Jira tickets, their statuses and descriptions |
| ⚙️ settings | colors, language, and hiding repos from every page at once (the repo list comes from GitHub, so it works wherever your checkouts live) |

Curious how it all fits together? [docs/how-it-works.md](docs/how-it-works.md) walks the whole flow from disk to browser and back.

Want a look first? [docs/screenshots](docs/screenshots/README.md) has every page in light and dark, in all four languages, plus [every color scheme](docs/screenshots/palettes.md). 📸

## Jira setup

The server reads `JIRA_TOKEN_REF` (a `op://…/credential` reference to an Atlassian API token) with `op read`.
Your Atlassian email comes from the same item's `username` field, or `JIRA_EMAIL` if that's empty.
The site defaults to `https://1password.atlassian.net` (`--jira-site` or `JIRA_SITE` to change).
The 🏃 sprints panel lists every open sprint holding a ticket assigned to you (found through the Sprint field); each checked sprint gets its own tab; uncheck the ones you don't want. Every tab groups tickets into swimlanes by parent ticket.

## Hidden repos

The ⚙️ settings page lists every repo your logged-in `gh` accounts can see (owned, shared with you, or through an org) and hides the ones you tick from every page: the PR and review lists and the branch and worktree panels. Branch and worktree pages match your checkouts to GitHub by their `origin` remote, so it doesn't matter where they live. The list is saved in `~/.config/garden/settings.json` (`--config-dir` or `XDG_CONFIG_HOME` to move it).

## Todoist setup

The task page is all Todoist. Point `TODOIST_TOKEN_REF` at a Todoist API token in 1Password (`op://…`); without it, the page just explains how to set it up.
The 🗂️ lists panel picks which tabs show: ☀️ today (Todoist's `today` filter), 🐌 late (`overdue`), 📥 inbox (your Inbox project) and 📅 upcoming (`due after: today`, soonest first). The first visit shows today and late; check or uncheck the rest like any other panel.
- **Planting** (`c`) uses Todoist's quick add, so `water plants tomorrow #Home p1 @chores` sets the date, project, priority and label. A task with no date is due today; with no project it goes to your Inbox.
- **Checking off** (`x`) and **deleting** (`⌫`) both take the task off the page at once but wait 6 seconds before telling Todoist: press `u` in that time to take it back. Deletes are for good in Todoist. Leaving the page sends a waiting one straight away. A checked-off recurring task moves to its next date.

## Adding a tool

1. `lib/garden/<slug>/api.rb`: a class with `call(request, action)` returning `[status, headers, body]`
   (include `Garden::Responses` for `json`; raise `Garden::Refusal.new('errors.some_key')` for user-facing errors). Routes land at `/api/<slug>/<action>`.
2. `pages/<slug>.html.erb`: the page fragment inside the shared layout, using `<%= t('<slug>.key') %>` for text.
3. `public/js/<slug>.js` (an ES module; import `t`, `tp`, `api`… from `./garden.js`) and `public/css/<slug>.css`.
4. `locales/<lang>/<slug>.yml` for each of `en`, `fr`, `es` and `ja`, including `<slug>.title` for the sidebar.
5. Register it in `bin/garden` with `Garden::Tool.new(slug:, emoji:, api:)`.

POSTs need the `X-Garden-Token` header (the page's `api()` helper sends it), and only `localhost` Host headers are served.
