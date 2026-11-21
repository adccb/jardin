# frozen_string_literal: true

module Garden
  module Jira
    # Reads the API token and its account email from the 1Password item JIRA_TOKEN_REF points at.
    class Credentials
      def initialize(reference = ENV['JIRA_TOKEN_REF'])
        @reference = reference
        @lock = Mutex.new
      end

      def pair
        @lock.synchronize { @pair ||= [email, read(@reference)] }
      end

      def forget
        @lock.synchronize { @pair = nil }
      end

      private

      def email
        found = read(sibling_field('username')).strip
        found = ENV['JIRA_EMAIL'].to_s.strip if found.empty?
        return found unless found.empty?

        raise Error.new('errors.jira.empty_username')
      end

      def sibling_field(name)
        reference.sub(%r{/[^/]+\z}, "/#{name}")
      end

      def reference
        if @reference.to_s.start_with?('op://')
          @reference
        else
          raise Error.new('errors.jira.no_token_ref')
        end
      end

      def read(ref) = Secrets.read(ref)
    end
  end
end
