# frozen_string_literal: true

module Garden
  module Github
    # Every logged-in gh account, tried via GH_TOKEN so the active account never changes.
    class Accounts
      def logins
        @logins ||= [nil, *inactive_logins]
      end

      def env_for(login)
        return {} unless login

        out, _err, status = Open3.capture3('gh', 'auth', 'token', '--user', login)
        status.success? ? {'GH_TOKEN' => out.strip} : nil
      end

      private

      def inactive_logins
        out, _err, status = Open3.capture3('gh', 'auth', 'status', '--json', 'hosts')
        return [] unless status.success?

        JSON.parse(out).fetch('hosts', {}).fetch('github.com', [])
          .select { |account| account['state'] == 'success' && !account['active'] }
          .map { |account| account['login'] }
      rescue JSON::ParserError
        []
      end
    end
  end
end
