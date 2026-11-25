# Invented data for the demo garden: a fictional "sunbeam-labs" team. No real people, repos or tickets.
module Demo
  module Fixtures
    module_function

    HOME = '/Users/sunny'
    ORG = 'sunbeam-labs'
    JIRA = 'https://sunbeam.atlassian.net'

    def ago(hours) = (Time.now - (hours * 3600)).utc.iso8601
    def days(count) = ago(count * 24)
    def date_in(count) = (Date.today + count).iso8601

    def checks(pass: 0, fail: 0, pending: 0)
      [{ 'conclusion' => 'SUCCESS', 'status' => 'COMPLETED' }] * pass +
        [{ 'conclusion' => 'FAILURE', 'status' => 'COMPLETED' }] * fail +
        [{ 'conclusion' => nil, 'status' => 'IN_PROGRESS' }] * pending
    end

    def review(login, state) = { 'author' => { 'login' => login }, 'state' => state }
    def labels(*names) = names.map { |name| { 'name' => name } }

    # ---------- 💌 pr garden ----------

    PR_REPOS = %w[petal-api meadow-web fern-cli hive-infra pollen-sdk seedling-docs].freeze

    def pr_repos
      PR_REPOS.map { |name| { slug: "#{ORG}/#{name}", name: } } +
        [{ slug: 'sunny-sideup/dotfiles', name: 'dotfiles' }, { slug: 'sunny-sideup/recipe-box', name: 'recipe-box' }]
    end

    # ---------- ⚙️ settings ----------

    # Every repo "GitHub" lists for the demo, a couple already hidden.
    SETTINGS_EXTRA = [['sunbeam-labs/greenhouse-legacy', { archived: true }], ['sunbeam-labs/compost-bot', {}],
                      ['sunbeam-labs/weather-vane', { private: true }], ['sunny-sideup/garden-journal', { private: true }]].freeze
    SETTINGS_HIDDEN = %w[sunbeam-labs/greenhouse-legacy sunny-sideup/garden-journal].freeze

    def settings_repos
      repos = pr_repos.map { |repo| [repo[:slug], {}] } + SETTINGS_EXTRA
      repos.sort_by { _1.first.downcase }.map do |slug, extra|
        { slug:, private: extra[:private] || false, archived: extra[:archived] || false, hidden: SETTINGS_HIDDEN.include?(slug) }
      end
    end

    def open_pr(number, title, head, extra = {})
      {
        'number' => number, 'title' => title, 'url' => "https://github.com/#{ORG}/x/pull/#{number}", 'state' => 'OPEN',
        'isDraft' => false, 'headRefName' => head, 'baseRefName' => 'main', 'labels' => [], 'reviewRequests' => [],
        'latestReviews' => [], 'statusCheckRollup' => checks(pass: 18), 'mergeable' => 'MERGEABLE',
        'mergeStateStatus' => 'BLOCKED', 'reviewDecision' => 'REVIEW_REQUIRED', 'createdAt' => days(3), 'updatedAt' => ago(5)
      }.merge(extra)
    end

    def done_pr(number, title, head, state, hours, size)
      stamp = state == 'MERGED' ? { 'mergedAt' => ago(hours) } : { 'closedAt' => ago(hours) }
      { 'number' => number, 'title' => title, 'url' => "https://github.com/#{ORG}/x/pull/#{number}", 'state' => state,
        'isDraft' => false, 'headRefName' => head, 'baseRefName' => 'main', 'labels' => [], 'additions' => size[0],
        'deletions' => size[1], 'createdAt' => ago(hours + 70), 'updatedAt' => ago(hours) }.merge(stamp)
    end

    def raw_prs(slug, state)
      repo = slug.split('/').last
      return send("#{state}_prs_#{repo.tr('-', '_')}") if respond_to?("#{state}_prs_#{repo.tr('-', '_')}")

      []
    end

    def pr_list(state, slugs)
      repos = slugs.map do |slug|
        prs = raw_prs(slug, state).map do |pr|
          Garden::Prs::PullRequest.new(pr.merge('url' => pr['url'].sub('/x/', "/#{slug.split('/').last}/")),
                                       repo: slug).to_h
        end
        { slug:, name: slug.split('/').last, ok: true, prs: }
      end
      { state:, repos: }
    end

    def open_prs_petal_api
      [
        open_pr(1482, 'Add rate limiting to the pollen ingest endpoint', 'sunny/ingest-rate-limit',
                'reviewDecision' => 'APPROVED', 'mergeStateStatus' => 'CLEAN', 'additions' => 214, 'deletions' => 31,
                'latestReviews' => [review('maple-okafor', 'APPROVED')], 'labels' => labels('backend'), 'updatedAt' => ago(2)),
        open_pr(1479, 'Stream garden snapshots instead of buffering them', 'sunny/stream-snapshots',
                'reviewDecision' => 'CHANGES_REQUESTED', 'additions' => 388, 'deletions' => 142,
                'latestReviews' => [review('juniper-tran', 'CHANGES_REQUESTED')], 'updatedAt' => ago(20)),
        open_pr(1490, 'Retry flaky webhook deliveries with jittered backoff', 'sunny/webhook-retries',
                'statusCheckRollup' => checks(pass: 14, pending: 3), 'reviewRequests' => [{ 'login' => 'basil-moreau' }],
                'additions' => 96, 'deletions' => 12, 'updatedAt' => ago(1)),
        open_pr(1493, 'Spike: try a columnar store for bloom history', 'sunny/columnar-spike',
                'isDraft' => true, 'additions' => 702, 'deletions' => 4, 'reviewDecision' => nil, 'updatedAt' => days(2))
      ]
    end

    def open_prs_meadow_web
      [
        open_pr(921, 'Keyboard shortcuts for the planting calendar', 'sunny/calendar-shortcuts',
                'reviewDecision' => 'APPROVED', 'mergeStateStatus' => 'CLEAN', 'additions' => 158, 'deletions' => 40,
                'latestReviews' => [review('maple-okafor', 'APPROVED'), review('wren-castillo', 'APPROVED')],
                'labels' => labels('a11y', 'frontend'), 'updatedAt' => ago(6)),
        open_pr(918, 'Dark mode for the seed catalog', 'sunny/catalog-dark-mode',
                'statusCheckRollup' => checks(pass: 20, fail: 1), 'mergeable' => 'CONFLICTING', 'mergeStateStatus' => 'DIRTY',
                'additions' => 245, 'deletions' => 88, 'labels' => labels('frontend'), 'updatedAt' => days(1)),
        open_pr(925, 'Translate the onboarding tour into French', 'sunny/onboarding-fr',
                'reviewRequests' => [{ 'login' => 'wren-castillo' }, { 'login' => 'juniper-tran' }],
                'latestReviews' => [review('hazel-nakamura', 'COMMENTED')], 'mergeStateStatus' => 'BEHIND',
                'additions' => 412, 'deletions' => 9, 'labels' => labels('i18n'), 'updatedAt' => ago(9))
      ]
    end

    def open_prs_fern_cli
      [
        open_pr(311, 'fern prune: skip worktrees with uncommitted changes', 'sunny/prune-dirty-worktrees',
                'reviewRequests' => [{ 'login' => 'basil-moreau' }], 'additions' => 64, 'deletions' => 7, 'updatedAt' => ago(30))
      ]
    end

    def merged_prs_petal_api
      [
        done_pr(1471, 'Cache sunlight forecasts for an hour', 'sunny/forecast-cache', 'MERGED', 26, [88, 14]),
        done_pr(1466, 'Upgrade to Ruby 3.4 and drop the old JSON shim', 'sunny/ruby-34', 'MERGED', 70, [120, 301]),
        done_pr(1460, 'Log bloom events without personal data', 'sunny/bloom-log-pii', 'MERGED', 140, [45, 60])
      ]
    end

    def merged_prs_meadow_web
      [
        done_pr(915, 'Swap the hand-rolled modal for <dialog>', 'sunny/native-dialog', 'MERGED', 8, [74, 196]),
        done_pr(909, 'Focus rings that are visible on every theme', 'sunny/focus-rings', 'MERGED', 96, [33, 12])
      ]
    end

    def merged_prs_fern_cli
      [done_pr(305, 'Add --dry-run to fern tidy', 'sunny/tidy-dry-run', 'MERGED', 50, [58, 3])]
    end

    def closed_prs_petal_api
      [done_pr(1455, 'Try GraphQL for the garden API (superseded)', 'sunny/graphql-attempt', 'CLOSED', 200, [940, 12])]
    end

    # ---------- 👀 review garden ----------

    def request(repo, number, title, author, via, extra = {})
      raw = { 'repository' => { 'nameWithOwner' => "#{ORG}/#{repo}" }, 'number' => number, 'title' => title,
              'url' => "https://github.com/#{ORG}/#{repo}/pull/#{number}", 'author' => { 'login' => author },
              'isDraft' => false, 'labels' => [], 'commentsCount' => 0, 'createdAt' => days(2), 'updatedAt' => ago(4) }
      Garden::Reviews::Request.new(raw.merge(extra), via:).to_h
    end

    def review_requests
      [
        request('petal-api', 1488, 'Move bloom scoring into its own service object', 'maple-okafor', 'you',
                'commentsCount' => 3, 'updatedAt' => ago(1), 'labels' => labels('backend')),
        request('meadow-web', 927, 'Make the planting calendar work with a screen reader', 'wren-castillo', 'you',
                'commentsCount' => 7, 'updatedAt' => ago(3), 'labels' => labels('a11y')),
        request('fern-cli', 314, 'Shell completions for zsh and fish', 'basil-moreau', 'you', 'createdAt' => days(6),
                                                                                              'updatedAt' => days(1)),
        request('pollen-sdk', 77, 'Typed errors for the pollen client', 'hazel-nakamura', 'you', 'commentsCount' => 1,
                                                                                                 'updatedAt' => ago(26)),
        request('petal-api', 1485, 'Nightly job to compost stale sessions', 'juniper-tran', 'team',
                'commentsCount' => 2, 'updatedAt' => ago(7)),
        request('hive-infra', 203, 'Bump the database to Postgres 17', 'ash-delacroix', 'team',
                'commentsCount' => 11, 'labels' => labels('infra', 'needs-ops'), 'updatedAt' => ago(5)),
        request('hive-infra', 206, 'Alert when the greenhouse queue backs up', 'ash-delacroix', 'team',
                'updatedAt' => ago(30)),
        request('meadow-web', 930, 'Lazy-load the seed catalog images', 'rowan-achebe', 'team', 'isDraft' => true,
                                                                                                'updatedAt' => days(2)),
        request('seedling-docs', 58, 'Document the webhook retry policy', 'linden-park', 'team',
                'labels' => labels('docs'), 'updatedAt' => days(3)),
        request('pollen-sdk', 79, 'Publish the SDK to the internal registry', 'hazel-nakamura', 'team',
                'commentsCount' => 4, 'updatedAt' => days(4))
      ]
    end

    # ---------- 📝 task garden ----------


    # Per language: the demo's open Todoist tasks as [content, project]. TODO_SHAPES says which are late.
    TODOIST = {
      'en' => [['Pay the gardener invoice', 'Home'], ['Team stand-up', 'Work'], ['Repot the basil', 'Garden'], ['Call grandma', 'Family'], ['Cherry tomatoes', 'Groceries'], ['Seed-starting compost', 'Groceries'], ['Coffee beans', 'Groceries']],
      'fr' => [['Payer la facture du jardinier', 'Maison'], ['Stand-up de l’équipe', 'Travail'], ['Rempoter le basilic', 'Jardin'], ['Appeler mamie', 'Famille'], ['Tomates cerises', 'Courses'], ['Terreau pour semis', 'Courses'], ['Café en grains', 'Courses']],
      'es' => [['Pagarle al jardinero', 'Casa'], ['Stand-up del equipo', 'Trabajo'], ['Trasplantar la albahaca', 'Jardín'], ['Llamar a la abuela', 'Familia'], ['Tomates cherry', 'Súper'], ['Tierra para almácigos', 'Súper'], ['Café en grano', 'Súper']],
      'ja' => [['庭師さんの請求書を払う', '家'], ['チームのスタンドアップ', '仕事'], ['バジルを植え替える', '庭'], ['おばあちゃんに電話する', '家族'], ['ミニトマト', '買い物'], ['種まき用の土', '買い物'], ['コーヒー豆', '買い物']]
    }.freeze

    # How each demo Todoist task is due and flagged, in list order; the overdue ones land in the late tab.
    # Per language: the inbox's name, its tasks, and upcoming tasks as [content, project, days away].
    MORE_LISTS = {
      'en' => ['Inbox', ['Look into a standing desk', 'Ideas for the garden party 🎉'],
               [['Dentist appointment', 'Home', 1], ['Mulch the rose beds', 'Garden', 3], ['Quarterly planning prep', 'Work', 6]]],
      'fr' => ['Boîte de réception', ['Me renseigner sur un bureau debout', 'Idées pour la fête au jardin 🎉'],
               [['Rendez-vous chez le dentiste', 'Maison', 1], ['Pailler les rosiers', 'Jardin', 3], ['Préparer la planification du trimestre', 'Travail', 6]]],
      'es' => ['Bandeja de entrada', ['Investigar un escritorio de pie', 'Ideas para la fiesta del jardín 🎉'],
               [['Cita con el dentista', 'Casa', 1], ['Poner mantillo a los rosales', 'Jardín', 3], ['Preparar la planificación trimestral', 'Trabajo', 6]]],
      'ja' => ['インボックス', ['スタンディングデスクを調べる', 'ガーデンパーティーのアイデア 🎉'],
               [%w[歯医者の予約 家] + [1], %w[バラの花壇にマルチングする 庭] + [3], %w[四半期の計画の準備 仕事] + [6]]]
    }.freeze

    TODO_SHAPES = [
      { priority: 1, due: -1, overdue: true }, { priority: 2, time: '09:30', recurring: true },
      { priority: 3, labels: ['weekend'] }, { priority: 4, time: '18:00' },
      { priority: 4 }, { priority: 3, due: -3, overdue: true }, { priority: 2 }
    ].freeze

    def todo(id, content, project, priority, due: 0, overdue: false, labels: [], time: nil, recurring: false)
      due_date = due && date_in(due)
      { id: "demo#{id}", content:, project:, labels:, priority:, due_date:, due_datetime: time && "#{due_date}T#{time}:00",
        recurring:, overdue:, url: "https://app.todoist.com/app/task/demo#{id}" }
    end

    def todoist(locale, tabs = 'today,late')
      tasks = TODOIST.fetch(locale, TODOIST['en']).zip(TODO_SHAPES).each_with_index.map do |((content, project), shape), index|
        todo(index + 1, content, project, shape[:priority], **shape.except(:priority))
      end
      late, today = tasks.partition { _1[:overdue] }
      inbox_name, inbox, upcoming = MORE_LISTS.fetch(locale, MORE_LISTS['en'])
      lists = {
        'today' => today, 'late' => late,
        'inbox' => inbox.each_with_index.map { |content, i| todo(20 + i, content, inbox_name, 4 - i, due: i.zero? ? nil : 2) },
        'upcoming' => upcoming.each_with_index.map { |(content, project, days), i| todo(30 + i, content, project, [2, 4, 3][i], due: days) }
      }
      sections = lists.slice(*tabs.split(',')).map { |key, list| { key:, tasks: list } }
      { enabled: true, sections: }
    end

    # ---------- 🌿 branch garden ----------

    def branch_repos
      %w[petal-api meadow-web fern-cli].map { |name| { path: "#{HOME}/src/#{name}", name: } }
    end

    def branch(name, subject, hours, extra = {})
      { name:, date: ago(hours), subject:, sha: format('%07x', name.sum * 7919 % 0xfffffff), ahead: 2, behind: 0,
        upstream: "origin/#{name}", gone: false, current: false, merged: false, default: false, worktree: nil, pr: nil }.merge(extra)
    end

    def gh_pr(number, state, title) = { number:, state:, title:, url: "https://github.com/#{ORG}/petal-api/pull/#{number}" }

    def branch_state(path = nil)
      repo_name = path ? File.basename(path) : 'petal-api'
      return small_branch_state(repo_name) unless repo_name == 'petal-api'

      repo = "#{HOME}/src/petal-api"
      tree = ->(name) { "#{HOME}/src/petal-api-worktrees/#{name.split('/').last}" }
      branches = [
        branch('main', 'Merge pull request #1471 from sunny/forecast-cache', 4, default: true, current: true, ahead: 0,
                                                                                upstream: 'origin/main'),
        branch('sunny/ingest-rate-limit', 'Rate limit pollen ingest per hive', 2, ahead: 6,
                                                                                  pr: gh_pr(1482, 'OPEN', 'Add rate limiting'), worktree: tree['sunny/ingest-rate-limit']),
        branch('sunny/stream-snapshots', 'Stream snapshots in 64 KB chunks', 20, ahead: 9, behind: 14,
                                                                                 pr: gh_pr(1479, 'OPEN', 'Stream garden snapshots')),
        branch('sunny/forecast-cache', 'Cache sunlight forecasts', 30, ahead: 3, gone: true,
                                                                       upstream: 'origin/sunny/forecast-cache', pr: gh_pr(1471, 'MERGED', 'Cache sunlight forecasts'), worktree: tree['sunny/forecast-cache']),
        branch('sunny/ruby-34', 'Drop the old JSON shim', 74, ahead: 4, gone: true,
                                                              pr: gh_pr(1466, 'MERGED', 'Upgrade to Ruby 3.4')),
        branch('sunny/bloom-log-pii', 'Scrub emails from bloom logs', 150, merged: true, ahead: 0,
                                                                           pr: gh_pr(1460, 'MERGED', 'Log bloom events without personal data')),
        branch('sunny/graphql-attempt', 'WIP: graphql schema for gardens', 210, ahead: 22, behind: 180,
                                                                                pr: gh_pr(1455, 'CLOSED', 'Try GraphQL')),
        branch('sunny/columnar-spike', 'Spike columnar bloom history', 48, ahead: 11,
                                                                           pr: gh_pr(1493, 'OPEN', 'Spike: columnar store')),
        branch('scratch/benchmarks', 'Benchmark snapshot serializers', 400, ahead: 5, upstream: nil)
      ]
      worktrees = [
        { path: repo, head: 'a1b2c3d4e5', branch: 'main', detached: false, locked: false, prunable: false, main: true,
          missing: false, dirty: 0 },
        { path: tree['sunny/ingest-rate-limit'], head: 'b2c3d4e5f6', branch: 'sunny/ingest-rate-limit',
          detached: false, locked: false, prunable: false, main: false, missing: false, dirty: 3 },
        { path: tree['sunny/forecast-cache'], head: 'c3d4e5f6a7', branch: 'sunny/forecast-cache', detached: false,
          locked: false, prunable: false, main: false, missing: false, dirty: 0 },
        { path: "#{HOME}/src/petal-api-worktrees/old-experiment", head: 'd4e5f6a7b8', branch: nil, detached: true,
          locked: false, prunable: true, main: false, missing: true, dirty: 0 }
      ]
      { repo:, name: 'petal-api', home: HOME, default_branch: 'main', pr_info: true, branches:, worktrees: }
    end

    # The other demo repos are quieter: a main checkout and a couple of branches each.
    def small_branch_state(name)
      repo = "#{HOME}/src/#{name}"
      extra = {
        'meadow-web' => [branch('sunny/petal-picker', 'Petal picker for the bloom form', 26, pr: gh_pr(812, 'OPEN', 'Petal picker')),
                         branch('sunny/old-navbar', 'Retire the old navbar', 320, merged: true, ahead: 0, gone: true,
                                                                                  pr: gh_pr(790, 'MERGED', 'Retire the old navbar'))],
        'fern-cli' => [branch('sunny/completions', 'Shell completions for fern', 96, upstream: nil)]
      }.fetch(name, [])
      branches = [branch('main', 'Release v2.4.0', 12, default: true, current: true, ahead: 0, upstream: 'origin/main'), *extra]
      worktrees = [{ path: repo, head: 'e5f6a7b8c9', branch: 'main', detached: false, locked: false, prunable: false, main: true,
                     missing: false, dirty: 0 }]
      { repo:, name:, home: HOME, default_branch: 'main', pr_info: true, branches:, worktrees: }
    end

    # ---------- 🎟️ ticket garden ----------

    PEOPLE = { me: 'Sunny Sideup', maple: 'Maple Okafor', juniper: 'Juniper Tran', basil: 'Basil Moreau',
               wren: 'Wren Castillo' }.freeze

    def parent(key, summary, type: 'Epic', status: ['In Progress', 'indeterminate'])
      { key:, summary:, type:, priority: 'Medium', status: { name: status[0], category: status[1] } }
    end

    EPICS = {
      calendar: ['BLOOM-12', 'Planting calendar 2.0'],
      ingest: ['BLOOM-30', 'Reliable pollen ingest'],
      a11y: ['ROOT-4', 'Accessibility audit fixes']
    }.freeze

    def ticket(key, summary, status, extra = {})
      name, category = status
      who = extra.key?(:who) ? extra.delete(:who) : :me
      epic = extra.delete(:epic)
      {
        key:, summary:, url: "#{JIRA}/browse/#{key}", status: { name:, category: },
        type: { name: extra.delete(:type) || 'Task', subtask: false }, priority: extra.delete(:priority) || 'Medium',
        project: { key: key.split('-').first, name: key.start_with?('BLOOM') ? 'Bloom' : 'Roots' },
        parent: epic && parent(*EPICS.fetch(epic)), assignee: who && { name: PEOPLE.fetch(who) }, mine: who == :me,
        labels: extra.delete(:labels) || [], updated: ago(extra.delete(:updated) || 5), created: days(extra.delete(:created) || 12),
        resolved: nil, due: extra.delete(:due)
      }
    end

    TODO = ['To Do', 'new'].freeze
    DOING = ['In Progress', 'indeterminate'].freeze
    REVIEW = ['In Review', 'indeterminate'].freeze
    DONE = %w[Done done].freeze

    def my_tickets
      [
        ticket('BLOOM-41', 'Keyboard shortcuts for moving plantings between weeks', DOING, epic: :calendar,
                                                                                           type: 'Story', priority: 'High', updated: 2, due: date_in(4)),
        ticket('BLOOM-44', 'Show frost warnings on the calendar', TODO, epic: :calendar, type: 'Story', updated: 20),
        ticket('BLOOM-47', 'Calendar jumps a week when crossing daylight saving', REVIEW, epic: :calendar, type: 'Bug',
                                                                                          priority: 'Highest', updated: 1, labels: ['customer-reported']),
        ticket('BLOOM-33', 'Rate limit ingest per hive, not per org', REVIEW, epic: :ingest, priority: 'High',
                                                                              updated: 3),
        ticket('BLOOM-35', 'Dead-letter queue for rejected pollen batches', TODO, epic: :ingest, updated: 50),
        ticket('ROOT-9', 'Announce form errors to screen readers', DOING, epic: :a11y, type: 'Bug', updated: 8,
                                                                          labels: ['a11y']),
        ticket('ROOT-11', 'Visible focus ring on the seed catalog filters', TODO, epic: :a11y, priority: 'Low',
                                                                                  updated: 70, labels: ['a11y']),
        ticket('BLOOM-52', 'Write the Postgres 17 upgrade runbook', TODO, type: 'Task', updated: 26, due: date_in(9))
      ]
    end

    def jira_mine = { view: 'mine', site: JIRA, include_done: false, tickets: my_tickets }

    def jira_sprints
      [
        { id: 501, name: 'Bloom Sprint 14', state: 'active', start: days(6), end: ago(-8 * 24), mine: 3 },
        { id: 502, name: 'Roots Sprint 7', state: 'active', start: days(3), end: ago(-11 * 24), mine: 2 },
        { id: 503, name: 'Bloom Sprint 15', state: 'future', start: nil, end: nil, mine: 1 }
      ]
    end

    def sprint_tickets
      [
        ticket('BLOOM-41', 'Keyboard shortcuts for moving plantings between weeks', DOING, epic: :calendar,
                                                                                           type: 'Story', priority: 'High', updated: 2),
        ticket('BLOOM-47', 'Calendar jumps a week when crossing daylight saving', REVIEW, epic: :calendar, type: 'Bug',
                                                                                          priority: 'Highest', updated: 1),
        ticket('BLOOM-45', 'Drag to copy a planting to next season', DOING, epic: :calendar, type: 'Story',
                                                                            who: :maple, updated: 6),
        ticket('BLOOM-46', 'Print view for the planting calendar', TODO, epic: :calendar, who: :wren, priority: 'Low',
                                                                         updated: 30),
        ticket('BLOOM-33', 'Rate limit ingest per hive, not per org', REVIEW, epic: :ingest, priority: 'High',
                                                                              updated: 3),
        ticket('BLOOM-36', 'Backfill missing pollen counts from March', DOING, epic: :ingest, who: :juniper,
                                                                               updated: 9),
        ticket('BLOOM-38', 'Alert when ingest lag passes five minutes', TODO, epic: :ingest, who: :basil, updated: 40),
        ticket('BLOOM-29', 'Remove the legacy v1 ingest endpoint', DONE, epic: :ingest, who: :juniper, updated: 70),
        ticket('BLOOM-50', 'Bump the Rails security patch', TODO, who: nil, priority: 'High', updated: 12)
      ].each_with_index.map { |ticket, position| ticket.merge(position:) }
    end

    def roots_sprint_tickets
      [
        ticket('ROOT-9', 'Announce form errors to screen readers', DOING, epic: :a11y, type: 'Bug', updated: 8,
                                                                          labels: ['a11y']),
        ticket('ROOT-11', 'Visible focus ring on the seed catalog filters', TODO, epic: :a11y, priority: 'Low',
                                                                                  updated: 70),
        ticket('ROOT-12', 'Label the icon-only buttons in the toolbar', REVIEW, epic: :a11y, who: :wren, updated: 4),
        ticket('ROOT-14', 'Respect reduced motion on the bloom animation', DONE, epic: :a11y, who: :wren, updated: 30),
        ticket('ROOT-15', 'Color contrast pass on the dark theme', TODO, epic: :a11y, who: :maple, updated: 18)
      ].each_with_index.map { |ticket, position| ticket.merge(position:) }
    end

    def next_sprint_tickets
      [
        ticket('BLOOM-52', 'Write the Postgres 17 upgrade runbook', TODO, updated: 26),
        ticket('BLOOM-55', 'Seasonal templates for new gardens', TODO, type: 'Story', who: :basil, updated: 50),
        ticket('BLOOM-56', 'Export the planting calendar as iCal', TODO, epic: :calendar, type: 'Story', who: nil,
                                                                         updated: 90)
      ].each_with_index.map { |ticket, position| ticket.merge(position:) }
    end

    def jira_sprint_view(id)
      sprint = jira_sprints.find { |s| s[:id].to_s == id.to_s } || jira_sprints.first
      tickets = { 502 => roots_sprint_tickets, 503 => next_sprint_tickets }.fetch(sprint[:id]) { sprint_tickets }
      { view: 'sprint', site: JIRA, sprint: sprint.except(:mine), tickets: }
    end

    def jira_ticket(key)
      found = (my_tickets + sprint_tickets).find { |t| t[:key] == key } || ticket(key, key, TODO)
      { ticket: found, description_html: DESCRIPTION }
    end

    DESCRIPTION = <<~HTML.freeze
      <h3>What’s happening</h3>
      <p>When a planting sits in the week that crosses the daylight-saving change, the calendar shows it one week late. It only happens for gardens in time zones that observe DST.</p>
      <h3>Steps to reproduce</h3>
      <ol><li>Set your garden’s time zone to <code>Europe/Paris</code>.</li><li>Plant something for the last week of October.</li><li>Open the calendar in month view.</li></ol>
      <div class="adf-panel adf-panel-warning"><p>⚠️ Two customers reported this last week, so it’s on the sprint’s must-fix list.</p></div>
      <h3>Acceptance criteria</h3>
      <ul class="adf-tasks"><li>☑️ Plantings stay in the week they were planted in, in every time zone</li><li>⬜ A test covers both DST changes</li><li>⬜ <span class="adf-mention">@Maple Okafor</span> signs off on the fix</li></ul>
    HTML
  end
end
