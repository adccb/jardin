# frozen_string_literal: true

module Garden
  # What ERB templates can call: t, h, locale, palette. Keys ending in _html are trusted markup; everything else is escaped.
  class View
    attr_reader :locale, :tool, :tools, :token, :palette, :hidden_pages

    SKELETONS = File.join(ROOT, 'pages', 'skeletons')

    def initialize(locale:, tool:, tools:, token:, palette:, hidden_pages: [], shapes: {})
      @locale = locale
      @tool = tool
      @tools = tools
      @token = token
      @palette = palette
      @hidden_pages = hidden_pages
      @shapes = shapes
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

    # The home page's hello, as greet() in home.js picks it; garden runs on your own machine, so it's your clock.
    def greeting_part
      hour = Time.now.hour
      return 'morning' if hour < 12

      hour < 18 ? 'afternoon' : 'evening'
    end

    # ---------- skeletons: stand-ins the size of the data on its way (pages/skeletons, cloned by garden.js too) ----------

    def skeleton_kinds = Dir.children(SKELETONS).map { File.basename(_1, '.html') }.sort

    def skeleton(kind, count = 1) = File.read(File.join(SKELETONS, "#{kind}.html")) * count

    # How many items a region (or each of its groups) showed last time, else the fallback.
    def shape(key, fallback) = @shapes.fetch(key, fallback)

    # Straight into a list or grid; nothing at all becomes an empty-state box. Mirrors skeletonItems in garden.js.
    def skeleton_items(count, item, list: false)
      return skeleton(item, count) if count.positive?

      list ? %(<li class="is-skeleton" aria-hidden="true">#{skeleton('state-box')}</li>) : skeleton('state-box')
    end

    # A grid per group, each under its own heading if it has one. Mirrors skeletonGrids in garden.js.
    def skeleton_grids(counts, card:, heading: nil)
      return skeleton('state-box') if counts.sum.zero?

      counts.select(&:positive?).map do |count|
        grid = %(<div class="grid">#{skeleton(card, count)}</div>)
        heading ? %(<section class="pr-section is-skeleton">#{skeleton(heading)}#{grid}</section>) : grid
      end.join
    end

    # A heading per group over its list, or its empty note when it had nothing. Mirrors skeletonGroups in garden.js.
    def skeleton_groups(counts, item: 'panel-row', list: 'repo-list', empty: 'panel-empty')
      counts.map do |count|
        skeleton('panel-heading') + (if count.zero?
                                       skeleton(empty)
                                     else
                                       %(<ul class="#{list}">#{skeleton(item,
                                                                        count)}</ul>)
                                     end)
      end.join
    end

    def i18n_json
      JSON.generate(locale:, strings: I18n.bundle(locale, ['common', 'errors', *tool.shares, tool.slug])).gsub('</',
                                                                                                               '<\/')
    end
  end
end
