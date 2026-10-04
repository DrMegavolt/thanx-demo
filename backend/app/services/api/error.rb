module Api
  class Error < StandardError
    attr_reader :code, :status, :details

    def initialize(code, message, status:, details: {})
      super(message)
      @code, @status, @details = code, status, details
    end
  end
end
