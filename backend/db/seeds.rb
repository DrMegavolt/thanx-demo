User.find_or_create_by!(name: "Alex Morgan") do |user|
  user.points_balance = 1250
end

[
  { name: "Free coffee", description: "A freshly brewed coffee, on us.", points_cost: 250 },
  { name: "$5 off your order", description: "Save on your next visit.", points_cost: 500 },
  { name: "Free lunch", description: "Treat yourself to a lunch favorite.", points_cost: 1500 }
].each do |attributes|
  Reward.find_or_create_by!(name: attributes[:name]) do |reward|
    reward.assign_attributes(attributes)
  end
end

# Seed Ruby's history through the same atomic debit/snapshot path as the API.
# Only populate it when creating the user so reruns preserve subsequent activity.
ApplicationRecord.transaction do
  unless User.exists?(id: 2)
    User.create!(id: 2, name: "Ruby Jones", points_balance: 2000)
    ["Free coffee", "$5 off your order"].each do |name|
      RedeemReward.call(user_id: 2, reward_id: Reward.find_by!(name: name).id, idempotency_key: SecureRandom.uuid)
    end
  end

  User.find_or_create_by!(id: 3) do |user|
    user.name = "Casey Taylor"
    user.points_balance = 0
  end
end
