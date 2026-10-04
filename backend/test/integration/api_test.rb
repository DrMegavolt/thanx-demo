require "test_helper"

class ApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = create_user(balance: 500)
    @other_user = create_user(balance: 100)
    @reward = create_reward
    @headers = { "x-user" => @user.id.to_s, "Content-Type" => "application/json" }
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

  test "all endpoints enforce identity before malformed bodies and media types" do
    [[:get, "/api/balance"], [:get, "/api/rewards"], [:get, "/api/redemptions"], [:post, "/api/redemptions"]].each do |method, path|
      [nil, "", " "].each do |value|
        public_send(method, path, params: "{", headers: { "x-user" => value, "Content-Type" => "application/json" })
        assert_error 400, "missing_user_header"
      end
      ["0", "01", "-1", "+1", "1.0", "1,2", "1 2", " 1", "1 ", "abc", "1\n", "１"].each do |value|
        public_send(method, path, headers: { "x-user" => value })
        assert_error 400, "invalid_user_header"
      end
      ["999999", "9" * 100].each do |value|
        public_send(method, path, params: "{", headers: { "x-user" => value, "Content-Type" => "application/json" })
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

  test "POST rejects unsupported content types before parsing JSON" do
    [nil, "text/plain", "application/x-www-form-urlencoded", "application/vnd.test+json"].each do |type|
      post "/api/redemptions", params: "{", headers: { "x-user" => @user.id.to_s, "CONTENT_TYPE" => type }
      assert_error 415, "unsupported_media_type"
    end
  end

  test "POST rejects empty and malformed JSON" do
    ["", " ", "{", '{"reward_id":}', '{"reward_id": NaN}'].each do |body|
      post "/api/redemptions", params: body, headers: @headers
      assert_error 400, "invalid_json"
    end
  end

  test "POST requires an object and exactly one positive JSON integer field" do
    ['[]', '[1]', 'null', 'true', '1', '"one"'].each do |body|
      post "/api/redemptions", params: body, headers: @headers
      assert_error 422, "invalid_request", { "fields" => { "body" => ["must be a JSON object"] } }
    end
    [nil, "1", 0, -1, 1.5, 1.0, true, false].each do |value|
      post "/api/redemptions", params: { reward_id: value }.to_json, headers: @headers
      assert_error 422, "invalid_request", { "fields" => { "reward_id" => ["must be a positive integer"] } }
    end
    post "/api/redemptions", params: '{}', headers: @headers
    assert_error 422, "invalid_request", { "fields" => { "reward_id" => ["must be a positive integer"] } }
    %w[user_id points_balance points_cost reward_name points_spent].each do |field|
      post "/api/redemptions", params: { reward_id: @reward.id, field => 1 }.to_json, headers: @headers
      assert_error 422, "invalid_request", { "fields" => { field => ["is not allowed"] } }
    end
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
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

  test "route and method errors precede identity and JSON validation" do
    ["/api", "/api/nope", "/api/users/1/balance", "/api/users/1/redemptions"].each do |path|
      post path, params: "{", headers: { "Content-Type" => "application/json" }
      assert_error 404, "endpoint_not_found"
    end
    { "/api/balance" => "GET, HEAD", "/api/rewards" => "GET, HEAD", "/api/redemptions" => "GET, HEAD, POST" }.each do |path, allow|
      %i[put patch delete options].each do |method|
        public_send(method, path, params: "{", headers: { "Content-Type" => "application/json" })
        assert_error 405, "method_not_allowed"
        assert_equal allow, response.headers["Allow"]
      end
    end
    post "/api/rewards", params: "{", headers: @headers
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

  test "exhausted database retries map to sanitized 503" do
    error = Api::Error.new("service_unavailable", "Database is busy.", status: 503)
    RedeemReward.stub(:call, ->(**) { raise error }) do
      post "/api/redemptions", params: { reward_id: @reward.id }.to_json, headers: @headers
    end
    assert_error 503, "service_unavailable"
    assert_equal 500, @user.reload.points_balance
    assert_equal 0, Redemption.count
  end
end
