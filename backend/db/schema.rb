# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_10_04_000007) do
  create_table "redemptions", force: :cascade do |t|
    t.integer "user_id", null: false
    t.integer "reward_id", null: false
    t.string "reward_name", null: false
    t.integer "points_spent", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "idempotency_key"
    t.integer "points_balance_after"
    t.index ["reward_id"], name: "index_redemptions_on_reward_id"
    t.index ["user_id", "created_at"], name: "index_redemptions_on_user_id_and_created_at"
    t.index ["user_id", "idempotency_key"], name: "index_redemptions_on_user_id_and_idempotency_key", unique: true
    t.check_constraint "(idempotency_key IS NULL AND points_balance_after IS NULL) OR (idempotency_key IS NOT NULL AND points_balance_after IS NOT NULL AND typeof(points_balance_after) = 'integer' AND points_balance_after >= 0)", name: "redemptions_idempotency_result"
    t.check_constraint "idempotency_key IS NULL OR (length(idempotency_key) = 36 AND substr(idempotency_key, 9, 1) = '-' AND substr(idempotency_key, 14, 1) = '-' AND substr(idempotency_key, 19, 1) = '-' AND substr(idempotency_key, 24, 1) = '-' AND length(replace(idempotency_key, '-', '')) = 32 AND replace(idempotency_key, '-', '') NOT GLOB '*[^0-9a-f]*' AND substr(idempotency_key, 15, 1) = '4' AND substr(idempotency_key, 20, 1) IN ('8', '9', 'a', 'b'))", name: "redemptions_uuid_key"
    t.check_constraint "points_spent > 0", name: "redemptions_positive_spend"
    t.check_constraint "typeof(points_spent) = 'integer'", name: "redemptions_integer_spend"
  end

  create_table "rewards", force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.integer "points_cost", null: false
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.check_constraint "active IN (0, 1)", name: "rewards_boolean_active"
    t.check_constraint "points_cost > 0", name: "rewards_positive_cost"
    t.check_constraint "typeof(points_cost) = 'integer'", name: "rewards_integer_cost"
  end

  create_table "users", force: :cascade do |t|
    t.string "name", null: false
    t.integer "points_balance", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.check_constraint "points_balance >= 0", name: "users_nonnegative_points"
    t.check_constraint "typeof(points_balance) = 'integer'", name: "users_integer_points"
  end

  add_foreign_key "redemptions", "rewards"
  add_foreign_key "redemptions", "users"
end
