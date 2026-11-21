# frozen_string_literal: true

require 'yaml'

module Garden
  # Translations from locales/<locale>/*.yml, reloaded whenever a file changes.
  module I18n
    LOCALES = %w[en fr es ja].freeze
    DEFAULT = 'en'
    DIR = File.join(ROOT, 'locales')

    @lock = Mutex.new
    @cache = {}
    @warned = {}

    class << self
      def t(locale, key, count: nil, **vars)
        value = lookup(locale, key) || lookup(DEFAULT, key) || missing(key)
        value = plural(value, locale, count) if count && value.is_a?(Hash)
        interpolate(value, vars.merge(count:))
      end

      # The strings a page's JS needs, with English filling any gaps.
      def bundle(locale, namespaces)
        namespaces.to_h { |ns| [ns, deep_merge(strings(DEFAULT)[ns] || {}, strings(locale)[ns] || {})] }
      end

      def strings(locale)
        files = Dir[File.join(DIR, locale, '*.yml')].sort
        stamp = files.map { |file| [file, File.mtime(file)] }
        @lock.synchronize do
          cached = @cache[locale]
          return cached[:strings] if cached && cached[:stamp] == stamp

          strings = files.map { |file| YAML.load_file(file) || {} }.reduce({}) { |all, part| deep_merge(all, part) }
          @cache[locale] = { stamp:, strings: }
          strings
        end
      end

      private

      def lookup(locale, key)
        key.to_s.split('.').reduce(strings(locale)) { |node, part| node.is_a?(Hash) ? node[part] : nil }
      end

      def missing(key)
        @lock.synchronize do
          warn "🌐 missing translation: #{key}" unless @warned[key]
          @warned[key] = true
        end
        key
      end

      # French counts 0 and 1 as singular; Japanese has no singular form at all.
      def plural(forms, locale, count)
        one = case locale
              when 'fr' then count < 2
              when 'ja' then false
              else count == 1
              end
        forms[one ? 'one' : 'other'] || forms['other']
      end

      def interpolate(value, vars)
        return value unless value.is_a?(String)

        value.gsub(/%\{(\w+)\}/) do
          vars.key?(::Regexp.last_match(1).to_sym) ? vars[::Regexp.last_match(1).to_sym].to_s : ::Regexp.last_match(0)
        end
      end

      def deep_merge(base, extra)
        base.merge(extra) { |_key, old, new| old.is_a?(Hash) && new.is_a?(Hash) ? deep_merge(old, new) : new }
      end
    end
  end

  # Picks the request's language: the garden_locale cookie, then Accept-Language, then English.
  module Locale
    COOKIE = 'garden_locale'

    def self.for(request)
      chosen = request.cookies[COOKIE]
      return chosen if I18n::LOCALES.include?(chosen)

      preferred(request.headers['accept-language'].to_s) || I18n::DEFAULT
    end

    def self.preferred(header)
      header.split(',').map do |part|
        part.split(';').first.to_s.strip.downcase[0, 2]
      end.find { |lang| I18n::LOCALES.include?(lang) }
    end
  end

  # An error whose message is a translation key, translated in the requester's language by App.
  class LocalizedError < StandardError
    attr_reader :key, :vars, :status

    def initialize(key, status: 500, **vars)
      @key = key
      @vars = vars
      @status = status
      super(key)
    end
  end
end
