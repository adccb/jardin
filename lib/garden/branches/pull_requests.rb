# frozen_string_literal: true

module Garden
  module Branches
    class PullRequests
      TTL = 120
      STATE_RANK = {"OPEN" => 0, "MERGED" => 1, "CLOSED" => 2}.freeze

      def initialize
        @cache = {}
        @preferred_login = {}
        @accounts = Github::Accounts.new
        @lock = Mutex.new
      end

      def for(repo, refresh: false)
        @lock.synchronize do
          @cache.delete(repo) if refresh
          cached = @cache[repo]
          return cached[:value] if cached && Time.now - cached[:at] < TTL
        end

        fetch(repo).tap { |value| @lock.synchronize { @cache[repo] = {value:, at: Time.now} } }
      end

      private

      def fetch(repo)
        fallback = nil
        logins_for(repo).each do |login|
          prs = list(repo, login) or next
          return remember(repo, login, prs) if prs.any?

          fallback ||= prs
        end
        fallback
      rescue Errno::ENOENT
        nil
      end

      def logins_for(repo)
        preferred = @preferred_login[repo]
        @preferred_login.key?(repo) ? [preferred, *(@accounts.logins - [preferred])] : @accounts.logins
      end

      def remember(repo, login, prs)
        @preferred_login[repo] = login
        prs
      end

      def list(repo, login)
        env = @accounts.env_for(login) or return
        out, _err, status = Open3.capture3(
          env, "gh", "pr", "list", "--author", "@me", "--state", "all", "--limit", "500",
          "--json", "number,state,title,url,headRefName", chdir: repo
        )
        return unless status.success?

        JSON.parse(out).group_by { |pr| pr["headRefName"] }.transform_values { |prs| most_relevant(prs) }
      rescue JSON::ParserError
        nil
      end

      def most_relevant(prs)
        prs.min_by { |pr| [STATE_RANK.fetch(pr["state"], 3), -pr["number"]] }.slice("number", "state", "title", "url")
      end
    end
  end
end
