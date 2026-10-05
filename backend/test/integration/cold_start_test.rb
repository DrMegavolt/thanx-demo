require "test_helper"
require "open3"
require "rbconfig"

class ColdStartTest < ActiveSupport::TestCase
  test "server entry point loads routes before concurrent first requests" do
    10.times do |attempt|
      output, status = Open3.capture2e(
        { "RAILS_ENV" => "test", "CI" => nil }, RbConfig.ruby,
        Rails.root.join("test/support/cold_start_probe.rb").to_s,
        chdir: Rails.root.to_s
      )
      assert status.success?, "Cold start #{attempt + 1} failed: #{output}"
      assert_includes output, "Cold-start routes ready"
    end
  end
end
