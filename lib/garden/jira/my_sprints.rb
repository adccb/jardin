# frozen_string_literal: true

module Garden
  module Jira
    # The open sprints holding your tickets, with how many of yours each one has. Active ones first.
    class MySprints
      JQL = 'assignee = currentUser() AND sprint in openSprints()'

      def initialize(issues, field:)
        @sprints = issues.flat_map { |issue| Array(issue.dig('fields', field)) }
                         .reject { |sprint| sprint['state'] == 'closed' }
      end

      def to_a
        @sprints.group_by { |sprint| sprint['id'] }
                .map { |_id, copies| self.class.present(copies.first).merge(mine: copies.size) }
                .sort_by { |sprint| [sprint[:state] == 'active' ? 0 : 1, sprint[:start].to_s, sprint[:name].to_s] }
      end

      def self.present(sprint)
        { id: sprint['id'], name: sprint['name'], state: sprint['state'], start: sprint['startDate'], end: sprint['endDate'] }
      end
    end
  end
end
