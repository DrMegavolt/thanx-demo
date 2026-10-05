require "test_helper"

class RedeemRewardTest < ActiveSupport::TestCase
  setup do
    @user = create_user(balance: 500)
    @reward = create_reward(cost: 250)
  end

  test "invalid service keys cannot replay legacy history or debit points" do
    Redemption.create!(user: @user, reward: @reward, reward_name: @reward.name, points_spent: 250)
    [nil, "bad-key"].each do |key|
      error = assert_raises(Api::Error) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: key) }
      assert_equal "invalid_idempotency_key", error.code
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 1, Redemption.count
  end

  test "debits stored balance and captures reward snapshots" do
    result = RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid)
    assert_equal 250, result.points_balance
    assert_equal 250, @user.reload.points_balance
    assert_equal @user.id, result.redemption.user_id
    assert_equal @reward.id, result.redemption.reward_id
    assert_equal "Coffee", result.redemption.reward_name
    assert_equal 250, result.redemption.points_spent
    @reward.update!(name: "Tea", points_cost: 300, active: false)
    assert_equal "Coffee", result.redemption.reload.reward_name
    assert_equal 250, result.redemption.points_spent
  end

  test "exact balance is redeemable and new keys charge separately" do
    2.times { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
    assert_equal 0, @user.reload.points_balance
    assert_equal 2, @user.redemptions.count
  end

  test "domain failures leave balance and history unchanged in validation order" do
    @reward.update!(active: false)
    @user.update!(points_balance: 0)
    [[@reward.id + 1000, "reward_not_found"], [@reward.id, "reward_inactive"]].each do |id, code|
      error = assert_raises(Api::Error) { RedeemReward.call(user_id: @user.id, reward_id: id, idempotency_key: SecureRandom.uuid) }
      assert_equal code, error.code
    end
    @reward.update!(active: true)
    error = assert_raises(Api::Error) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
    assert_equal "insufficient_points", error.code
    assert_equal({ points_balance: 0, points_required: 250 }, error.details)
    assert_equal 0, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "history failure rolls back a debit" do
    # Inject failure at the real persistence boundary, after the user UPDATE.
    with_history_failure(ActiveRecord::RecordInvalid.new(Redemption.new)) do
      assert_raises(ActiveRecord::RecordInvalid) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "failure after inserting history rolls back both persisted changes" do
    with_history_failure(RuntimeError.new("failure after insert"), timing: :after) do
      assert_raises(RuntimeError) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "transient contention retries the whole transaction without charging twice" do
    attempts = 0
    callback = ->(_record) do
      attempts += 1
      if attempts == 1
        begin
          raise SQLite3::BusyException, "locked"
        rescue SQLite3::BusyException
          raise ActiveRecord::StatementInvalid, "locked"
        end
      end
    end
    Redemption.set_callback(:create, :before, callback)
    result = RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid)
    assert_equal 2, attempts
    assert_equal 250, result.points_balance
    assert_equal 250, @user.reload.points_balance
    assert_equal 1, Redemption.count
  ensure
    Redemption.skip_callback(:create, :before, callback)
  end

  test "retries busy and locked failures only up to the bound" do
    [SQLite3::BusyException, SQLite3::LockedException].each do |exception_class|
      attempts = 0
      operation = ->(*) do
        attempts += 1
        begin
          raise exception_class, "database is locked"
        rescue exception_class
          raise ActiveRecord::StatementInvalid, "locked"
        end
      end
      ApplicationRecord.stub(:transaction, operation) do
        error = assert_raises(Api::Error) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
        assert_equal "service_unavailable", error.code
        assert_equal 503, error.status
      end
      assert_equal RedeemReward::MAX_ATTEMPTS, attempts
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "user deleted after header validation is rejected without mutation" do
    @user.destroy!
    error = assert_raises(Api::Error) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
    assert_equal "user_not_found", error.code
    assert_equal 0, Redemption.count
  end

  test "unexpected database failures are not retried" do
    attempts = 0
    ApplicationRecord.stub(:transaction, ->(*) { attempts += 1; raise ActiveRecord::StatementInvalid, "private SQL" }) do
      assert_raises(ActiveRecord::StatementInvalid) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
    end
    assert_equal 1, attempts
  end
end
