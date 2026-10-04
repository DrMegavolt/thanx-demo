class CreateRedemptions < ActiveRecord::Migration[8.0]
  def change
    create_table :redemptions do |t|
      t.references :user, null: false, foreign_key: true
      t.references :reward, null: false, foreign_key: true
      t.string :reward_name, null: false
      t.integer :points_spent, null: false
      t.timestamps
    end
    add_index :redemptions, [:user_id, :created_at]
    add_check_constraint :redemptions, "points_spent > 0", name: "redemptions_positive_spend"
  end
end
