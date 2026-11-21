# frozen_string_literal: true

module Garden
  module Branches
    class DefaultBranch
      def initialize(git)
        @git = git
      end

      def comparison_ref
        remote_head || local_name
      end

      def local_name
        @local_name ||= remote_head&.delete_prefix("origin/") || first_local(%w[main master])
      end

      private

      def remote_head
        return @remote_head if defined?(@remote_head)

        result = @git.run("symbolic-ref", "--short", "refs/remotes/origin/HEAD")
        @remote_head = result.ok ? result.out.strip : nil
      end

      def first_local(candidates)
        candidates.find { |name| @git.run("rev-parse", "--verify", "--quiet", "refs/heads/#{name}").ok }
      end
    end
  end
end
