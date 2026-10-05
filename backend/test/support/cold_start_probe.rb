# Run only in a fresh process, via cold_start_test.rb. Exercise the actual
# server entry point without warming routes or sending an earlier health check.
require "rack"
require "rack/mock"
require "timeout"
app = Rack::Builder.parse_file(File.expand_path("../../config.ru", __dir__))
abort "Routes must be loaded before serving requests" unless Rails.application.routes_reloader.loaded
gate = Queue.new
threads = ["/api/balance", "/api/rewards", "/api/redemptions", "/api/redemptions"].each_with_index.map do |path, index|
  Thread.new do
    gate.pop
    env = Rack::MockRequest.env_for(path, method: index == 3 ? "POST" : "GET")
    status, _headers, body = app.call(env)
    body.close if body.respond_to?(:close)
    status
  end
end
threads.length.times { gate << true }
statuses = Timeout.timeout(10) { threads.map(&:value) }
abort "Unexpected cold-start statuses: #{statuses.inspect}" unless statuses == [400, 400, 400, 400]
puts "Cold-start routes ready: #{statuses.inspect}"
