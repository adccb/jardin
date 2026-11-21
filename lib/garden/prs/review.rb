# frozen_string_literal: true

module Garden
  module Prs
    # Who's been asked, who approved, who wants changes.
    class Review
      def initialize(pr)
        @pr = pr
      end

      def to_h
        { decision:, requested:, approved_by: reviewers('APPROVED'), changes_by: reviewers('CHANGES_REQUESTED'),
          commented_by: reviewers('COMMENTED').reject { |login| bot?(login) } }
      end

      def decision = @pr['reviewDecision'].to_s.empty? ? nil : @pr['reviewDecision']

      private

      def requested
        Array(@pr['reviewRequests']).filter_map { |request| request['login'] || request['name'] || request['slug'] }
      end

      def bot?(login) = login.end_with?('[bot]') || login == 'github-actions'

      def reviewers(state)
        Array(@pr['latestReviews']).select do |review|
          review['state'] == state
        end.filter_map { |review| review.dig('author', 'login') }
      end
    end
  end
end
