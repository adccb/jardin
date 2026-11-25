# frozen_string_literal: true

module Garden
  # Wraps a tool's page in the shared shell: sidebar (settings at its foot), dialog, toasts, translations for its JS.
  class Layout
    TEMPLATE = File.join(ROOT, 'pages', 'layout.html.erb')

    def initialize(tools:, token:)
      @tools = tools
      @token = token
    end

    def render(tool, locale, palette)
      View.new(locale:, tool:, tools: @tools, token: @token, palette:).render(TEMPLATE)
    end
  end
end
