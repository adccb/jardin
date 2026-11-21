# frozen_string_literal: true

module Garden
  module Reviews
    # One PR someone asked you (or your team) to review, flattened for the page.
    class Request
      def initialize(pr, via:)
        @pr = pr
        @via = via
      end

      def to_h
        {
          repo: @pr.dig('repository', 'nameWithOwner'), number: @pr['number'], title: @pr['title'], url: @pr['url'],
          author: @pr.dig('author', 'login'), draft: @pr['isDraft'] == true,
          labels: Array(@pr['labels']).map { |label| label['name'] },
          comments: @pr['commentsCount'].to_i, created: @pr['createdAt'], updated: @pr['updatedAt'], via: @via
        }
      end
    end
  end
end
