# Dr. Jorge Alvarez High School Digital Clock

A real-time digital clock and schedule display system designed specifically for Dr. Jorge Alvarez High School. This application provides a modern, web-based solution for displaying current time, period information, weather updates, and school announcements.

## 🚀 Quick Start - Try it Now!

1. Download the code:
   ```bash
   git clone https://github.com/Marooncoloredchair/ALVclock.git
   cd ALVclock
   ```

2. Install Node.js:
   - Download and install from [nodejs.org](https://nodejs.org/)
   - Recommended version: 14.x or higher

3. Install dependencies and start:
   ```bash
   npm install
   npm start
   ```

4. Open in your browser:
   - Main Display: [http://localhost:3000](http://localhost:3000)
   - Admin Panel: [http://localhost:3000/admin](http://localhost:3000/admin)
   - Default admin login: username: `admin`, password: `alvarez2024`

## 🎥 Live Demo Video

Check out our [demo video](https://youtu.be/your-demo-video) to see the clock in action! (Coming soon)

## ✨ Features

- 🕒 Real-time digital clock display
- 📅 Dynamic schedule management (Regular, Extended, and Early Release schedules)
- 🌤️ Live weather updates
- 📢 Emergency announcement system
- 📝 Schedule override capabilities
- 🔔 Period change notifications
- 📱 Responsive design for all screen sizes

## 👨‍💼 Admin Features

- Create and manage emergency announcements
- Set schedule overrides for special days
- View and manage current settings
- Secure admin panel access

## 🛠️ Technical Requirements

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Modern web browser
- Internet connection (for weather updates)

## 📦 Installation for Schools

1. Clone the repository:
   ```bash
   git clone https://github.com/Marooncoloredchair/ALVclock.git
   cd ALVclock
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```
   WEATHER_API_KEY=your_openweathermap_api_key
   ADMIN_USERNAME=your_admin_username
   ADMIN_PASSWORD=your_admin_password
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Access the application:
   - Main display: `http://localhost:3000`
   - Admin panel: `http://localhost:3000/admin`

## 🔐 Default Admin Credentials

- Username: admin
- Password: alvarez2024

**Important:** Please change these credentials before deployment.

## ✏️ Customization

The application can be customized for different schools by modifying:
- School logo (`public/images/alvarez-logo.png`)
- Schedule times in `server.js`
- Marquee messages
- Color scheme in `public/css/style.css`

## 🚀 Deployment Options

For production deployment, we recommend:
1. Using a process manager like PM2
2. Setting up SSL/HTTPS
3. Using environment variables for sensitive data
4. Setting up proper monitoring and logging

### Hosting Providers
You can deploy this application on:
- [Heroku](https://heroku.com)
- [DigitalOcean](https://digitalocean.com)
- [Railway](https://railway.app)
- Any Node.js hosting platform

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💡 Support

For support or questions:
1. Open an issue in the GitHub repository
2. Contact: [Your contact information]
3. Documentation: [Link to detailed documentation]

## 📸 Screenshots

![Main Clock Display](screenshots/main-display.png)
![Admin Panel](screenshots/admin-panel.png)
(Screenshots coming soon)
