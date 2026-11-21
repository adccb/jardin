# frozen_string_literal: true

module Garden
  class App
    include Responses

    def initialize(port:, tools:)
      @tools = tools
      @token = SecureRandom.hex(16)
      @allowed_hosts = ["localhost:#{port}", "127.0.0.1:#{port}"]
      @layout = Layout.new(tools:, token: @token)
      @assets = Assets.new(File.join(ROOT, 'public'))
    end

    def call(request)
      locale = Locale.for(request)
      return failure(403, locale, 'errors.wrong_host') unless @allowed_hosts.include?(request.headers['host'])

      if request.post? && request.headers['x-garden-token'] != @token
        return failure(403, locale,
                       'errors.missing_token')
      end

      route(request, locale)
    rescue LocalizedError => e
      failure(e.status, locale, e.key, **e.vars)
    rescue JSON::ParserError, URI::InvalidURIError
      failure(400, locale, 'errors.garbled')
    end

    private

    def route(request, locale)
      path = request.path
      return redirect(@tools.first.path) if path == '/'
      return @assets.serve(path.delete_prefix('/assets/')) if path.start_with?('/assets/')
      return api(request, path) if path.start_with?('/api/')

      page = @tools.find { |tool| tool.path == path }
      page && request.method == 'GET' ? html(@layout.render(page, locale, Palette.for(request))) : not_found
    end

    def api(request, path)
      _, _, slug, action = path.split('/', 4)
      tool = @tools.find { |candidate| candidate.slug == slug }
      tool ? tool.api.call(request, action.to_s) : not_found
    end

    def failure(status, locale, key, **vars)
      json(status, ok: false, error: I18n.t(locale || I18n::DEFAULT, key, **vars))
    end
  end
end
