# frozen_string_literal: true

module Garden
  module Home
    # The home page gathers everything from the other pages' APIs in the browser, so it has none of its own.
    class Api
      include Responses

      def call(_request, _action) = not_found
    end
  end
end
