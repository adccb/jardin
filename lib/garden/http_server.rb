# frozen_string_literal: true

module Garden
  Request = Data.define(:method, :target, :headers, :body) do
    def uri = URI.parse(target)
    def path = uri.path
    def query = URI.decode_www_form(uri.query.to_s).to_h
    def post? = method == 'POST'

    def cookies
      headers['cookie'].to_s.split(';').to_h { |pair| pair.strip.split('=', 2).map { |part| URI.decode_www_form_component(part.to_s) } }
    end

    def params
      parsed = JSON.parse(body.empty? ? '{}' : body)
      parsed.is_a?(Hash) ? parsed : {}
    end
  end

  # A tiny threaded HTTP/1.1 server, since WEBrick left the stdlib.
  class HttpServer
    MAX_BODY = 64 * 1024
    REASONS = {
      200 => 'OK', 302 => 'Found', 400 => 'Bad Request', 403 => 'Forbidden', 404 => 'Not Found',
      422 => 'Unprocessable Content', 500 => 'Internal Server Error', 502 => 'Bad Gateway'
    }.freeze

    def initialize(app, port)
      @app = app
      @port = port
    end

    def start
      server = TCPServer.new('127.0.0.1', @port)
      yield if block_given?
      loop { Thread.new(server.accept) { |client| serve(client) } }
    end

    private

    def serve(client)
      request = read_request(client) or return
      write(client, *@app.call(request))
    rescue StandardError => e
      warn "🥀 #{e.class}: #{e.message}"
      write(client, 500, { 'Content-Type' => 'application/json' },
            JSON.generate(ok: false, error: "something wilted: #{e.message}"))
    ensure
      client.close
    end

    def read_request(client)
      method, target = client.gets&.split(' ', 3)
      return unless target

      headers = read_headers(client)
      length = headers['content-length'].to_i.clamp(0, MAX_BODY)
      Request.new(method:, target:, headers:, body: length.positive? ? client.read(length) : '')
    end

    def read_headers(client)
      headers = {}
      while (line = client.gets) && line != "\r\n"
        key, value = line.split(':', 2)
        headers[key.strip.downcase] = value.to_s.strip
      end
      headers
    end

    def write(client, status, headers, body)
      head = headers.merge('Content-Length' => body.bytesize, 'Cache-Control' => 'no-store', 'Connection' => 'close')
      client.write("HTTP/1.1 #{status} #{REASONS.fetch(status, 'OK')}\r\n")
      client.write(head.map { |key, value| "#{key}: #{value}\r\n" }.join, "\r\n")
      client.write(body)
    rescue IOError, SystemCallError
      nil
    end
  end
end
