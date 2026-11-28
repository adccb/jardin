# frozen_string_literal: true

module Garden
  # How many items each data region showed last time, from the garden_shapes cookie garden.js keeps,
  # so a page's first paint draws skeletons the size of what's coming.
  module Shapes
    COOKIE = 'garden_shapes'
    MAX_GROUPS = 8
    MAX_ITEMS = 16

    def self.for(request)
      saved = JSON.parse(request.cookies[COOKIE].to_s)
      saved.is_a?(Hash) ? saved.transform_values { counts(_1) }.compact : {}
    rescue JSON::ParserError
      {}
    end

    def self.counts(value)
      return unless value.is_a?(Array) && value.all?(Integer)

      value.first(MAX_GROUPS).map { _1.clamp(0, MAX_ITEMS) }
    end
  end
end
