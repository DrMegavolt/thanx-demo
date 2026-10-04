# Preserve validation order and strict JSON types. Rails' automatic parameter
# parsing runs before controller callbacks, rejects non-object JSON, and can
# raise on malformed JSON before x-user has been checked. The API controller
# parses raw_post itself after identity and media-type validation.
class ApiRequestBody
  def initialize(app)
    @app = app
  end

  def call(env)
    if env["PATH_INFO"] == "/api" || env["PATH_INFO"].start_with?("/api/")
      env["action_dispatch.request.request_parameters"] = {}
    end
    @app.call(env)
  end
end
