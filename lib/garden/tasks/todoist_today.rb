# frozen_string_literal: true

module Garden
  module Tasks
    # Your saved Todoist filter for the task page: one section per comma part, each its own list.
    # Cached briefly; closing or reopening a task busts the cache.
    class TodoistToday
      extend Forwardable

      TTL = 30
      SETUP_TTL = 600
      ID_FORMAT = /\A[A-Za-z0-9_-]{1,64}\z/

      def_delegators :@client, :enabled?

      def initialize(client, filter_name:)
        @client = client
        @filter_name = filter_name
        @lock = Mutex.new
        @cached = nil
        @setup = nil
      end

      def view(refresh: false)
        @lock.synchronize { @cached = nil if refresh || stale?(@cached, TTL) }
        @cached&.fetch(:value) || fresh_view(refresh:)
      end

      def close(id) = change { @client.close(checked(id)) }
      def reopen(id) = change { @client.reopen(checked(id)) }

      private

      def fresh_view(refresh:)
        setup = setup(refresh:)
        value = {
          filter: { name: setup[:filter].name, url: setup[:filter].url },
          sections: setup[:parts].map { |part| Thread.new { section(part, setup) } }.map(&:value)
        }
        @lock.synchronize { @cached = { value:, at: Time.now } }
        value
      end

      def section(part, setup)
        today = Date.today.iso8601
        tasks = @client.filter_tasks(part[:query], lang: setup[:lang])
                       .map { |task| Todoist::Task.new(task, projects: setup[:project_names], today:) }
        { label: part[:label], tasks: tasks.sort_by(&:sort_key).map(&:to_h) }
      end

      # The filter, your language and project names change rarely, so they're cached longer.
      def setup(refresh:)
        @lock.synchronize { @setup = nil if refresh || stale?(@setup, SETUP_TTL) }
        @setup&.fetch(:value) || fresh_setup
      end

      def fresh_setup
        filters, lang = @client.filters_and_lang
        projects = @client.projects
        filter = Todoist::SavedFilter.find(filters, @filter_name)
        inbox_name = projects.find { |project| project['inbox_project'] }&.fetch('name', nil)
        value = {
          filter:, lang:, parts: filter.parts(lang:, inbox_name:),
          project_names: projects.to_h { |project| [project['id'], project['name']] }
        }
        @lock.synchronize { @setup = { value:, at: Time.now } }
        value
      end

      def change
        yield
        @lock.synchronize { @cached = nil }
        { ok: true }
      end

      def checked(id)
        id.match?(ID_FORMAT) ? id : raise(Refusal.new('errors.todoist.bad_id'))
      end

      def stale?(entry, ttl) = entry && Time.now - entry[:at] > ttl
    end
  end
end
