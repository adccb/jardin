# frozen_string_literal: true

module Garden
  # Reads secrets out of 1Password with the op CLI, so tokens never sit in env vars or files.
  module Secrets
    def self.read(reference)
      out, err, status = Open3.capture3('op', 'read', '--no-newline', reference)
      return out if status.success?

      raise LocalizedError.new('errors.secrets.op_refused', status: 502, field: reference.split('/').last,
                                                            detail: err.strip)
    rescue Errno::ENOENT
      raise LocalizedError.new('errors.secrets.no_op', status: 502)
    end
  end
end
