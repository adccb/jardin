# frozen_string_literal: true

module Garden
  # What ERB templates can call: t, h, locale, palette. Keys ending in _html are trusted markup; everything else is escaped.
  class View
    attr_reader :locale, :tool, :tools, :token, :palette

    def initialize(locale:, tool:, tools:, token:, palette:)
      @locale = locale
      @tool = tool
      @tools = tools
      @token = token
      @palette = palette
    end

    def render(path) = ERB.new(File.read(path), trim_mode: '-').result(binding)

    def t(key, **vars)
      text = I18n.t(locale, key, **vars).to_s
      key.end_with?('_html') ? text : h(text)
    end

    def h(text) = ERB::Util.html_escape(text)

    def locales = I18n::LOCALES

    def palettes = Palette::ALL

    # Each language's own name and flag, so the menu reads "English" and "Français" whichever is current.
    def language_name(code) = h(I18n.t(code, 'common.language_name'))

    def flag(code) = I18n.t(code, 'common.flag')

    def i18n_json
      JSON.generate(locale:, strings: I18n.bundle(locale, ['common', 'errors', *tool.shares, tool.slug])).gsub('</', '<\/')
    end
  end
end
