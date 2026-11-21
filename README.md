# 🌸 garden

A cute little suite of local dev tools, in English or French. One stdlib-Ruby server, one page per tool, emoji nav down the left (🇫🇷/🇬🇧 toggle at the bottom).

```sh
~/src/garden/bin/garden            # opens http://localhost:4747
~/src/garden/bin/garden --help
```

| tool | what it does |
|---|---|
| 💌 pr garden (home) | your authored PRs across chosen repos, grouped into ready to merge / needs work / waiting / drafts |
| 👀 review garden | open PRs anywhere on GitHub waiting on your review, split into asked-you-by-name and asked-your-team |
| 📝 task garden | a tiny keyboard-driven to-do list (`c` to add, `x` to finish, `?` for keys), saved to `~/.local/share/garden/tasks.json`, plus today's Todoist tasks |
| 🌿 branch garden | view and bulk-tidy local branches and worktrees across `~/src` repos |
| 🎟️ ticket garden | your assigned Jira tickets, their statuses and descriptions |

Curious how it all fits together? [docs/how-it-works.md](docs/how-it-works.md) walks the whole flow from disk to browser and back.

Want a look first? [docs/screenshots](docs/screenshots/README.md) has every page in light and dark, English and French. 📸

## Jira setup

The server reads `JIRA_TOKEN_REF` (a `op://…/credential` reference to an Atlassian API token) with `op read`.
Your Atlassian email comes from the same item's `username` field, or `JIRA_EMAIL` if that's empty.
The site defaults to `https://1password.atlassian.net` (`--jira-site` or `JIRA_SITE` to change).
The 🏃 sprints panel lists every open sprint holding a ticket assigned to you (found through the Sprint field); each ticked sprint gets its own tab, untick or 🙈 hide the ones you don't want. Every tab groups tickets into swimlanes by parent ticket.

## Todoist setup

The task page shows one of your saved Todoist filters (default `aujourd'hui`; set `TODOIST_FILTER` or `--todoist-filter` to pick another) when `TODOIST_TOKEN_REF` points at a Todoist API token in 1Password (`op://…`). Each comma-separated part of the filter gets its own tab.
Ticking a Todoist task closes it in Todoist; unticking reopens it. Nothing is ever deleted there. Without the variable, the section just doesn't appear.

## Adding a tool

1. `lib/garden/<slug>/api.rb`: a class with `call(request, action)` returning `[status, headers, body]`
   (include `Garden::Responses` for `json`; raise `Garden::Refusal.new('errors.some_key')` for user-facing errors). Routes land at `/api/<slug>/<action>`.
2. `pages/<slug>.html.erb`: the page fragment inside the shared layout, using `<%= t('<slug>.key') %>` for text.
3. `public/js/<slug>.js` (an ES module; import `t`, `tp`, `api`… from `./garden.js`) and `public/css/<slug>.css`.
4. `locales/en/<slug>.yml` and `locales/fr/<slug>.yml`, including `<slug>.title` for the sidebar.
5. Register it in `bin/garden` with `Garden::Tool.new(slug:, emoji:, api:)`.

POSTs need the `X-Garden-Token` header (the page's `api()` helper sends it), and only `localhost` Host headers are served.
