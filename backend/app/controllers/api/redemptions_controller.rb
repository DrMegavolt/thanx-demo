module Api
  class RedemptionsController < BaseController
    def index
      render json: current_user.redemptions.order(created_at: :desc, id: :desc).map { |record| serialize(record) }
    end

    def create
      unless request.media_type == "application/json"
        raise Api::Error.new("unsupported_media_type", "Content-Type must be application/json.", status: 415)
      end
      begin
        body = JSON.parse(request.raw_post)
      rescue JSON::ParserError, EncodingError
        raise Api::Error.new("invalid_json", "The body must contain valid JSON.", status: 400)
      end
      fields = {}
      if body.is_a?(Hash)
        unless body["reward_id"].is_a?(Integer) && body["reward_id"].positive?
          fields["reward_id"] = ["must be a positive integer"]
        end
        (body.keys - ["reward_id"]).each { |key| fields[key] = ["is not allowed"] }
      else
        fields["body"] = ["must be a JSON object"]
      end
      unless fields.empty?
        raise Api::Error.new("invalid_request", "Invalid redemption request.", status: 422, details: { fields: fields })
      end
      key = request.headers["Idempotency-Key"]
      if key.blank?
        raise Api::Error.new("missing_idempotency_key", "The Idempotency-Key header is required.", status: 400)
      end
      unless Redemption::UUID_V4.match?(key.downcase)
        raise Api::Error.new("invalid_idempotency_key", "Idempotency-Key must be a UUID v4.", status: 400)
      end
      result = RedeemReward.call(user_id: current_user.id, reward_id: body.fetch("reward_id"), idempotency_key: key.downcase)
      render json: { redemption: serialize(result.redemption), points_balance: result.points_balance }, status: :created
    end

    private

    def serialize(record)
      record.as_json(only: %i[id reward_id reward_name points_spent]).merge("created_at" => record.created_at.utc.iso8601(3))
    end
  end
end
