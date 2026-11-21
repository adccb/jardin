# frozen_string_literal: true

module Garden
  module Jira
    class Api
      include Responses

      KEY_FORMAT = /\A[A-Z][A-Z0-9_]+-\d+\z/
      SPRINT_ID = /\A\d+\z/
      TTL = 60
      OPEN = 'assignee = currentUser() AND statusCategory != Done'
      OPEN_OR_RECENTLY_DONE = 'assignee = currentUser() AND (statusCategory != Done OR resolved >= -30d)'

      def initialize(site:, credentials: Credentials.new)
        @client = Client.new(site:, credentials:)
        @cache = {}
        @lock = Mutex.new
      end

      def call(request, action)
        case [request.method, action]
        in ['GET', 'tickets'] then json(200, request.query['view'] == 'sprint' ? sprint(request.query) : mine(request.query))
        in ['GET', 'sprints'] then json(200, my_sprints(refresh: request.query['refresh'] == '1'))
        in ['GET', 'ticket'] then json(200, ticket(request.query['key'].to_s))
        else not_found
        end
      end

      private

      def mine(query)
        include_done = query['done'] == '1'
        jql = "#{include_done ? OPEN_OR_RECENTLY_DONE : OPEN} ORDER BY updated DESC"
        issues = cached(jql, refresh: query['refresh'] == '1') { @client.search(jql, Ticket::FIELDS) }
        { view: 'mine', site: @client.site, include_done:, tickets: issues.map { |issue| present(issue) } }
      end

      def my_sprints(refresh:)
        field = @client.sprint_field
        issues = cached(MySprints::JQL, refresh:) { @client.search(MySprints::JQL, [field]) }
        { sprints: MySprints.new(issues, field:).to_a }
      end

      # Everything in one sprint, in board order, assigned to anyone.
      def sprint(query)
        id = query['sprint'].to_s
        raise Refusal.new('errors.bad_sprint', id:) unless id.match?(SPRINT_ID)

        refresh = query['refresh'] == '1'
        sprint = cached("sprint:#{id}", refresh:) { @client.sprint(id) }
        jql = "sprint = #{id} ORDER BY Rank ASC"
        issues = cached(jql, refresh:) { @client.search(jql, Ticket::FIELDS) }
        {
          view: 'sprint', site: @client.site, sprint: MySprints.present(sprint),
          tickets: issues.each_with_index.map { |issue, position| present(issue).merge(position:) }
        }
      end

      def ticket(key)
        raise Refusal.new('errors.bad_ticket_key', key:) unless key.match?(KEY_FORMAT)

        issue = @client.issue(key, [*Ticket::FIELDS, 'description'])
        { ticket: present(issue), description_html: Adf.new.render(issue.dig('fields', 'description')) }
      end

      def present(issue) = Ticket.new(issue, site: @client.site, me: @client.whoami['accountId']).to_h

      def cached(key, refresh:)
        @lock.synchronize do
          @cache.delete(key) if refresh
          hit = @cache[key]
          return hit[:value] if hit && Time.now - hit[:at] < TTL
        end
        yield.tap { |value| @lock.synchronize { @cache[key] = { value:, at: Time.now } } }
      end
    end
  end
end
