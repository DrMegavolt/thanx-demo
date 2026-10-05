module Api
  class RedemptionsController < BaseController
    def index
      render json: current_user.redemptions.order(created_at: :desc, id: :desc).map { |record| serialize(record) }
    end

    def create
      unless request.media_type == "application/json"
        raise Api::Error.new("unsupported_media_type", "Content-Type must be application/json.", status: 415)
      end
      # Body parameters only: query strings must never select the purchase.
      reward_id = request.request_parameters["reward_id"]
      unless (reward_id.is_a?(Integer) && reward_id.positive?) ||
          (reward_id.is_a?(String) && /\A[1-9][0-9]*\z/.match?(reward_id))
        raise Api::Error.new("invalid_request", "reward_id must be a positive decimal integer in the JSON body.", status: 422)
      end
      reward_id = reward_id.to_i
      key = request.headers["Idempotency-Key"]
      if key.blank?
        raise Api::Error.new("missing_idempotency_key", "The Idempotency-Key header is required.", status: 400)
      end
      unless Redemption::UUID_V4.match?(key.downcase)
        raise Api::Error.new("invalid_idempotency_key", "Idempotency-Key must be a UUID v4.", status: 400)
      end
      result = RedeemReward.call(user_id: current_user.id, reward_id: reward_id, idempotency_key: key.downcase)
      render json: { redemption: serialize(result.redemption), points_balance: result.points_balance }, status: :created
    end

    private

    def serialize(record)
      record.as_json(only: %i[id reward_id reward_name points_spent]).merge("created_at" => record.created_at.utc.iso8601(3))
    end
  end
end
