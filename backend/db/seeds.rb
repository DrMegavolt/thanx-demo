User.find_or_create_by!(name: "Alex Morgan") do |user|
  user.points_balance = 1250
end

# Stable IDs match frontend/public/reward_{id}.png. Refresh the demo catalog
# on reruns; redemption snapshots preserve the original name and points spent.
[
  { id: 1, name: "Free coffee", description: "Any size drip coffee, on us. A fresh cup to brighten your day.", points_cost: 250 },
  { id: 2, name: "$10 off your order", description: "$10 off your next order. Good on anything you love.", points_cost: 1000 },
  { id: 3, name: "Lunch for two", description: "Two entrées, on us. A little good food goes a long way.", points_cost: 1500 },
  { id: 4, name: "Fresh pastry", description: "Choose any pastry from our bakery case, fresh daily.", points_cost: 400 },
  { id: 5, name: "Free sandwich", description: "Any sandwich from our menu. Made fresh, always.", points_cost: 750 },
  { id: 6, name: "$20 off your order", description: "$20 off your next order. Treat yourself to something special.", points_cost: 2000 }
].each do |attributes|
  reward = Reward.find_or_initialize_by(id: attributes[:id])
  reward.assign_attributes(attributes.except(:id))
  reward.save!
end

# Seed Ruby's history through the same atomic debit/snapshot path as the API.
# Only populate it when creating the user so reruns preserve subsequent activity.
ApplicationRecord.transaction do
  unless User.exists?(id: 2)
    User.create!(id: 2, name: "Ruby Jones", points_balance: 2500)
    [1, 2].each do |reward_id|
      RedeemReward.call(user_id: 2, reward_id: reward_id, idempotency_key: SecureRandom.uuid)
    end
  end

  User.find_or_create_by!(id: 3) do |user|
    user.name = "Casey Taylor"
    user.points_balance = 0
  end
end
