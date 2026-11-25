# Shoots every demo scene in light and dark, then lays each pair side by side as a JPEG:
#   - in Rosé Pine, once per language       → OUT/<lang>/<scene>.jpg
#   - in English, once per other palette    → OUT/palettes/<palette>/<scene>.jpg
# usage: ruby demo_garden.rb &  then  ruby shoot.rb OUT_DIR [scene-name-filter]
require 'fileutils'
require 'json'
require 'open3'
require 'erb'
require 'tmpdir'
require_relative 'scenes'

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
BASE = 'http://localhost:4750'
WIDTH = 1280
HEIGHT = 900 # every scene shares one viewport, so every image comes out the same size
GUTTER = 36
JPEG_QUALITY = 85
LANGS = %w[en fr es ja].freeze
DEFAULT_PALETTE = 'rose-pine'
OTHER_PALETTES = %w[catppuccin everforest nightfox dracula tokyo-night].freeze
THEMES = { 'light' => 1, 'dark' => 0 }.freeze
CAPTIONS = { 'en' => %w[light dark], 'fr' => %w[clair sombre], 'es' => %w[claro oscuro], 'ja' => %w[ライト ダーク] }.freeze
WORK = File.join(Dir.tmpdir, 'garden-screenshots')

Job = Data.define(:scene, :lang, :palette, :target) do
  def name = "#{palette}-#{lang}-#{scene[:name]}"
  def url = "#{BASE}#{scene[:page]}?lang=#{lang}&palette=#{palette}&scene=#{scene[:name]}"
end

def chrome(url, path, width:, height:, profile:, theme: 1)
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

def to_jpeg(png, jpeg)
  FileUtils.mkdir_p(File.dirname(jpeg))
  _out, err, status = Open3.capture3('sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', JPEG_QUALITY.to_s, png,
                                     '--out', jpeg)
  raise "sips failed for #{png}: #{err}" unless status.success?
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

def shoot(job, profile)
  light, dark = THEMES.map do |theme, flag|
    path = File.join(WORK, "#{job.name}-#{theme}.png")
    chrome(job.url, path, width: WIDTH, height: HEIGHT, theme: flag, profile:)
    path
  end
  labels = CAPTIONS.fetch(job.lang)
  pair = File.join(WORK, "#{job.name}.html")
  File.write(pair, PAIR.result(binding))
  composite = File.join(WORK, "#{job.name}.png")
  chrome("file://#{pair}", composite, width: (WIDTH * 2) + (GUTTER * 3), height: HEIGHT + (GUTTER * 2) + 34, profile:)
  to_jpeg(composite, job.target)
end

out_dir = File.expand_path(ARGV.fetch(0))
filter = ARGV[1]
scenes = Demo::Scenes::LIST.select { |scene| filter.nil? || scene[:name].include?(filter) }
jobs = scenes.product(LANGS).map do |scene, lang|
  Job.new(scene:, lang:, palette: DEFAULT_PALETTE, target: File.join(out_dir, lang, "#{scene[:name]}.jpg"))
end +
       scenes.product(OTHER_PALETTES).map do |scene, palette|
         Job.new(scene:, lang: 'en', palette:, target: File.join(out_dir, 'palettes', palette, "#{scene[:name]}.jpg"))
       end

FileUtils.mkdir_p(WORK)
queue = Queue.new
jobs.each { |job| queue << job }
workers = Array.new(4) do |index|
  Thread.new do
    profile = File.join(WORK, "profile-#{index}")
    while (job = begin
      queue.pop(true)
    rescue StandardError
      nil
    end)
      shoot(job, profile)
      puts "✓ #{job.target.delete_prefix("#{out_dir}/")}"
    end
  end
end
workers.each(&:join)
puts "#{jobs.size} images"
