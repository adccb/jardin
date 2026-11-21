# frozen_string_literal: true

module Garden
  module Branches
    class RepoFinder
      PREFERRED = "k2"

      def initialize(root)
        @root = root
      end

      def repos
        Dir.children(@root)
          .map { |name| File.join(@root, name) }
          .select { |path| File.directory?(File.join(path, ".git")) }
          .sort_by { |path| [File.basename(path) == PREFERRED ? 0 : 1, File.basename(path).downcase] }
      end

      def fetch(path)
        repos.include?(path) ? path : raise(Refusal.new('errors.repo_not_in_garden'))
      end
    end
  end
end
