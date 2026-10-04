class EnforceIntegerPoints < ActiveRecord::Migration[8.0]
  def change
    # SQLite INTEGER affinity alone still permits fractional REAL values.
    add_check_constraint :users, "typeof(points_balance) = 'integer'", name: "users_integer_points"
    add_check_constraint :rewards, "typeof(points_cost) = 'integer'", name: "rewards_integer_cost"
    add_check_constraint :redemptions, "typeof(points_spent) = 'integer'", name: "redemptions_integer_spend"
  end
end
