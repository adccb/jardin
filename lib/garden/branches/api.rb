# frozen_string_literal: true

module Garden
  module Branches
    class Api
      include Responses

      # Checkouts of repos hidden on the settings page (matched by their origin remote) are left out of the list.
      def initialize(root:, settings: Settings::Store.new(nil), local_repos: nil)
        @finder = RepoFinder.new(root)
        @settings = settings
        @local_repos = local_repos || Github::LocalRepos.new(@finder)
        @pull_requests = PullRequests.new
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'repos'] then json(200, repos: shown_repos)
        in ['GET', 'state'] then json(200, snapshot(request.query))
        in ['POST', 'delete-branch'] then json(200, delete_branch(request.params))
        in ['POST', 'remove-worktree'] then json(200, remove_worktree(request.params))
        in ['POST', 'prune'] then json(200, gardener(request.params).prune)
        else not_found
        end
      end

      private

      def shown_repos
        hidden = @settings.hidden_paths(@local_repos)
        (@finder.repos - hidden).map { |path| { path:, name: File.basename(path) } }
      end

      def snapshot(query)
        Snapshot.new(@finder.fetch(query['repo']), @pull_requests).state(refresh: query['refresh'] == '1')
      end

      def delete_branch(params)
        gardener(params).delete_branch(params['branch'].to_s, force: params['force'] == true)
      end

      def remove_worktree(params)
        gardener(params).remove_worktree(params['path'].to_s, force: params['force'] == true)
      end

      def gardener(params) = Gardener.new(@finder.fetch(params['repo']))
    end
  end
end
