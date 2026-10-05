require "test_helper"
require "timeout"

# Real commits and independent SQLite connections are required here: Rails'
# transactional test wrapper would hide rows from the competing connections.
class RedemptionConcurrencyTest < ActionDispatch::IntegrationTest
  self.use_transactional_tests = false

  setup do
    # Local tests load Rails 8 routes lazily. Finish loading on the main thread
    # before competing requests can observe an incomplete route table.
    Rails.application.reload_routes_unless_loaded
    clean_records
    @user = create_user(balance: 500)
    @reward = create_reward(cost: 250)
  end

  teardown do
    clean_records
  end

  def clean_records
    Redemption.delete_all
    Reward.delete_all
    User.delete_all
  end

  def request_redemption(key = SecureRandom.uuid)
    session = ActionDispatch::Integration::Session.new(Rails.application)
    session.post "/api/redemptions", params: { reward_id: @reward.id }.to_json,
      headers: { "x-user" => @user.id.to_s, "Content-Type" => "application/json", "Idempotency-Key" => key }
    [session.response.status, session.response.parsed_body]
  end

  def join_threads(threads)
    Timeout.timeout(10) { threads.map(&:value) }
  ensure
    threads.each { |thread| thread.kill if thread.alive? }
    threads.each(&:join)
  end

  test "simultaneous HTTP redemptions cannot overspend and commit matching history" do
    gate = Queue.new
    threads = 4.times.map do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          gate.pop
          request_redemption
        end
      end
    end
    4.times { gate << true }
    responses = join_threads(threads)
    assert_equal [201, 201, 422, 422], responses.map(&:first).sort
    successes = responses.select { |status, _| status == 201 }.map(&:last)
    assert_equal [0, 250], successes.map { |body| body["points_balance"] }.sort
    responses.select { |status, _| status == 422 }.each do |_, body|
      assert_equal "insufficient_points", body.dig("error", "code")
    end
    assert_equal 0, @user.reload.points_balance
    assert_equal 2, Redemption.count
    assert_equal 500, Redemption.sum(:points_spent)
  end

  test "simultaneous duplicate HTTP requests charge once and replay the same result" do
    key = SecureRandom.uuid
    gate = Queue.new
    threads = 4.times.map do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          gate.pop
          request_redemption(key)
        end
      end
    end
    4.times { gate << true }
    responses = join_threads(threads)
    assert_equal [201, 201, 201, 201], responses.map(&:first)
    assert_equal 1, responses.map(&:last).uniq.size
    assert_equal 250, @user.reload.points_balance
    assert_equal 1, Redemption.count
  end

  test "reward edit holds database lock and redemption reads the committed new cost and name" do
    editor = SQLite3::Database.new(ActiveRecord::Base.connection_db_config.database)
    editor.execute("BEGIN IMMEDIATE")
    editor.execute("UPDATE rewards SET name = ?, points_cost = ? WHERE id = ?", ["Tea", 400, @reward.id])
    blocked = Queue.new
    thread = Thread.new do
      ActiveRecord::Base.connection_pool.with_connection do |connection|
        # Observe actual contention, rather than relying on timing sleeps.
        connection.raw_connection.busy_handler do |_count|
          blocked << true if blocked.empty?
          sleep 0.005
          true
        end
        begin
          request_redemption
        ensure
          connection.raw_connection.busy_handler_timeout = 5000
        end
      end
    end
    Timeout.timeout(5) { blocked.pop }
    editor.execute("COMMIT")
    status, body = join_threads([thread]).first
    assert_equal 201, status
    assert_equal 100, body["points_balance"]
    assert_equal "Tea", body.dig("redemption", "reward_name")
    assert_equal 400, body.dig("redemption", "points_spent")
    assert_equal 100, @user.reload.points_balance
  ensure
    thread&.kill if thread&.alive?
    thread&.join
    editor&.close
  end

  test "transaction ignores a balance cached before another connection changed it" do
    editor = SQLite3::Database.new(ActiveRecord::Base.connection_db_config.database)
    ApplicationRecord.cache do
      assert_equal 500, User.find_by(id: @user.id).points_balance
      editor.execute("UPDATE users SET points_balance = 100 WHERE id = ?", [@user.id])
      # A request can resolve identity before another request's debit commits.
      assert_equal 500, User.find_by(id: @user.id).points_balance
      error = assert_raises(Api::Error) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
      assert_equal "insufficient_points", error.code
      assert_equal({ points_balance: 100, points_required: 250 }, error.details)
    end
    assert_equal 100, @user.reload.points_balance
    assert_equal 0, Redemption.count
  ensure
    editor&.close
  end

  test "transaction ignores reward availability cached before an external edit" do
    editor = SQLite3::Database.new(ActiveRecord::Base.connection_db_config.database)
    ApplicationRecord.cache do
      assert Reward.find_by(id: @reward.id).active?
      editor.execute("UPDATE rewards SET active = 0 WHERE id = ?", [@reward.id])
      error = assert_raises(Api::Error) { RedeemReward.call(user_id: @user.id, reward_id: @reward.id, idempotency_key: SecureRandom.uuid) }
      assert_equal "reward_inactive", error.code
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  ensure
    editor&.close
  end

  test "real persistent lock contention returns 503 with no debit or history" do
    editor = SQLite3::Database.new(ActiveRecord::Base.connection_db_config.database)
    editor.execute("BEGIN IMMEDIATE")
    ActiveRecord::Base.connection_pool.with_connection do |connection|
      connection.raw_connection.busy_handler_timeout = 1
      begin
        status, body = request_redemption
        assert_equal 503, status
        assert_equal "service_unavailable", body.dig("error", "code")
        assert_equal({}, body.dig("error", "details"))
      ensure
        connection.raw_connection.busy_handler_timeout = 5000
      end
    end
    editor.execute("ROLLBACK")
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  ensure
    editor&.close
  end
end
