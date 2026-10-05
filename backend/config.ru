require_relative "config/environment"
Rails.application.load_server
# Rails 8 loads development routes lazily. Finish before request threads can
# observe a partially populated route table on their first simultaneous calls.
Rails.application.reload_routes_unless_loaded
run Rails.application
