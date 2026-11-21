# frozen_string_literal: true

module Garden
  module Tasks
    class Api
      include Responses

      def initialize(path:, todoist: Todoist::Client.new(token: nil), todoist_filter: "aujourd'hui")
        @store = Store.new(path)
        @todoist = TodoistToday.new(todoist, filter_name: todoist_filter)
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'list'] then json(200, tasks: @store.all)
        in ['POST', 'create'] then json(200, ok: true, task: @store.create(request.params['title']))
        in ['POST', 'update'] then json(200, ok: true, task: update(request.params))
        in ['POST', 'delete'] then json(200, ok: true, task: @store.delete(request.params['id'].to_s))
        in ['POST', 'restore'] then json(200, ok: true, task: @store.restore(request.params['task']))
        in ['GET', 'todoist'] then json(200, todoist(request.query))
        in ['POST', 'todoist/close'] then json(200, @todoist.close(request.params['id'].to_s))
        in ['POST', 'todoist/reopen'] then json(200, @todoist.reopen(request.params['id'].to_s))
        else not_found
        end
      end

      private

      def todoist(query)
        return { enabled: false } unless @todoist.enabled?

        { enabled: true, **@todoist.view(refresh: query['refresh'] == '1') }
      end

      def update(params) = @store.update(params['id'].to_s, done: params['done'] == true)
    end
  end
end
