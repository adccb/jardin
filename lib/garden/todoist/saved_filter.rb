# frozen_string_literal: true

module Garden
  module Todoist
    # One of your saved Todoist filters, turned into queries the API accepts.
    # The API refuses commas (several lists in one filter), so each comma part becomes its own query.
    class SavedFilter
      # Todoist shows the inbox under a translated name, but the API only knows its real name.
      LOCALIZED_INBOX = { 'fr' => 'boite de reception', 'es' => 'bandeja de entrada', 'ja' => 'インボックス' }.freeze

      attr_reader :id, :name

      def self.normalize(text)
        text.to_s.unicode_normalize(:nfkd).gsub(/\p{Mn}/, '').tr('’‘`', "'")
            .gsub(/[^\p{L}\p{N}' ]/, ' ').squeeze(' ').strip.downcase
      end

      def self.find(filters, name)
        wanted = normalize(name)
        found = filters.find { |filter| !filter['is_deleted'] && normalize(filter['name']) == wanted }
        found ? new(found) : raise(Error.new('errors.todoist.no_filter', name:))
      end

      def initialize(filter)
        @id = filter['id']
        @name = filter['name']
        @query = filter['query'].to_s
      end

      def url = "https://app.todoist.com/app/filter/#{id}"

      def parts(lang:, inbox_name:)
        split.map { |part| { label: part, query: with_real_inbox(part, lang, inbox_name) } }
      end

      private

      # Splits on commas that aren't inside parentheses or quotes.
      def split
        parts = [+'']
        depth = 0
        quoted = false
        @query.each_char do |char|
          quoted = !quoted if char == '"'
          depth += { '(' => 1, ')' => -1 }.fetch(char, 0) unless quoted
          char == ',' && depth.zero? && !quoted ? parts << +'' : parts.last << char
        end
        parts.map(&:strip).reject(&:empty?)
      end

      def with_real_inbox(part, lang, inbox_name)
        localized = LOCALIZED_INBOX[lang]&.then { self.class.normalize(_1) }
        return part unless localized && inbox_name

        part.gsub(/(##?)([^&|()!,]*[^&|()!,\s])/) do |ref|
          self.class.normalize(::Regexp.last_match(2)) == localized ? "#{::Regexp.last_match(1)}#{inbox_name}" : ref
        end
      end
    end
  end
end
