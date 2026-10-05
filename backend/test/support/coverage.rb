# Ruby's built-in line coverage keeps the test setup dependency-free.
require "coverage"
Coverage.start(lines: true)

at_exit do
  require "json"
  require "fileutils"
  root = File.expand_path("../..", __dir__)
  results = Coverage.result
  files = Dir["#{root}/app/**/*.rb"].sort.to_h do |path|
    lines = results.fetch(path, {}).fetch(:lines, [])
    counts = lines.compact
    [path.delete_prefix("#{root}/"), {
      covered: counts.count(&:positive?), total: counts.length,
      missed_lines: lines.each_index.select { |index| lines[index] == 0 }.map { |index| index + 1 }
    }]
  end
  covered = files.values.sum { |entry| entry[:covered] }
  total = files.values.sum { |entry| entry[:total] }
  percent = total.zero? ? 0.0 : 100.0 * covered / total
  report = { line_coverage_percent: percent.round(2), covered: covered, total: total, files: files }
  directory = "#{root}/coverage"
  FileUtils.mkdir_p(directory)
  File.write("#{directory}/coverage.json", JSON.pretty_generate(report))
  puts "Backend line coverage: #{report[:line_coverage_percent]}% (#{covered}/#{total})"
  exit 1 if percent < 95 || files.values.any? { |entry| entry[:total].zero? }
end
