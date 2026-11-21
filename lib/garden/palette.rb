# frozen_string_literal: true

module Garden
  # Picks the color palette from the garden_palette cookie, falling back to fairyfloss.
  # Colors live in public/css/garden.css (fairyfloss) and public/css/palettes.css (the rest).
  module Palette
    COOKIE = 'garden_palette'
    Choice = Data.define(:id, :name, :emoji)
    ALL = [
      Choice.new(id: 'fairyfloss', name: 'fairyfloss', emoji: '🍭'),
      Choice.new(id: 'catppuccin', name: 'Catppuccin', emoji: '🐈'),
      Choice.new(id: 'rose-pine', name: 'Rosé Pine', emoji: '🌹'),
      Choice.new(id: 'everforest', name: 'Everforest', emoji: '🌲')
    ].freeze

    def self.for(request) = ALL.find { |palette| palette.id == request.cookies[COOKIE] } || ALL.first
  end
end
