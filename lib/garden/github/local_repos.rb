# frozen_string_literal: true

module Garden
  module Github
    # The GitHub repos behind the checkouts in ~/src, deduped by owner/repo.
    class LocalRepos
      Repo = Data.define(:slug, :name, :paths)

      TTL = 60

      def initialize(finder)
        @finder = finder
        @lock = Mutex.new
      end

      def all
        @lock.synchronize do
          @all = nil if @scanned_at && Time.now - @scanned_at > TTL
          @all ||= scan.tap { @scanned_at = Time.now }
        end
      end

      def fetch!(slug)
        all.find { |repo| repo.slug == slug } or raise Refusal.new('errors.unknown_repo', slug:)
      end

      private

      def scan
        @finder.repos
               .map { |path| [slug_for(path), path] }
               .select(&:first)
               .group_by(&:first)
               .map { |slug, pairs| Repo.new(slug:, name: slug.split('/').last, paths: pairs.map(&:last)) }
               .sort_by { |repo| [repo.slug == 'kolide/k2' ? 0 : 1, repo.name.downcase] }
      end

      def slug_for(path)
        remote = Git.new(path).run('remote', 'get-url', 'origin')
        return unless remote.ok

        remote.out.strip.delete_suffix('.git').split(%r{[:/]}).last(2).join('/').then do |slug|
          slug.count('/') == 1 ? slug : nil
        end
      end
    end
  end
end
