Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  namespace :api do
    get "balance", to: "users#balance"
    resources :rewards, only: :index
    resources :redemptions, only: %i[index create]
    match "*path", to: "errors#show", via: :all, format: false
    match "/", to: "errors#show", via: :all
  end
end
