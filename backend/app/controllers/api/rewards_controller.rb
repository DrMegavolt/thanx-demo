module Api
  class RewardsController < BaseController
    def index
      render json: Reward.where(active: true).order(:points_cost, :id).as_json(
        only: %i[id name description points_cost]
      )
    end
  end
end
