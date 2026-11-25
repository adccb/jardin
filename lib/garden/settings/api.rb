# frozen_string_literal: true

module Garden
  module Settings
    # The settings page: every repo GitHub says you can see, which ones are hidden everywhere, and hiding or showing one.
    class Api
      include Responses

      def initialize(store:, repo_list: Github::RepoList.new)
        @store = store
        @repo_list = repo_list
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'repos'] then json(200, repos(refresh: request.query['refresh'] == '1'))
        in ['POST', 'hide'] then json(200, hide(request.params))
        else not_found
        end
      end

      private

      # Hidden repos GitHub no longer lists (renamed, or access lost) still show, so they can be brought back.
      def repos(refresh:)
        hidden = @store.hidden_slugs
        listed = @repo_list.all(refresh:)
        known = (listed || []).map { |repo| { **repo, hidden: hidden.include?(repo[:slug]) } }
        missing = (hidden - known.map { _1[:slug] }).map { |slug| { slug:, hidden: true, gone: true } }
        { ok: !listed.nil?, error_key: listed ? nil : 'errors.no_gh_access_repos', repos: missing + known }.compact
      end

      def hide(params)
        @store.set_hidden(params['slug'].to_s, params['hidden'] == true)
        { ok: true }
      end
    end
  end
end
