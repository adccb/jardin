# Demo garden: the real pages and code, with every API answering from invented data.
# usage: ruby demo_garden.rb [port]   then open http://localhost:4750/prs?lang=fr&scene=02-pr-garden-merged
require_relative '../../../lib/garden'
require_relative 'fixtures'
require_relative 'scenes'

module Demo
  # Pages honour ?lang= so each screenshot picks its language without cookies;
  # the page's own API calls inherit it from their Referer.
  module LocaleFromQuery
    def for(request)
      referer = URI(request.headers['referer'].to_s).query.to_s
      lang = request.query['lang'] || URI.decode_www_form(referer).to_h['lang']
      Garden::I18n::LOCALES.include?(lang) ? lang : super
    end
  end
  Garden::Locale.singleton_class.prepend(LocaleFromQuery)

  # Pages get the ?scene= script: a localStorage preset in <head>, then steps after the page's own module.
  module SceneInjection
    private

    def route(request, locale)
      status, headers, body = super
      scene = Scenes.fetch(request.query['scene'])
      return [status, headers, body] unless scene && headers['Content-Type'].to_s.start_with?('text/html')

      body = body.sub('</head>', "#{Scenes.preset_script(scene)}</head>").sub('</body>', "#{Scenes.steps_script(scene)}</body>")
      [status, headers, body]
    end
  end
  Garden::App.prepend(SceneInjection)

  # One fake API per tool; `fixture` gets the locale so tasks can be French for French shots.
  class FakeApi
    include Garden::Responses

    def initialize(routes)
      @routes = routes
    end

    def call(request, action)
      handler = @routes["#{request.method} #{action}"] or return not_found
      json(200, handler.call(request.query, Garden::Locale.for(request), request))
    end
  end
end

port = Integer(ARGV.fetch(0, '4750'))
f = Demo::Fixtures
tools = [
  Garden::Tool.new(slug: 'prs', emoji: '💌', api: Demo::FakeApi.new(
    'GET repos' => ->(*) { { repos: f.pr_repos } },
    'GET list' => ->(q, *) { f.pr_list(q['state'] || 'open', q['repos'].to_s.split(',')) }
  )),
  Garden::Tool.new(slug: 'reviews', emoji: '👀', api: Demo::FakeApi.new(
    'GET list' => ->(*) { { ok: true, requests: f.review_requests } }
  )),
  Garden::Tool.new(slug: 'tasks', emoji: '📝', api: Demo::FakeApi.new(
    'GET list' => ->(_q, locale, _r) { { tasks: f.tasks(locale) } },
    'GET todoist' => ->(_q, locale, _r) { f.todoist(locale) }
  )),
  Garden::Tool.new(slug: 'branches', emoji: '🌿', api: Demo::FakeApi.new(
    'GET repos' => ->(*) { { repos: f.branch_repos } },
    'GET state' => ->(*) { f.branch_state }
  )),
  Garden::Tool.new(slug: 'jira', emoji: '🎟️', api: Demo::FakeApi.new(
    'GET tickets' => ->(q, *) { q['view'] == 'sprint' ? f.jira_sprint_view(q['sprint']) : f.jira_mine },
    'GET sprints' => ->(*) { { sprints: f.jira_sprints } },
    'GET ticket' => ->(q, *) { f.jira_ticket(q['key']) }
  ))
]

$stdout.sync = true
Garden::HttpServer.new(Garden::App.new(port:, tools:), port).start { puts "demo garden on http://localhost:#{port}" }
