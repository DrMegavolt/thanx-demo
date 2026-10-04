module Api
  class UsersController < BaseController
    def balance
      render json: { user_id: current_user.id, name: current_user.name, points_balance: current_user.points_balance }
    end
  end
end
