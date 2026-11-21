# frozen_string_literal: true

require 'erb'
require 'date'
require 'fileutils'
require 'forwardable'
require 'json'
require 'net/http'
require 'open3'
require 'securerandom'
require 'socket'
require 'time'
require 'uri'

module Garden
  ROOT = File.expand_path('..', __dir__)

end

require_relative 'garden/i18n'

module Garden
  # A request garden won't do; shown to you as a 422 in your language.
  class Refusal < LocalizedError
    def initialize(key, **vars)
      super(key, status: 422, **vars)
    end
  end
end

require_relative 'garden/responses'
require_relative 'garden/view'
require_relative 'garden/secrets'
require_relative 'garden/git'
require_relative 'garden/http_server'
require_relative 'garden/tool'
require_relative 'garden/layout'
require_relative 'garden/assets'
require_relative 'garden/app'
require_relative 'garden/branches'
require_relative 'garden/github'
require_relative 'garden/prs'
require_relative 'garden/reviews'
require_relative 'garden/jira'
require_relative 'garden/todoist'
require_relative 'garden/tasks'
