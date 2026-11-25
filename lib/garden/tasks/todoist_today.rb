# frozen_string_literal: true

module Garden
  module Tasks
    # The task page, all of it in Todoist: whichever of four lists you show as tabs (today, late, inbox,
    # upcoming), and planting, closing and deleting tasks.
    # Each list is cached briefly on its own; any change busts them all.
    class TodoistToday
      extend Forwardable

      TTL = 30
      PROJECTS_TTL = 600
      MAX_TEXT = 500
      ID_FORMAT = /\A[A-Za-z0-9_-]{1,64}\z/
      # Filter queries are English filter words, whatever your Todoist language. The inbox is fetched by project.
      QUERIES = { 'today' => 'today', 'late' => 'overdue', 'upcoming' => 'due after: today' }.freeze
      SECTIONS = %w[today late inbox upcoming].freeze
      DEFAULT_SECTIONS = %w[today late].freeze

      def_delegators :@client, :enabled?

      def initialize(client)
        @client = client
        @lock = Mutex.new
        @cache = {}
        @projects = nil
      end

      # Keys outside SECTIONS are dropped; the tabs come back in SECTIONS order.
      def view(keys: DEFAULT_SECTIONS, refresh: false)
        @lock.synchronize { @cache.clear } if refresh
        projects = projects(refresh:)
        wanted = SECTIONS & keys
        sections = wanted.map { |key| Thread.new { cached(key) { section(key, projects) } } }
        { sections: sections.map(&:value) }
      end

      # Quick add reads Todoist's syntax; a task it found no date in is due today, so it lands on the page.
      def create(text)
        task = nil
        result = change do
          task = @client.quick_add(clean(text))
          @client.update(task['id'], due_string: 'today') if task['due'].nil?
        end
        result.merge(id: task['id'])
      end

      def close(id) = change { @client.close(checked(id)) }
      def delete(id) = change { @client.delete(checked(id)) }

      private

      def cached(key)
        @lock.synchronize do
          entry = @cache[key]
          return entry[:value] if entry && !stale?(entry, TTL)
        end
        value = yield
        @lock.synchronize { @cache[key] = { value:, at: Time.now } }
        value
      end

      def section(key, projects)
        raw = key == 'inbox' ? @client.project_tasks(projects[:inbox_id]) : @client.filter_tasks(QUERIES.fetch(key), lang: 'en')
        tasks = raw.map { |task| flatten(task, projects) }
        { key:, tasks: tasks.sort_by { key == 'upcoming' ? _1.date_key : _1.sort_key }.map(&:to_h) }
      end

      def flatten(task, projects) = Todoist::Task.new(task, projects: projects[:names], today: Date.today.iso8601)

      # Project names (and which one is your inbox) change rarely, so they're cached longer.
      def projects(refresh:)
        @lock.synchronize { @projects = nil if refresh || stale?(@projects, PROJECTS_TTL) }
        @projects&.fetch(:value) || begin
          list = @client.projects
          value = { names: list.to_h { |project| [project['id'], project['name']] },
                    inbox_id: list.find { |project| project['inbox_project'] }&.fetch('id', nil) }
          @lock.synchronize { @projects = { value:, at: Time.now } }
          value
        end
      end

      def change
        raise Refusal.new('errors.todoist.not_set_up') unless enabled?

        yield
        @lock.synchronize { @cache.clear }
        { ok: true }
      end

      def clean(text)
        words = text.to_s.gsub(/\s+/, ' ').strip
        raise Refusal.new('errors.task_empty') if words.empty?
        raise Refusal.new('errors.task_too_long', max: MAX_TEXT) if words.length > MAX_TEXT

        words
      end

      def checked(id)
        id.match?(ID_FORMAT) ? id : raise(Refusal.new('errors.todoist.bad_id'))
      end

      def stale?(entry, ttl) = entry && Time.now - entry[:at] > ttl
    end
  end
end
