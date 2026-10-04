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
