class TightenSchemaConstraints < ActiveRecord::Migration[8.0]
  def change
    remove_index :redemptions, :user_id
    add_check_constraint :rewards, "active IN (0, 1)", name: "rewards_boolean_active"
  end
end
