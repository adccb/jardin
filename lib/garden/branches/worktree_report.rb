# frozen_string_literal: true

module Garden
  module Branches
    class WorktreeReport
      def initialize(git)
        @git = git
      end

      def entries
        @git.run("worktree", "list", "--porcelain").out
          .split("\n\n").reject { |block| block.strip.empty? }
          .each_with_index.map { |block, index| parse(block, index) }
          .reject { |entry| entry[:bare] }
      end

      def worktrees
        entries.map { |entry| Thread.new { entry.merge(dirty: dirty_count(entry)) } }.map(&:value)
      end

      private

      def parse(block, index)
        attrs = block.lines(chomp: true).to_h { |line| line.split(" ", 2).then { |key, value| [key, value || true] } }
        path = attrs["worktree"]
        {
          path:,
          head: attrs["HEAD"]&.slice(0, 10),
          branch: attrs["branch"]&.delete_prefix("refs/heads/"),
          detached: attrs.key?("detached"),
          locked: attrs.key?("locked"),
          prunable: attrs.key?("prunable"),
          bare: attrs.key?("bare"),
          main: index.zero?,
          missing: !File.directory?(path)
        }
      end

      def dirty_count(entry)
        return 0 if entry[:missing]

        Git.new(entry[:path]).lines("status", "--porcelain").size
      end
    end
  end
end
