# frozen_string_literal: true

module Garden
  module Tasks
    # Tasks in one JSON file. Writes go to a temp file first, so a crash never leaves half a list.
    class Store
      MAX_TITLE = 500
      ID_FORMAT = /\A[0-9a-f-]{36}\z/

      def initialize(path)
        @path = path
        @lock = Mutex.new
      end

      def all
        @lock.synchronize { load }
      end

      def create(title)
        task = { 'id' => SecureRandom.uuid, 'title' => clean(title), 'created_at' => now, 'done_at' => nil }
        change { |tasks| tasks << task }
        task
      end

      def update(id, done:)
        change { |tasks| find!(tasks, id).merge!('done_at' => done ? now : nil) }
      end

      def delete(id)
        change { |tasks| tasks.delete(find!(tasks, id)) }
      end

      def restore(task)
        restored = validated(task)
        change do |tasks|
          raise Refusal.new('errors.task_exists') if tasks.any? { |existing| existing['id'] == restored['id'] }

          tasks << restored
          restored
        end
      end

      private

      def change
        @lock.synchronize do
          tasks = load
          result = yield tasks
          save(tasks)
          result
        end
      end

      def load
        File.exist?(@path) ? JSON.parse(File.read(@path)).fetch('tasks', []) : []
      end

      def save(tasks)
        FileUtils.mkdir_p(File.dirname(@path))
        temp = "#{@path}.tmp"
        File.write(temp, JSON.pretty_generate(tasks:))
        File.rename(temp, @path)
      end

      def find!(tasks, id)
        tasks.find { |task| task['id'] == id } or raise Refusal.new('errors.task_not_found')
      end

      def clean(title)
        text = title.to_s.gsub(/\s+/, ' ').strip
        raise Refusal.new('errors.task_empty') if text.empty?
        raise Refusal.new('errors.task_too_long', max: MAX_TITLE) if text.length > MAX_TITLE

        text
      end

      def validated(task)
        raise Refusal.new('errors.task_invalid') unless task.is_a?(Hash) && task['id'].to_s.match?(ID_FORMAT)

        {
          'id' => task['id'], 'title' => clean(task['title']),
          'created_at' => timestamp(task['created_at']), 'done_at' => task['done_at'] && timestamp(task['done_at'])
        }
      end

      def timestamp(value)
        Time.iso8601(value.to_s).utc.iso8601(3)
      rescue ArgumentError
        raise Refusal.new('errors.task_bad_date')
      end

      def now = Time.now.utc.iso8601(3)
    end
  end
end
