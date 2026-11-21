# frozen_string_literal: true

module Garden
  module Branches
    class Gardener
      def initialize(repo)
        @git = Git.new(repo)
        @default = DefaultBranch.new(@git)
      end

      def delete_branch(name, force:)
        ensure_deletable!(name)
        outcome(@git.run("branch", force ? "-D" : "-d", name))
      end

      def remove_worktree(path, force:)
        entry = worktrees.find { |w| w[:path] == path } or raise Refusal.new('errors.worktree_unknown')
        raise Refusal.new('errors.main_checkout') if entry[:main]

        outcome(@git.run("worktree", "remove", *("--force" if force), path))
      end

      def prune
        outcome(@git.run("worktree", "prune", "--verbose"))
      end

      private

      def ensure_deletable!(name)
        raise Refusal.new('errors.no_such_branch', name:) unless BranchReport.new(@git, @default).names.include?(name)
        raise Refusal.new('errors.default_branch', name:) if name == @default.local_name
        raise Refusal.new('errors.branch_checked_out', name:) if checked_out.include?(name)
      end

      def checked_out = worktrees.filter_map { |w| w[:branch] }

      def worktrees
        @worktrees ||= WorktreeReport.new(@git).entries
      end

      def outcome(result)
        {ok: result.ok, output: [result.out, result.err].join("\n").strip}
      end
    end
  end
end
