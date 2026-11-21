# frozen_string_literal: true

module Garden
  class Git
    Result = Data.define(:out, :err, :ok)

    def initialize(dir)
      @dir = dir
    end

    def run(*args)
      out, err, status = Open3.capture3('git', '-C', @dir, *args)
      Result.new(out:, err: err.strip, ok: status.success?)
    end

    def lines(*args)
      result = run(*args)
      result.ok ? result.out.lines(chomp: true) : []
    end
  end
end
