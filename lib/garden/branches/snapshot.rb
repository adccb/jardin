# frozen_string_literal: true

module Garden
  module Branches
    class Snapshot
      def initialize(repo, pull_requests)
        @repo = repo
        @git = Git.new(repo)
        @default = DefaultBranch.new(@git)
        @pull_requests = pull_requests
      end

      def state(refresh: false)
        prs_thread = Thread.new { @pull_requests.for(@repo, refresh:) }
        worktrees = WorktreeReport.new(@git).worktrees
        prs = prs_thread.value
        {
          repo: @repo,
          name: File.basename(@repo),
          home: Dir.home,
          default_branch: @default.local_name,
          pr_info: !prs.nil?,
          branches: branches(worktrees, prs || {}),
          worktrees:
        }
      end

      private

      def branches(worktrees, prs)
        worktree_paths = worktrees.select { |w| w[:branch] }.to_h { |w| [w[:branch], w[:path]] }
        BranchReport.new(@git, @default).branches.map do |branch|
          branch.merge(worktree: worktree_paths[branch[:name]], pr: prs[branch[:name]])
        end
      end
    end
  end
end
