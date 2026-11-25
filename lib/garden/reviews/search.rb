# frozen_string_literal: true

module Garden
  module Reviews
    # Open PRs awaiting your review, across every gh account, since @me differs per account.
    # review-requested:@me includes team requests; user-review-requested:@me is only you by name.
    # gh search can't return checks, so each account then asks GraphQL for every PR's rollup in batches of 100.
    class Search
      TTL = 90
      LIMIT = 100
      FIELDS = %w[id number title url repository author isDraft labels createdAt updatedAt commentsCount].freeze
      NODE_ID = /\A[\w=-]+\z/
      ROLLUP = 'nodes(ids: %s) { ... on PullRequest { id commits(last: 1) { nodes { commit { statusCheckRollup { state } } } } } }'
      QUERIES = { all: 'review-requested:@me', you: 'user-review-requested:@me' }.freeze

      def initialize(accounts: Github::Accounts.new)
        @accounts = accounts
        @cache = nil
        @lock = Mutex.new
      end

      def requests(refresh: false)
        cached(refresh:) { gather }
      end

      private

      def gather
        results = @accounts.logins.map { |login| Thread.new { search_account(login) } }.map(&:value).compact
        return nil if results.empty?

        merged(results).values
      end

      def merged(results)
        results.each_with_object({}) do |result, by_url|
          direct = result[:you].map { |pr| pr['url'] }.to_set
          result[:all].each do |pr|
            via = direct.include?(pr['url']) ? 'you' : 'team'
            by_url[pr['url']] = Request.new(pr, via:).to_h unless by_url[pr['url']]&.dig(:via) == 'you'
          end
        end
      end

      def search_account(login)
        env = @accounts.env_for(login) or return
        found = QUERIES.transform_values { |query| run(env, query) }
        return nil unless found.values.all?

        states = rollups(env, found.values.flatten.map { _1['id'] })
        found.each_value { |prs| prs.each { |pr| pr['ciState'] = states[pr['id']] } }
        found
      end

      # { node id => SUCCESS / FAILURE / PENDING / ERROR / EXPECTED }; a PR without checks, or a failed call, is left out.
      def rollups(env, ids)
        ids.uniq.select { _1.to_s.match?(NODE_ID) }.each_slice(100).each_with_object({}) do |batch, states|
          out, _err, status = Open3.capture3(env, 'gh', 'api', 'graphql', '-f', "query={ #{format(ROLLUP, batch.to_json)} }")
          next unless status.success?

          JSON.parse(out).dig('data', 'nodes').to_a.compact.each do |node|
            state = node.dig('commits', 'nodes', 0, 'commit', 'statusCheckRollup', 'state')
            states[node['id']] = state if state
          end
        rescue JSON::ParserError, Errno::ENOENT
          next
        end
      end

      def run(env, query)
        out, _err, status = Open3.capture3(
          env, 'gh', 'search', 'prs', query, '--state', 'open', '--limit', LIMIT.to_s, '--json', FIELDS.join(',')
        )
        status.success? ? JSON.parse(out) : nil
      rescue JSON::ParserError, Errno::ENOENT
        nil
      end

      def cached(refresh:)
        @lock.synchronize do
          @cache = nil if refresh
          return @cache[:value] if @cache && Time.now - @cache[:at] < TTL
        end
        yield.tap { |value| @lock.synchronize { @cache = { value:, at: Time.now } } if value }
      end
    end
  end
end
