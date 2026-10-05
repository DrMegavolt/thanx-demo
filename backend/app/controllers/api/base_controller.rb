module Api
  class BaseController < ApplicationController
    before_action :select_user

    rescue_from StandardError, with: :internal_error
    rescue_from Api::Error, with: :render_api_error
    rescue_from ActionDispatch::Http::Parameters::ParseError, with: :invalid_json

    private

    attr_reader :current_user

    def select_user
      value = request.headers["x-user"]
      if value.blank?
        raise Api::Error.new("missing_user_header", "The x-user header is required.", status: 400)
      end
      unless /\A[1-9][0-9]*\z/.match?(value)
        raise Api::Error.new("invalid_user_header", "The x-user header must be a positive decimal integer.", status: 400)
      end
      @current_user = User.find_by(id: value.to_i)
      unless @current_user
        raise Api::Error.new("user_not_found", "User not found.", status: 404)
      end
    end

    def render_api_error(error)
      render json: { error: { code: error.code, message: error.message, details: error.details } }, status: error.status
    end

    def invalid_json(_error)
      render_api_error(Api::Error.new("invalid_json", "The body must contain valid JSON.", status: 400))
    end

    def internal_error(error)
      Rails.logger.error do
        details = Rails.env.development? ? error.full_message(highlight: false) : error.class.to_s
        "API failure: #{details}"
      end
      render_api_error(Api::Error.new("internal_error", "An unexpected server error occurred.", status: 500))
    end
  end
end
