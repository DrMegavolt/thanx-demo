class Redemption < ApplicationRecord
  UUID_V4 = /\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/
  belongs_to :user
  belongs_to :reward
  validates :reward_name, presence: true
  validates :points_spent, numericality: { only_integer: true, greater_than: 0 }
  validates :idempotency_key, format: { with: UUID_V4 }, uniqueness: { scope: :user_id }, allow_nil: true
  validates :points_balance_after, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, if: -> { idempotency_key.present? }
  validates :points_balance_after, absence: true, if: -> { idempotency_key.nil? }
end
