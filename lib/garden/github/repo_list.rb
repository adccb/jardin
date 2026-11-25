# frozen_string_literal: true

module Garden
  module Github
    # Every repo your gh accounts can see (owned, shared with you, or through an org), merged across accounts.
    # GitHub is the source of truth for which repos exist; garden doesn't assume where checkouts live. Cached 10 min.
    class RepoList
      TTL = 600
      PATH = 'user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=pushed'
      FIELDS = '.[] | {slug: .full_name, private: .private, archived: .archived, pushed_at: .pushed_at}'

      def initialize(accounts: Accounts.new)
        @accounts = accounts
        @lock = Mutex.new
        @cached = nil
      end

      # nil when no gh account answered.
      def all(refresh: false)
        @lock.synchronize { @cached = nil if refresh || (@cached && Time.now - @cached[:at] > TTL) }
        @cached&.fetch(:value) || fresh
      end

      private

      def fresh
        lists = @accounts.logins.map { |login| Thread.new { fetch(login) } }.map(&:value).compact
        value = lists.empty? ? nil : lists.flatten.uniq { _1[:slug] }.sort_by { _1[:slug].downcase }
        @lock.synchronize { @cached = { value:, at: Time.now } } if value
        value
      end

      def fetch(login)
        env = @accounts.env_for(login) or return nil
        out, _err, status = Open3.capture3(env, 'gh', 'api', '--paginate', PATH, '--jq', FIELDS)
        return nil unless status.success?

        out.lines.map { |line| JSON.parse(line, symbolize_names: true) }
      rescue JSON::ParserError, Errno::ENOENT
        nil
      end
    end
  end
end
