class AddRedemptionIdempotency < ActiveRecord::Migration[8.0]
  def change
    # Existing history predates idempotency; its original balance is unknown.
    add_column :redemptions, :idempotency_key, :string
    add_column :redemptions, :points_balance_after, :integer
    add_index :redemptions, [:user_id, :idempotency_key], unique: true
    add_check_constraint :redemptions,
      "(idempotency_key IS NULL AND points_balance_after IS NULL) OR " \
      "(idempotency_key IS NOT NULL AND points_balance_after IS NOT NULL " \
      "AND typeof(points_balance_after) = 'integer' AND points_balance_after >= 0)",
      name: "redemptions_idempotency_result"
    add_check_constraint :redemptions,
      "idempotency_key IS NULL OR (length(idempotency_key) = 36 " \
      "AND substr(idempotency_key, 9, 1) = '-' AND substr(idempotency_key, 14, 1) = '-' " \
      "AND substr(idempotency_key, 19, 1) = '-' AND substr(idempotency_key, 24, 1) = '-' " \
      "AND length(replace(idempotency_key, '-', '')) = 32 " \
      "AND replace(idempotency_key, '-', '') NOT GLOB '*[^0-9a-f]*' " \
      "AND substr(idempotency_key, 15, 1) = '4' AND substr(idempotency_key, 20, 1) IN ('8', '9', 'a', 'b'))",
      name: "redemptions_uuid_key"
  end
end
