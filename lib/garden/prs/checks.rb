# frozen_string_literal: true

module Garden
  module Prs
    # Boils a statusCheckRollup down to one verdict plus counts.
    class Checks
      FAILED = %w[FAILURE TIMED_OUT CANCELLED ACTION_REQUIRED STARTUP_FAILURE ERROR].freeze
      PENDING = %w[PENDING EXPECTED QUEUED IN_PROGRESS WAITING REQUESTED].freeze

      def initialize(rollup)
        @outcomes = Array(rollup).map { |check| outcome(check) }
      end

      def to_h
        counts = @outcomes.tally
        { verdict:, passing: counts.fetch(:passing, 0), failing: counts.fetch(:failing, 0),
          pending: counts.fetch(:pending, 0) }
      end

      def verdict
        return 'none' if @outcomes.empty?
        return 'failing' if @outcomes.include?(:failing)
        return 'pending' if @outcomes.include?(:pending)

        'passing'
      end

      private

      def outcome(check)
        result = check['conclusion'].to_s.empty? ? check['state'] || check['status'] : check['conclusion']
        return :failing if FAILED.include?(result)
        return :pending if PENDING.include?(result) || (check['status'] && check['status'] != 'COMPLETED')

        :passing
      end
    end
  end
end
