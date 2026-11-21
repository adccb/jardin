# frozen_string_literal: true

module Garden
  module Jira
    # Renders Atlassian Document Format to HTML. Every string is escaped; only http(s) links survive.
    class Adf
      BLOCKS = {
        'paragraph' => 'p', 'bulletList' => 'ul', 'orderedList' => 'ol', 'listItem' => 'li',
        'blockquote' => 'blockquote', 'table' => 'table', 'tableRow' => 'tr',
        'tableHeader' => 'th', 'tableCell' => 'td', 'taskList' => 'ul class="adf-tasks"',
        'decisionList' => 'ul class="adf-decisions"'
      }.freeze

      MARKS = { 'strong' => 'strong', 'em' => 'em', 'code' => 'code', 'strike' => 's', 'underline' => 'u' }.freeze

      def render(node)
        return '' unless node.is_a?(Hash)

        type = node['type']
        return element(BLOCKS.fetch(type), children(node)) if BLOCKS.key?(type)

        method = :"render_#{type.to_s.gsub(/([A-Z])/) { "_#{::Regexp.last_match(1).downcase}" }}"
        respond_to?(method, true) ? send(method, node) : children(node)
      end

      private

      def children(node) = Array(node['content']).map { |child| render(child) }.join

      def attrs(node) = node['attrs'] || {}

      def escape(text) = ERB::Util.html_escape(text.to_s)

      def element(tag, inner)
        name = tag.split(' ').first
        "<#{tag}>#{inner}</#{name}>"
      end

      def safe_url(url)
        url.to_s.match?(%r{\Ahttps?://}i) ? url.to_s : nil
      end

      def link(url, text)
        href = safe_url(url)
        href ? %(<a href="#{escape(href)}" target="_blank" rel="noopener">#{text}</a>) : text
      end

      def render_doc(node) = children(node)

      def render_text(node)
        Array(node['marks']).reduce(escape(node['text'])) { |html, mark| apply_mark(html, mark) }
      end

      def apply_mark(html, mark)
        return link(attrs(mark)['href'], html) if mark['type'] == 'link'
        return element(MARKS.fetch(mark['type']), html) if MARKS.key?(mark['type'])
        return element(attrs(mark)['type'] == 'sub' ? 'sub' : 'sup', html) if mark['type'] == 'subsup'

        html
      end

      def render_heading(node)
        level = attrs(node)['level'].to_i.clamp(1, 6)
        element("h#{[level + 2, 6].min}", children(node))
      end

      def render_code_block(node) = "<pre><code>#{children(node)}</code></pre>"
      def render_rule(_node) = '<hr>'
      def render_hard_break(_node) = '<br>'
      def render_mention(node) = %(<span class="adf-mention">#{escape(attrs(node)['text'] || '@someone')}</span>)
      def render_emoji(node) = escape(attrs(node)['text'] || attrs(node)['shortName'])
      def render_status(node) = %(<span class="adf-status">#{escape(attrs(node)['text'])}</span>)

      def render_date(node)
        escape(Time.at(attrs(node)['timestamp'].to_i / 1000).strftime('%b %-d, %Y'))
      end

      def render_inline_card(node)
        url = attrs(node)['url']
        link(url, escape(url))
      end
      alias render_block_card render_inline_card
      alias render_embed_card render_inline_card

      def render_panel(node)
        kind = attrs(node)['panelType'].to_s.gsub(/[^a-z]/, '')
        %(<div class="adf-panel adf-panel-#{kind}">#{children(node)}</div>)
      end

      def render_expand(node)
        "<details><summary>#{escape(attrs(node)['title'] || 'more')}</summary>#{children(node)}</details>"
      end
      alias render_nested_expand render_expand

      def render_task_item(node)
        box = attrs(node)['state'] == 'DONE' ? '☑️' : '⬜️'
        "<li>#{box} #{children(node)}</li>"
      end

      def render_decision_item(node) = "<li>🧭 #{children(node)}</li>"

      def render_media_single(_node) = %(<p class="adf-media">📎 an attachment lives here (open in jira to see it)</p>)
      alias render_media_group render_media_single
      alias render_media render_media_single
    end
  end
end
