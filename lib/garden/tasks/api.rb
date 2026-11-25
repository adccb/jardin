# frozen_string_literal: true

module Garden
  module Tasks
    # The task page's API. Every task lives in Todoist; without TODOIST_TOKEN_REF the page says how to set it up.
    class Api
      include Responses

      def initialize(todoist: Todoist::Client.new(token: nil))
        @todoist = TodoistToday.new(todoist)
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'list'] then json(200, list(request.query))
        in ['POST', 'create'] then json(200, @todoist.create(request.params['text']))
        in ['POST', 'close'] then json(200, @todoist.close(request.params['id'].to_s))
        in ['POST', 'delete'] then json(200, @todoist.delete(request.params['id'].to_s))
        else not_found
        end
      end

      private

      def list(query)
        return { enabled: false } unless @todoist.enabled?

        keys = query['tabs']&.split(',') || TodoistToday::DEFAULT_SECTIONS
        { enabled: true, **@todoist.view(keys:, refresh: query['refresh'] == '1') }
      end
    end
  end
end
