require_relative "support/coverage" if ENV["COVERAGE"] == "1"
ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"
require "minitest/mock"

module TestRecords
  def with_history_failure(error, timing: :before)
    callback = ->(_record) { raise error }
    Redemption.set_callback(:create, timing, callback)
    yield
  ensure
    Redemption.skip_callback(:create, timing, callback)
  end

  def create_user(balance: 1000, name: "Alex")
    User.create!(name: name, points_balance: balance)
  end

  def create_reward(cost: 250, active: true, name: "Coffee")
    Reward.create!(name: name, points_cost: cost, active: active)
  end
end

class ActiveSupport::TestCase
  include TestRecords
end
