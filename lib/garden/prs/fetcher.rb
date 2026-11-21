# frozen_string_literal: true

module Garden
  module Prs
    # Lists your PRs in one repo with every gh account that can see it, since @me differs per account.
    class Fetcher
      TTL = 90
      BASE_FIELDS = %w[number title url state isDraft headRefName baseRefName additions deletions labels createdAt
                       updatedAt].freeze
      FIELDS = {
        'open' => BASE_FIELDS + %w[reviewDecision mergeable mergeStateStatus reviewRequests latestReviews
                                   statusCheckRollup],
        'merged' => BASE_FIELDS + %w[mergedAt],
        'closed' => BASE_FIELDS + %w[closedAt]
      }.freeze
      LIMITS = { 'open' => 100, 'merged' => 30, 'closed' => 80 }.freeze
      SHOWN = 30

      def initialize(accounts: Github::Accounts.new)
        @accounts = accounts
        @cache = {}
        @lock = Mutex.new
      end

      def fetch(repo, state, refresh: false)
        cached([repo.slug, state], refresh:) { list(repo, state) }
      end

      private

      def list(repo, state)
        results = @accounts.logins.map { |login| Thread.new { run(repo.slug, state, login) } }.map(&:value).compact
        if results.empty?
          return { slug: repo.slug, name: repo.name, ok: false, error_key: 'errors.no_gh_access',
                   prs: [] }
        end

        prs = visible(results.flatten, state).map { |pr| PullRequest.new(pr, repo: repo.slug).to_h }
        { slug: repo.slug, name: repo.name, ok: true, prs: }
      end

      def visible(prs, state)
        prs.uniq { |pr| pr['url'] }
           .select { |pr| in_state?(pr, state) }
           .sort_by { |pr| pr['mergedAt'] || pr['closedAt'] || pr['updatedAt'] }.reverse
           .first(state == 'open' ? LIMITS['open'] : SHOWN)
      end

      # gh's --state closed includes merged PRs.
      def in_state?(pr, state) = state != 'closed' || pr['state'] == 'CLOSED'

      def run(slug, state, login)
        env = @accounts.env_for(login) or return
        out, _err, status = Open3.capture3(
          env, 'gh', 'pr', 'list', '--repo', slug, '--author', '@me', '--state', state,
          '--limit', LIMITS.fetch(state).to_s, '--json', FIELDS.fetch(state).join(',')
        )
        status.success? ? JSON.parse(out) : nil
      rescue JSON::ParserError, Errno::ENOENT
        nil
      end

      def cached(key, refresh:)
        @lock.synchronize do
          @cache.delete(key) if refresh
          hit = @cache[key]
          return hit[:value] if hit && Time.now - hit[:at] < TTL
        end
        yield.tap { |value| @lock.synchronize { @cache[key] = { value:, at: Time.now } } }
      end
    end
  end
end
