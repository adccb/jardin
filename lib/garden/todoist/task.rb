# frozen_string_literal: true

module Garden
  module Todoist
    # Flattens a Todoist task for the page. Todoist priority 4 is the red "p1" in its UI.
    class Task
      MARKDOWN_LINK = /\[([^\]]+)\]\([^)]+\)/

      def initialize(task, projects:, today:)
        @task = task
        @projects = projects
        @today = today
      end

      def to_h
        {
          id: @task['id'], content: @task['content'].to_s.gsub(MARKDOWN_LINK, '\1'),
          project: @projects[@task['project_id']], labels: @task['labels'] || [],
          priority: 5 - @task['priority'].to_i.clamp(1, 4),
          due_date:, due_datetime:, recurring: due['is_recurring'] == true,
          overdue: !due_date.nil? && due_date < @today,
          url: "https://app.todoist.com/app/task/#{@task['id']}"
        }
      end

      def sort_key
        [to_h[:overdue] ? 0 : 1, to_h[:priority], due_datetime || '~', @task['child_order'].to_i]
      end

      # For lists that run into the future: soonest first, then by priority.
      def date_key = [due_date || '~', due_datetime || '~', to_h[:priority], @task['child_order'].to_i]

      private

      def due = @task['due'] || {}
      def due_date = due['date']&.slice(0, 10)

      # API v1 puts a timed task's time inside due.date (Sync style); older shapes used due.datetime.
      def due_datetime = due['datetime'] || (due['date'] if due['date'].to_s.include?('T'))
    end
  end
end
