require "test_helper"

class ApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = create_user(balance: 500)
    @other_user = create_user(balance: 100)
    @reward = create_reward
    @headers = { "x-user" => @user.id.to_s, "Content-Type" => "application/json", "Idempotency-Key" => SecureRandom.uuid }
  end

  def assert_error(status, code, details = {})
    assert_response status
    assert_equal "application/json", response.media_type
    assert_equal %w[error], response.parsed_body.keys
    error = response.parsed_body.fetch("error")
    assert_equal %w[code details message], error.keys.sort
    assert_equal code, error["code"]
    assert_kind_of String, error["message"]
    assert_equal details, error["details"]
  end

  test "all endpoints require an existing demo identity" do
    [[:get, "/api/balance"], [:get, "/api/rewards"], [:get, "/api/redemptions"], [:post, "/api/redemptions"]].each do |method, path|
      [nil, "", " "].each do |value|
        public_send(method, path, headers: { "x-user" => value })
        assert_error 400, "missing_user_header"
      end
      ["0", "01", "-1", "+1", "1.0", "1,2", "1 2", " 1", "1 ", "abc", "1\n", "１"].each do |value|
        public_send(method, path, headers: { "x-user" => value })
        assert_error 400, "invalid_user_header"
      end
      ["999999", "9" * 100].each do |value|
        public_send(method, path, headers: { "x-user" => value })
        assert_error 404, "user_not_found"
      end
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "balance uses header identity and integer JSON fields" do
    get "/api/balance", headers: { "X-User" => @other_user.id.to_s }
    assert_response :ok
    assert_equal({ "user_id" => @other_user.id, "name" => "Alex", "points_balance" => 100 }, response.parsed_body)
  end

  test "rewards include only active rewards sorted by cost then id regardless of affordability" do
    expensive = create_reward(cost: 2000)
    tied = create_reward
    cheap = create_reward(cost: 100)
    create_reward(active: false, cost: 1)
    get "/api/rewards", headers: @headers
    assert_response :ok
    assert_equal [cheap.id, @reward.id, tied.id, expensive.id], response.parsed_body.map { |r| r["id"] }
    response.parsed_body.each do |entry|
      assert_equal %w[description id name points_cost], entry.keys.sort
      assert_nil entry["description"]
    end
    Reward.update_all(active: false)
    get "/api/rewards", headers: @headers
    assert_equal [], response.parsed_body
  end

  test "POST rejects unsupported content types" do
    [nil, "text/plain", "application/x-www-form-urlencoded", "application/vnd.test+json"].each do |type|
      post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: { "x-user" => @user.id.to_s, "CONTENT_TYPE" => type }
      assert_error 415, "unsupported_media_type"
    end
  end

  test "POST rejects malformed JSON using the API error envelope" do
    [" ", "{", '{"reward_id":}', '{"reward_id": NaN}'].each do |body|
      post "/api/redemptions", params: body, headers: @headers
      assert_error 400, "invalid_json"
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "POST looks up reward IDs rather than validating positivity or body shape" do
    ["", "{}", "[]", "null", '{"reward_id": null}', '{"reward_id": 0}',
      '{"reward_id": -1}', '{"reward_id": "missing"}', '{"reward_id": []}',
      '{"reward_id": {"id": 1}}'].each do |body|
      post "/api/redemptions", params: body, headers: @headers
      assert_error 404, "reward_not_found"
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "POST ignores extra fields and numeric string IDs replay the same redemption" do
    post "/api/redemptions", params: {
      reward_id: @reward.id.to_s, user_id: @other_user.id, points_balance: 99999,
      points_cost: 1, reward_name: "Forged", points_spent: 1
    }.to_json, headers: @headers
    assert_response :created
    original = response.parsed_body
    assert_equal @reward.id, original.dig("redemption", "reward_id")
    assert_equal "Coffee", original.dig("redemption", "reward_name")
    assert_equal 250, original.dig("redemption", "points_spent")
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    assert_response :created
    assert_equal original, response.parsed_body
    assert_equal 250, @user.reload.points_balance
    assert_equal 100, @other_user.reload.points_balance
    assert_equal 1, Redemption.count
  end

  test "POST uses database state and returns precise errors without mutation" do
    post "/api/redemptions", params: { reward_id: 999999 }.to_json, headers: @headers
    assert_error 404, "reward_not_found"
    @reward.update!(active: false)
    @user.update!(points_balance: 100)
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    assert_error 422, "reward_inactive", { "reward_id" => @reward.id }
    @reward.update!(active: true)
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    assert_error 422, "insufficient_points", { "points_balance" => 100, "points_required" => 250 }
    assert_equal 100, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "successful POST returns committed state and historical UTC snapshots" do
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json,
      headers: @headers.merge("Content-Type" => "application/json; charset=utf-8")
    assert_response :created
    body = response.parsed_body
    assert_equal %w[points_balance redemption], body.keys.sort
    assert_equal 250, body["points_balance"]
    assert_equal 250, @user.reload.points_balance
    entry = body.fetch("redemption")
    assert_equal %w[created_at id points_spent reward_id reward_name], entry.keys.sort
    assert_equal @reward.id, entry["reward_id"]
    assert_equal "Coffee", entry["reward_name"]
    assert_equal 250, entry["points_spent"]
    assert_match /\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\z/, entry["created_at"]
    @reward.update!(name: "Tea", points_cost: 500, active: false)
    get "/api/redemptions", headers: @headers
    assert_equal [entry], response.parsed_body
    assert_equal 100, @other_user.reload.points_balance
  end

  test "POST requires a single UUID v4 key" do
    [nil, "", " "].each do |key|
      post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers.merge("Idempotency-Key" => key)
      assert_error 400, "missing_idempotency_key"
    end
    ["not-a-uuid", SecureRandom.uuid + " ", "00000000-0000-1000-8000-000000000000", "a,b"].each do |key|
      post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers.merge("Idempotency-Key" => key)
      assert_error 400, "invalid_idempotency_key"
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "retry replays original success even after another charge and reward deactivation" do
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    original = response.parsed_body
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json,
      headers: @headers.merge("Idempotency-Key" => SecureRandom.uuid)
    assert_response :created
    @reward.update!(active: false, name: "Tea", points_cost: 900)
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json,
      headers: @headers.merge("Idempotency-Key" => @headers["Idempotency-Key"].upcase)
    assert_response :created
    assert_equal original, response.parsed_body
    assert_equal 0, @user.reload.points_balance
    assert_equal 2, Redemption.count
  end

  test "key reuse with another reward conflicts but another user has an independent key scope" do
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    other_reward = create_reward(cost: 50)
    post "/api/redemptions", params: { reward_id: other_reward.id }.to_json, headers: @headers
    assert_error 409, "idempotency_conflict"
    assert_equal 250, @user.reload.points_balance
    post "/api/redemptions", params: { reward_id: other_reward.id }.to_json,
      headers: @headers.merge("x-user" => @other_user.id.to_s)
    assert_response :created
    assert_equal 50, @other_user.reload.points_balance
    assert_equal 2, Redemption.count
  end

  test "failed redemption does not consume its key" do
    @reward.update!(active: false)
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    assert_error 422, "reward_inactive", { "reward_id" => @reward.id }
    @reward.update!(active: true)
    post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    assert_response :created
    assert_equal 250, @user.reload.points_balance
    assert_equal 1, Redemption.count
  end

  test "history is scoped to identity and ordered by time then id descending" do
    time = Time.utc(2026, 10, 4, 12)
    entries = [time, time, time + 60].map do |created_at|
      Redemption.create!(user: @user, reward: @reward, reward_name: "Coffee", points_spent: 250, created_at: created_at)
    end
    Redemption.create!(user: @other_user, reward: @reward, reward_name: "Private", points_spent: 250)
    get "/api/redemptions", headers: @headers
    assert_equal entries.reverse.map(&:id), response.parsed_body.map { |r| r["id"] }
    get "/api/redemptions", headers: { "x-user" => create_user.id.to_s }
    assert_response :ok
    assert_equal [], response.parsed_body
  end

  test "unknown routes and unsupported methods return API errors" do
    ["/api", "/api/nope", "/api/users/1/balance", "/api/users/1/redemptions"].each do |path|
      post path, headers: { "Content-Type" => "application/json" }
      assert_error 404, "endpoint_not_found"
    end
    { "/api/balance" => "GET, HEAD", "/api/rewards" => "GET, HEAD", "/api/redemptions" => "GET, HEAD, POST" }.each do |path, allow|
      %i[put patch delete options].each do |method|
        public_send(method, path, headers: { "Content-Type" => "application/json" })
        assert_error 405, "method_not_allowed"
        assert_equal allow, response.headers["Allow"]
      end
    end
    post "/api/rewards", headers: @headers
    assert_error 405, "method_not_allowed"
  end

  test "health needs no identity and HEAD follows GET" do
    get "/up"
    assert_response :ok
    assert_equal "text/html", response.media_type
    head "/api/balance", headers: @headers
    assert_response :ok
    assert_empty response.body
  end

  test "unexpected persistence failure returns sanitized 500 and rolls back" do
    with_history_failure(RuntimeError.new("secret SQL and stack trace")) do
      post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    end
    assert_error 500, "internal_error"
    assert_not_includes response.body, "secret"
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end

  test "database contention maps to sanitized 503" do
    error = Api::Error.new("service_unavailable", "Database is busy.", status: 503)
    RedeemReward.stub(:call, ->(**) { raise error }) do
      post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    end
    assert_error 503, "service_unavailable"
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end
end
