# frozen_string_literal: true

module Garden
  module Branches
    class BranchReport
      FIELDS = %w[refname:short committerdate:iso8601-strict subject upstream:short upstream:track HEAD objectname:short].freeze

      def initialize(git, default_branch)
        @git = git
        @default = default_branch
      end

      def names
        @git.lines("for-each-ref", "refs/heads", "--format=%(refname:short)")
      end

      def branches
        merged = merged_names
        @git.lines("for-each-ref", "refs/heads", "--format=#{format}")
          .map { |line| build(line.split("\0", -1), merged) }
      end

      private

      def base = @default.comparison_ref

      def format
        fields = FIELDS.map { |field| "%(#{field})" }
        fields << "%(ahead-behind:#{base})" if base
        fields.join("%00")
      end

      def build(values, merged)
        name, date, subject, upstream, track, head, sha, counts = values
        ahead, behind = counts&.split&.map(&:to_i)
        {
          name:, date:, subject:, sha:, ahead:, behind:,
          upstream: upstream.empty? ? nil : upstream,
          gone: track.include?("gone"),
          current: head == "*",
          merged: merged.include?(name),
          default: name == @default.local_name
        }
      end

      def merged_names
        return Set.new unless base

        @git.lines("branch", "--merged", base, "--format=%(refname:short)").to_set
      end
    end
  end
end
