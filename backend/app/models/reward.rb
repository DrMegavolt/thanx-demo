class Reward < ApplicationRecord
  has_many :redemptions, dependent: :restrict_with_error
  validates :name, presence: true
  validates :points_cost, numericality: { only_integer: true, greater_than: 0 }
end
