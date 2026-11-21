# frozen_string_literal: true

module Garden
  module Jira
    # A Jira problem shown to you as a 502, translated by App.
    class Error < LocalizedError
      def initialize(key, **vars)
        super(key, status: 502, **vars)
      end
    end
  end
end

require_relative 'jira/credentials'
require_relative 'jira/client'
require_relative 'jira/adf'
require_relative 'jira/ticket'
require_relative 'jira/my_sprints'
require_relative 'jira/api'
