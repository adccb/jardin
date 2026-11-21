# frozen_string_literal: true

module Garden
  module Reviews
    class Api
      include Responses

      def initialize(search: Search.new)
        @search = search
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'list'] then json(200, list(refresh: request.query['refresh'] == '1'))
        else not_found
        end
      end

      private

      def list(refresh:)
        requests = @search.requests(refresh:)
        return { ok: false, error_key: 'errors.no_gh_access_reviews', requests: [] } unless requests

        { ok: true, requests: requests.sort_by { |pr| pr[:updated].to_s }.reverse }
      end
    end
  end
end
