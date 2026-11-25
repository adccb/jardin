# frozen_string_literal: true

module Garden
  module Reviews
    class Api
      include Responses

      # hidden_slugs: the owner/name of repos hidden on the settings page; their requests are left out.
      def initialize(search: Search.new, hidden_slugs: -> { [] })
        @search = search
        @hidden_slugs = hidden_slugs
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

        hidden = @hidden_slugs.call
        shown = requests.reject { |pr| hidden.include?(pr[:repo]) }
        { ok: true, requests: shown.sort_by { |pr| pr[:updated].to_s }.reverse }
      end
    end
  end
end
