# frozen_string_literal: true

module Garden
  # What ERB templates can call: t, h, locale. Keys ending in _html are trusted markup; everything else is escaped.
  class View
    attr_reader :locale, :tool, :tools, :token

    def initialize(locale:, tool:, tools:, token:)
      @locale = locale
      @tool = tool
      @tools = tools
      @token = token
    end

    def render(path) = ERB.new(File.read(path), trim_mode: '-').result(binding)

    def t(key, **vars)
      text = I18n.t(locale, key, **vars).to_s
      key.end_with?('_html') ? text : h(text)
    end

    def h(text) = ERB::Util.html_escape(text)

    def other_locale = (I18n::LOCALES - [locale]).first

    def i18n_json
      JSON.generate(locale:, strings: I18n.bundle(locale, ['common', 'errors', tool.slug])).gsub('</', '<\/')
    end
  end
end
