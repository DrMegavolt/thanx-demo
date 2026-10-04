module Api
  class ErrorsController < BaseController
    skip_before_action :select_user

    METHODS = {
      "/api/balance" => "GET, HEAD",
      "/api/rewards" => "GET, HEAD",
      "/api/redemptions" => "GET, HEAD, POST"
    }.freeze

    def show
      allowed = METHODS[request.path.delete_suffix("/")]
      if allowed
        response.set_header("Allow", allowed)
        raise Api::Error.new("method_not_allowed", "This method is not supported.", status: 405)
      end
      raise Api::Error.new("endpoint_not_found", "API endpoint not found.", status: 404)
    end
  end
end
