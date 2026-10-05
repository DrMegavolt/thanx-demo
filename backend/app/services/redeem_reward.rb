class RedeemReward
  Result = Data.define(:redemption, :points_balance)
  MAX_ATTEMPTS = 3

  def self.call(user_id:, reward_id:, idempotency_key:)
    unless idempotency_key.is_a?(String) && Redemption::UUID_V4.match?(idempotency_key)
      raise Api::Error.new("invalid_idempotency_key", "Idempotency-Key must be a UUID v4.", status: 400)
    end
    attempts = 0
    begin
      attempts += 1
      # Rails 8's SQLite adapter begins an IMMEDIATE transaction before the first
      # query. Its database write lock serializes redemptions AND reward edits
      # across connections/processes; SQLite SELECT ... FOR UPDATE does not.
      # Header resolution may already have cached this user before the lock.
      ApplicationRecord.uncached do
        ApplicationRecord.transaction do
          user = User.find_by(id: user_id)
          raise Api::Error.new("user_not_found", "User not found.", status: 404) unless user
          previous = user.redemptions.find_by(idempotency_key: idempotency_key)
          if previous
            unless previous.reward_id == reward_id
              raise Api::Error.new("idempotency_conflict", "This idempotency key was already used for another reward.", status: 409)
            end
            # Replay before availability/balance checks, even after reward edits
            # or later purchases. The original transaction balance is a snapshot.
            next Result.new(redemption: previous, points_balance: previous.points_balance_after)
          end
          reward = Reward.find_by(id: reward_id)
          raise Api::Error.new("reward_not_found", "Reward not found.", status: 404) unless reward
          unless reward.active?
            raise Api::Error.new("reward_inactive", "This reward is inactive.", status: 422, details: { reward_id: reward.id })
          end
          if user.points_balance < reward.points_cost
            raise Api::Error.new("insufficient_points", "You do not have enough points to redeem this reward.", status: 422,
              details: { points_balance: user.points_balance, points_required: reward.points_cost })
          end
          user.update!(points_balance: user.points_balance - reward.points_cost)
          redemption = user.redemptions.create!(reward: reward, reward_name: reward.name, points_spent: reward.points_cost,
            idempotency_key: idempotency_key, points_balance_after: user.points_balance)
          Result.new(redemption: redemption, points_balance: user.points_balance)
        end
      end
    rescue ActiveRecord::StatementInvalid => error
      # Retry only known SQLite lock contention, after the transaction unwinds.
      # Other database failures must never be retried as ambiguous writes.
      raise unless error.cause.is_a?(SQLite3::BusyException) || error.cause.is_a?(SQLite3::LockedException)
      if attempts < MAX_ATTEMPTS
        sleep(0.025 * attempts)
        retry
      end
      raise Api::Error.new("service_unavailable", "The database is busy. Please try again later.", status: 503)
    end
  end
end
