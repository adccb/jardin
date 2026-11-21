# Shoots every demo scene in light and dark, per language, then lays each pair side by side.
# usage: ruby demo_garden.rb &  then  ruby shoot.rb .. [scene-name-filter]   (writes ../en and ../fr)
require 'fileutils'
require "json"
require 'open3'
require 'erb'
require 'tmpdir'
require_relative 'scenes'

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
BASE = 'http://localhost:4750'
WIDTH = 1280
HEIGHT = 900 # every scene shares one viewport, so every image comes out the same size
GUTTER = 36
LANGS = %w[en fr].freeze
THEMES = { 'light' => 1, 'dark' => 0 }.freeze
WORK = File.join(Dir.tmpdir, 'garden-screenshots')

out_dir = File.expand_path(ARGV.fetch(0))
filter = ARGV[1]
scenes = Demo::Scenes::LIST.select { |scene| filter.nil? || scene[:name].include?(filter) }

def chrome(url, path, width:, height:, theme: 1, profile:)
  args = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', "--blink-settings=preferredColorScheme=#{theme}",
          "--window-size=#{width},#{height}", '--virtual-time-budget=20000', "--user-data-dir=#{profile}",
          '--allow-file-access-from-files', "--screenshot=#{path}", url]
  # Chrome sometimes fails to launch when several start at once (macOS code-sign clone race), so retry.
  err = nil
  4.times do |attempt|
    FileUtils.rm_f(path)
    _out, err, status = Open3.capture3(*args)
    return if status.success? && File.size?(path)

    sleep(1 + attempt)
  end
  raise "chrome failed for #{url}: #{err}"
end

PAIR = ERB.new(<<~HTML)
  <!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: <%= GUTTER %>px; display: flex; gap: <%= GUTTER %>px;
           background: linear-gradient(135deg, #fbe4f0, #2c2440); font-family: -apple-system, system-ui, sans-serif; }
    figure { margin: 0; }
    figcaption { font-weight: 700; font-size: 18px; margin-bottom: 12px; }
    .light figcaption { color: #6b3a5a; } .dark figcaption { color: #f4e9ff; }
    img { display: block; width: <%= WIDTH %>px; border-radius: 18px; box-shadow: 0 12px 36px rgba(20, 0, 40, .35); }
  </style></head><body>
    <figure class="light"><figcaption>☀️ <%= labels[0] %></figcaption><img src="file://<%= light %>"></figure>
    <figure class="dark"><figcaption>🌙 <%= labels[1] %></figcaption><img src="file://<%= dark %>"></figure>
  </body></html>
HTML

CAPTIONS = { 'en' => %w[light dark], 'fr' => %w[clair sombre] }.freeze

jobs = scenes.product(LANGS)
queue = Queue.new
jobs.each { |job| queue << job }
workers = Array.new(4) do |index|
  Thread.new do
    profile = File.join(WORK, "profile-#{index}")
    while (job = queue.pop(true) rescue nil)
      scene, lang = job
      shots = THEMES.to_h do |theme, flag|
        path = File.join(WORK, lang, "#{scene[:name]}-#{theme}.png")
        FileUtils.mkdir_p(File.dirname(path))
        chrome("#{BASE}#{scene[:page]}?lang=#{lang}&scene=#{scene[:name]}", path, width: WIDTH, height: HEIGHT,
               theme: flag, profile:)
        [theme, path]
      end
      pair = File.join(WORK, lang, "#{scene[:name]}.html")
      labels = CAPTIONS.fetch(lang)
      light = shots['light']
      dark = shots['dark']
      File.write(pair, PAIR.result(binding))
      target = File.join(out_dir, lang, "#{scene[:name]}.png")
      FileUtils.mkdir_p(File.dirname(target))
      chrome("file://#{pair}", target, width: (WIDTH * 2) + (GUTTER * 3), height: HEIGHT + (GUTTER * 2) + 34, profile:)
      puts "✓ #{lang}/#{scene[:name]}"
    end
  end
end
workers.each(&:join)
