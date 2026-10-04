class CreateRewards < ActiveRecord::Migration[8.0]
  def change
    create_table :rewards do |t|
      t.string :name, null: false
      t.text :description
      t.integer :points_cost, null: false
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_check_constraint :rewards, "points_cost > 0", name: "rewards_positive_cost"
  end
end
