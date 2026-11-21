# frozen_string_literal: true

module Garden
  module Todoist
    # A Todoist problem shown to you as a 502, translated by App.
    class Error < LocalizedError
      def initialize(key, **vars)
        super(key, status: 502, **vars)
      end
    end
  end
end

require_relative 'todoist/client'
require_relative 'todoist/task'
require_relative 'todoist/saved_filter'
