# frozen_string_literal: true

module Garden
  module Prs
    # Flattens a gh PR and decides which section of the open view it belongs in.
    class PullRequest
      def initialize(pr, repo:)
        @pr = pr
        @repo = repo
        @checks = Checks.new(pr['statusCheckRollup'])
        @review = Review.new(pr)
      end

      def to_h
        {
          repo: @repo, number: @pr['number'], title: @pr['title'], url: @pr['url'], state: @pr['state'],
          draft: draft?, group:, review: @review.to_h, checks: @checks.to_h,
          conflicts: conflicts?, behind: @pr['mergeStateStatus'] == 'BEHIND',
          head: @pr['headRefName'], base: @pr['baseRefName'],
          additions: @pr['additions'], deletions: @pr['deletions'],
          labels: Array(@pr['labels']).map { |label| label['name'] },
          created: @pr['createdAt'], updated: @pr['updatedAt'], merged: @pr['mergedAt'], closed: @pr['closedAt']
        }
      end

      def group
        return unless @pr['state'] == 'OPEN'
        return 'drafts' if draft?
        return 'needs_work' if needs_work?
        return 'mergeable' if mergeable?

        'waiting'
      end

      private

      def draft? = @pr['isDraft'] == true

      def needs_work?
        @review.decision == 'CHANGES_REQUESTED' || @checks.verdict == 'failing' || conflicts?
      end

      def mergeable?
        %w[passing none].include?(@checks.verdict) && (approved? || no_review_needed?)
      end

      def approved? = @review.decision == 'APPROVED'

      def no_review_needed? = @review.decision.nil? && @pr['mergeStateStatus'] == 'CLEAN'

      def conflicts?
        @pr['mergeable'] == 'CONFLICTING' || @pr['mergeStateStatus'] == 'DIRTY'
      end
    end
  end
end
