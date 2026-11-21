# frozen_string_literal: true

module Garden
  module Prs
    class Api
      include Responses

      STATES = %w[open merged closed].freeze

      def initialize(root:)
        @repos = Github::LocalRepos.new(Branches::RepoFinder.new(root))
        @fetcher = Fetcher.new
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'repos'] then json(200, repos: @repos.all.map { |repo| { slug: repo.slug, name: repo.name } })
        in ['GET', 'list'] then json(200, list(request.query))
        else not_found
        end
      end

      private

      def list(query)
        state = STATES.include?(query['state']) ? query['state'] : 'open'
        repos = query['repos'].to_s.split(',').uniq.map { |slug| @repos.fetch!(slug) }
        refresh = query['refresh'] == '1'
        { state:, repos: repos.map { |repo| Thread.new { @fetcher.fetch(repo, state, refresh:) } }.map(&:value) }
      end
    end
  end
end
