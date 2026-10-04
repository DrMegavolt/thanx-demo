class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :name, null: false
      t.integer :points_balance, null: false, default: 0
      t.timestamps
    end
    add_check_constraint :users, "points_balance >= 0", name: "users_nonnegative_points"
  end
end
