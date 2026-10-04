class Redemption < ApplicationRecord
  belongs_to :user
  belongs_to :reward
  validates :reward_name, presence: true
  validates :points_spent, numericality: { only_integer: true, greater_than: 0 }
end
