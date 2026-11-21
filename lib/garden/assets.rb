# frozen_string_literal: true

module Garden
  class Assets
    include Responses

    TYPES = {
      '.css' => 'text/css; charset=utf-8',
      '.js' => 'text/javascript; charset=utf-8',
      '.svg' => 'image/svg+xml',
      '.png' => 'image/png'
    }.freeze

    def initialize(dir)
      @dir = File.expand_path(dir)
    end

    def serve(relative_path)
      file = File.expand_path(relative_path, @dir)
      return not_found unless file.start_with?("#{@dir}/") && File.file?(file) && TYPES.key?(File.extname(file))

      [200, { 'Content-Type' => TYPES.fetch(File.extname(file)) }, File.binread(file)]
    end
  end
end
