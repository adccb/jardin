# frozen_string_literal: true

module Garden
  module Branches
    class Api
      include Responses

      def initialize(root:)
        @finder = RepoFinder.new(root)
        @pull_requests = PullRequests.new
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'repos'] then json(200, repos: @finder.repos.map { |path| { path:, name: File.basename(path) } })
        in ['GET', 'state'] then json(200, snapshot(request.query))
        in ['POST', 'delete-branch'] then json(200, delete_branch(request.params))
        in ['POST', 'remove-worktree'] then json(200, remove_worktree(request.params))
        in ['POST', 'prune'] then json(200, gardener(request.params).prune)
        else not_found
        end
      end

      private

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
