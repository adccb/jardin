# frozen_string_literal: true

module Garden
  module Jira
    # Flattens a Jira issue payload into what the page needs.
    class Ticket
      FIELDS = %w[summary status priority issuetype project parent assignee labels updated created resolutiondate duedate].freeze

      def initialize(issue, site:, me: nil)
        @issue = issue
        @fields = issue.fetch('fields', {})
        @site = site
        @me = me
      end

      def to_h
        {
          key:, summary: @fields['summary'], url: URI.join(@site, "/browse/#{key}").to_s,
          status:, type:, priority: @fields.dig('priority', 'name'), project:, parent:, assignee:,
          mine: !@me.nil? && @fields.dig('assignee', 'accountId') == @me,
          labels: @fields['labels'] || [],
          updated: @fields['updated'], created: @fields['created'],
          resolved: @fields['resolutiondate'], due: @fields['duedate']
        }
      end

      private

      def key = @issue['key']

      def status
        { name: @fields.dig('status', 'name'), category: @fields.dig('status', 'statusCategory', 'key') }
      end

      def type
        { name: @fields.dig('issuetype', 'name'), subtask: @fields.dig('issuetype', 'subtask') == true }
      end

      def project
        { key: @fields.dig('project', 'key'), name: @fields.dig('project', 'name') }
      end

      def assignee
        person = @fields['assignee']
        person && { name: person['displayName'] }
      end

      def parent
        return unless @fields['parent']

        parent = @fields['parent']
        {
          key: parent['key'], summary: parent.dig('fields', 'summary'), type: parent.dig('fields', 'issuetype', 'name'),
          priority: parent.dig('fields', 'priority', 'name'),
          status: { name: parent.dig('fields', 'status', 'name'), category: parent.dig('fields', 'status', 'statusCategory', 'key') }
        }
      end
    end
  end
end
