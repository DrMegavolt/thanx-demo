require_relative "boot"
require "rails"
require_relative "../lib/api_request_body"
require "active_model/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "rails/test_unit/railtie"
Bundler.require(*Rails.groups)

module ThanxRewards
  class Application < Rails::Application
    config.load_defaults 8.0
    config.api_only = true
    config.middleware.use ApiRequestBody
    config.autoload_lib(ignore: %w[assets tasks])
  end
end
