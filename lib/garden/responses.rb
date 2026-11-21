# frozen_string_literal: true

module Garden
  # Rack-ish triples: [status, headers, body].
  module Responses
    private

    def json(status, payload)
      [status, { 'Content-Type' => 'application/json; charset=utf-8' }, JSON.generate(payload)]
    end

    def html(body)
      [200, { 'Content-Type' => 'text/html; charset=utf-8' }, body]
    end

    def redirect(location)
      [302, { 'Location' => location, 'Content-Type' => 'text/plain' }, '']
    end

    def not_found
      raise LocalizedError.new('errors.not_found', status: 404)
    end
  end
end
