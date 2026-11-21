# frozen_string_literal: true

module Garden
  module Jira
    class Client
      PAGE_SIZE = 100
      MAX_RESULTS = 500
      SPRINT_FIELD_TYPE = 'com.pyxis.greenhopper.jira:gh-sprint'
      FAILURES = { 401 => 'errors.jira.unauthorized', 403 => 'errors.jira.forbidden',
                   404 => 'errors.jira.not_found' }.freeze

      attr_reader :site

      def initialize(site:, credentials:)
        @site = site
        @credentials = credentials
      end

      def search(jql, fields)
        issues = []
        token = nil
        loop do
          page = post('/rest/api/3/search/jql', { jql:, fields:, maxResults: PAGE_SIZE, nextPageToken: token }.compact)
          issues.concat(page.fetch('issues', []))
          token = page['nextPageToken']
          break if page['isLast'] || token.nil? || issues.size >= MAX_RESULTS
        end
        issues
      end

      def issue(key, fields)
        get("/rest/api/3/issue/#{URI.encode_www_form_component(key)}?#{URI.encode_www_form(fields: fields.join(','))}")
      end

      def sprint(id)
        get("/rest/agile/1.0/sprint/#{Integer(id)}")
      end

      # The Sprint field is a custom field whose id differs per site.
      def sprint_field
        @sprint_field ||= get('/rest/api/3/field').find { |field| field.dig('schema', 'custom') == SPRINT_FIELD_TYPE }
                                                  &.fetch('id') || raise(Error.new('errors.jira.no_sprint_field'))
      end

      # Jira answers bad credentials on search as an anonymous user, so confirm who we are first.
      def whoami
        @whoami ||= get('/rest/api/3/myself')
      end

      private

      def get(path) = perform(Net::HTTP::Get.new(uri(path)))

      def post(path, body)
        request = Net::HTTP::Post.new(uri(path))
        request['Content-Type'] = 'application/json'
        request.body = JSON.generate(body)
        perform(request)
      end

      def uri(path) = URI.join(site, path)

      def perform(request)
        email, token = @credentials.pair
        request.basic_auth(email, token)
        request['Accept'] = 'application/json'
        response = Net::HTTP.start(request.uri.host, request.uri.port, use_ssl: request.uri.scheme == 'https',
                                                                       open_timeout: 10, read_timeout: 30) do |http|
          http.request(request)
        end
        parse(response)
      rescue SocketError, Net::OpenTimeout, Net::ReadTimeout, SystemCallError => e
        raise Error.new('errors.jira.unreachable', detail: e.message)
      end

      def parse(response)
        body = json_body(response)
        return body if response.is_a?(Net::HTTPSuccess)

        forget_identity if response.code == '401'
        key = FAILURES.fetch(response.code.to_i, 'errors.jira.hiccup')
        raise Error.new(key, status_code: response.code, detail: Array(body['errorMessages']).join(' '))
      end

      def json_body(response)
        response.body.to_s.empty? ? {} : JSON.parse(response.body)
      rescue JSON::ParserError
        raise Error.new('errors.jira.not_json', status_code: response.code) if response.is_a?(Net::HTTPSuccess)

        {}
      end

      def forget_identity
        @whoami = nil
        @credentials.forget
      end
    end
  end
end
