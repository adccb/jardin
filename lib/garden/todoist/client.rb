# frozen_string_literal: true

module Garden
  module Todoist
    # Talks to Todoist's API v1 with a bearer token read from 1Password on first use.
    class Client
      API = 'https://api.todoist.com'
      PAGE_SIZE = 200
      MAX_TASKS = 500
      FAILURES = { 401 => 'errors.todoist.unauthorized', 403 => 'errors.todoist.unauthorized',
                   404 => 'errors.todoist.not_found' }.freeze

      def self.from_env
        reference = ENV.fetch('TODOIST_TOKEN_REF', '')
        new(token: reference.start_with?('op://') ? -> { Secrets.read(reference) } : nil)
      end

      def initialize(token:, base: API)
        @token_source = token
        @base = base
        @lock = Mutex.new
      end

      def enabled? = !@token_source.nil?

      def filter_tasks(query, lang:)
        paginate('/api/v1/tasks/filter', query:, lang:)
      end

      def projects = paginate('/api/v1/projects')

      # Saved filters and your account language only come through the sync endpoint.
      def filters_and_lang
        body = post_form('/api/v1/sync', sync_token: '*', resource_types: JSON.generate(%w[filters user]))
        [body.fetch('filters', []), body.dig('user', 'lang') || 'en']
      end

      def close(id) = post("/api/v1/tasks/#{URI.encode_www_form_component(id)}/close")
      def reopen(id) = post("/api/v1/tasks/#{URI.encode_www_form_component(id)}/reopen")

      private

      def paginate(path, **params)
        items = []
        cursor = nil
        loop do
          page = get(path, **params, limit: PAGE_SIZE, cursor:)
          items.concat(page.fetch('results', []))
          cursor = page['next_cursor']
          break if cursor.nil? || items.size >= MAX_TASKS
        end
        items
      end

      def get(path, **params)
        query = URI.encode_www_form(params.compact)
        perform(Net::HTTP::Get.new(URI.join(@base, "#{path}?#{query}")))
      end

      def post(path) = perform(Net::HTTP::Post.new(URI.join(@base, path)))

      def post_form(path, **fields)
        request = Net::HTTP::Post.new(URI.join(@base, path))
        request.set_form_data(fields)
        perform(request)
      end

      def perform(request)
        request['Authorization'] = "Bearer #{token}"
        request['Accept'] = 'application/json'
        response = Net::HTTP.start(request.uri.host, request.uri.port, use_ssl: request.uri.scheme == 'https',
                                                                       open_timeout: 10, read_timeout: 30) do |http|
          http.request(request)
        end
        parse(response)
      rescue SocketError, Net::OpenTimeout, Net::ReadTimeout, SystemCallError => e
        raise Error.new('errors.todoist.unreachable', detail: e.message)
      end

      def parse(response)
        forget_token if response.code == '401'
        unless response.is_a?(Net::HTTPSuccess)
          raise Error.new(FAILURES.fetch(response.code.to_i, 'errors.todoist.hiccup'),
                          status_code: response.code)
        end

        response.body.to_s.empty? ? {} : JSON.parse(response.body)
      rescue JSON::ParserError
        raise Error.new('errors.todoist.not_json', status_code: response.code)
      end

      def token
        @lock.synchronize { @token ||= @token_source.call }
      end

      def forget_token
        @lock.synchronize { @token = nil }
      end
    end
  end
end
