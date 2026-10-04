require "test_helper"

class InvariantsTest < ActiveSupport::TestCase
  test "balances are nonnegative integers and user names are required" do
    assert User.new(name: "Alex", points_balance: 0).valid?
    [-1, 1.5, nil].each { |value| assert_not User.new(name: "Alex", points_balance: value).valid? }
    assert_not User.new(points_balance: 0).valid?
  end

  test "costs and snapshot spend are positive integers" do
    [0, -1, 1.5, nil].each do |value|
      assert_not Reward.new(name: "Coffee", points_cost: value).valid?
      assert_not Redemption.new(user: create_user, reward: create_reward, reward_name: "Coffee", points_spent: value).valid?
    end
    assert_not Reward.new(points_cost: 250).valid?
    assert_not Redemption.new(points_spent: 250).valid?
  end

  test "database rejects invalid balances costs and spends when validations are bypassed" do
    user = create_user
    reward = create_reward
    redemption = Redemption.create!(user: user, reward: reward, reward_name: reward.name, points_spent: reward.points_cost)
    [[user, :points_balance, -1], [reward, :points_cost, 0], [redemption, :points_spent, 0],
      [user, :points_balance, nil], [reward, :points_cost, nil], [redemption, :reward_name, nil]].each do |record, field, value|
      assert_raises(ActiveRecord::StatementInvalid) { record.update_column(field, value) }
    end
  end

  test "SQLite constraints reject fractional points even in raw SQL" do
    user = create_user
    reward = create_reward
    redemption = Redemption.create!(user: user, reward: reward, reward_name: reward.name, points_spent: reward.points_cost)
    [[user, "points_balance"], [reward, "points_cost"], [redemption, "points_spent"]].each do |record, field|
      assert_raises(ActiveRecord::StatementInvalid) do
        ApplicationRecord.connection.execute("UPDATE #{record.class.table_name} SET #{field} = 1.5 WHERE id = #{record.id}")
      end
    end
  end

  test "history requires existing user and reward and prevents their deletion" do
    user = create_user
    reward = create_reward
    redemption = Redemption.create!(user: user, reward: reward, reward_name: reward.name, points_spent: reward.points_cost)
    assert_not user.destroy
    assert_not reward.destroy
    assert_raises(ActiveRecord::InvalidForeignKey) { redemption.update_column(:user_id, user.id + 1000) }
    assert_raises(ActiveRecord::InvalidForeignKey) { redemption.update_column(:reward_id, reward.id + 1000) }
  end
end
