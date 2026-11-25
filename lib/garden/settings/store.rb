# frozen_string_literal: true

module Garden
  module Settings
    # Garden-wide settings in one JSON file (~/.config/garden/settings.json). For now that's the repos hidden from
    # every page, kept by their GitHub owner/name. Writes go to a temp file first, so a crash never leaves half a file.
    class Store
      SLUG = %r{\A[\w.-]+/[\w.-]+\z}

      def initialize(path)
        @path = path
        @lock = Mutex.new
      end

      def hidden_slugs = @lock.synchronize { load.fetch('hidden_repos', []) }

      def set_hidden(slug, hidden)
        raise Refusal.new('errors.bad_repo_slug', slug:) unless slug.match?(SLUG)

        @lock.synchronize do
          data = load
          slugs = data.fetch('hidden_repos', []) - [slug]
          slugs << slug if hidden
          save(data.merge('hidden_repos' => slugs.sort_by(&:downcase)))
        end
      end

      # The local checkouts of hidden repos, for the pages that list folders (branches, worktrees).
      def hidden_paths(local_repos)
        hidden = hidden_slugs
        return [] if hidden.empty? # skips reading every checkout's remote
        local_repos.all.select { |repo| hidden.include?(repo.slug) }.flat_map(&:paths)
      end

      private

      def load
        return {} unless @path && File.exist?(@path)

        JSON.parse(File.read(@path))
      rescue JSON::ParserError
        {}
      end

      def save(data)
        raise Refusal.new('errors.settings_unsaved') unless @path

        FileUtils.mkdir_p(File.dirname(@path))
        temp = "#{@path}.tmp"
        File.write(temp, JSON.pretty_generate(data))
        File.rename(temp, @path)
      end
    end
  end
end
