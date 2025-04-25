##
# This file mounts each app in the Padrino project to a specified sub-uri.
# You can mount additional applications using any of these commands below:
#
#   Padrino.mount("blog").to('/blog')
#   Padrino.mount("blog", :app_class => "BlogApp").to('/blog')
#   Padrino.mount("blog", :app_file =>  "path/to/blog/app.rb").to('/blog')
#
Padrino.mount("Clock").to("/")

Padrino.configure_apps do
  set :session_secret, "alvarez-high-school-clock-system"
  set :protection, :except => :path_traversal
  set :protect_from_csrf, true
  set :school_name, "Alvarez High School"
end

Padrino.mount('Clock::API', :app_file => Padrino.root('api/app.rb')).to('/api')
Padrino.mount('Clock::Web', :app_file => Padrino.root('app/app.rb')).to('/')
