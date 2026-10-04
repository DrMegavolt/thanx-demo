class User < ApplicationRecord
  has_many :redemptions, dependent: :restrict_with_error
  validates :name, presence: true
  validates :points_balance, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
