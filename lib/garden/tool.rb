# frozen_string_literal: true

module Garden
  # One page in the suite: its sidebar emoji and its JSON API. Its title lives in locales as "<slug>.title".
  # Files follow the slug: pages/<slug>.html.erb, public/css/<slug>.css, public/js/<slug>.js, locales/*/<slug>.yml.
  Tool = Data.define(:slug, :emoji, :api) do
    def path = "/#{slug}"
    def template = File.join(ROOT, 'pages', "#{slug}.html.erb")
  end
end
