# TODO: this migration is a temporary solution to populate the reward catalog. In the future, we may want to move this data into a seed file or a separate data migration.
class PopulateRewardCatalog < ActiveRecord::Migration[8.0]
  # Keep the migration independent of future application model changes.
  class CatalogReward < ActiveRecord::Base
    self.table_name = "rewards"
  end

  def up
    now = Time.current
    # IDs match the individual frontend/public/reward_{id}.png assets.
    rewards = [
      { id: 1, name: "Free coffee", description: "Any size drip coffee, on us. A fresh cup to brighten your day.", points_cost: 250 },
      { id: 2, name: "$10 off your order", description: "$10 off your next order. Good on anything you love.", points_cost: 1000 },
      { id: 3, name: "Lunch for two", description: "Two entrées, on us. A little good food goes a long way.", points_cost: 1500 },
      { id: 4, name: "Fresh pastry", description: "Choose any pastry from our bakery case, fresh daily.", points_cost: 400 },
      { id: 5, name: "Free sandwich", description: "Any sandwich from our menu. Made fresh, always.", points_cost: 750 },
      { id: 6, name: "$20 off your order", description: "$20 off your next order. Treat yourself to something special.", points_cost: 2000 }
    ]
    CatalogReward.upsert_all(
      rewards.map { |reward| reward.merge(active: true, created_at: now, updated_at: now) },
      unique_by: :id,
      update_only: [:name, :description, :points_cost, :updated_at]
    )
  end

  def down
    # These rewards may have been redeemed; keep their identities and history.
    raise ActiveRecord::IrreversibleMigration, "The shared reward catalog may have redemption history"
  end
end
