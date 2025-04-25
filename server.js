require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const moment = require('moment');
const fetch = require('node-fetch');
const basicAuth = require('./middleware/auth');

// Add body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store for announcements and overrides
let activeAnnouncements = [];
let scheduleOverrides = [];

// Weather API configuration
const WEATHER_API_KEY = '02d39b49eff3bd53bef68749d6b4d5b8';  // Your new API key
const PROVIDENCE_LAT = '41.8240';
const PROVIDENCE_LON = '-71.4128';

// Function to fetch weather
async function getWeather() {
    // If no API key is configured, return null
    if (!WEATHER_API_KEY) {
        return null;
    }
    
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${PROVIDENCE_LAT}&lon=${PROVIDENCE_LON}&units=imperial&appid=${WEATHER_API_KEY}`
        );
        if (!response.ok) {
            console.log('Weather API response not ok:', await response.text());
            return null;
        }
        const data = await response.json();
        return {
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            icon: data.weather[0].icon
        };
    } catch (error) {
        console.error('Weather fetch error:', error);
        return null;
    }
}

// Special events configuration
const specialEvents = [
    // Add your special events here
    // { date: '2024-04-26', message: 'Early Dismissal Today', type: 'early' }
];

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// School schedule configuration
const schedule = {
  regular: [
    { period: 'Advisory', start: '7:40', end: '7:56' },
    { period: 'Period 1', start: '8:00', end: '8:52' },
    { period: 'Period 2', start: '8:56', end: '9:48' },
    { period: 'Period 3', start: '9:52', end: '10:44' },
    { period: 'Period 4', start: '10:48', end: '12:17' },
    { period: 'A Lunch', start: '10:48', end: '11:15' },
    { period: 'B Lunch', start: '11:19', end: '11:46' },
    { period: 'C Lunch', start: '11:50', end: '12:17' },
    { period: 'Period 5', start: '12:21', end: '13:13' },
    { period: 'Period 6', start: '13:17', end: '14:11' }
  ],
  extended: [
    { period: 'Advisory', start: '7:40', end: '8:30' },
    { period: 'Period 1', start: '8:34', end: '9:20' },
    { period: 'Period 2', start: '9:24', end: '10:10' },
    { period: 'Period 3', start: '10:14', end: '11:00' },
    { period: 'Period 4', start: '11:04', end: '12:31' },
    { period: 'A Lunch', start: '11:04', end: '11:31' },
    { period: 'B Lunch', start: '11:34', end: '12:01' },
    { period: 'C Lunch', start: '12:04', end: '12:31' },
    { period: 'Period 5', start: '12:35', end: '13:21' },
    { period: 'Period 6', start: '13:25', end: '14:11' }
  ],
  early: [
    { period: 'Advisory', start: '7:40', end: '7:56' },
    { period: 'Period 1', start: '8:00', end: '8:33' },
    { period: 'Period 2', start: '8:37', end: '9:10' },
    { period: 'Period 3', start: '9:14', end: '9:47' },
    { period: 'Period 4', start: '9:51', end: '10:24' },
    { period: 'Period 5', start: '10:28', end: '11:01' },
    { period: 'Period 6', start: '11:05', end: '11:38' },
    { period: 'Grab and Go Lunch', start: '11:38', end: '12:08' }
  ]
};

// Bell sound configuration
const bellTimes = new Set();
schedule.regular.forEach(period => {
    bellTimes.add(period.start);
    bellTimes.add(period.end);
});

// Marquee messages configuration
const marqueeMessages = [
    '🦅 GO EAGLES! 🦅',
    'Home of the Eagles!',
    'Soar to Success!',
    'Eagle Pride!',
    'Dr. Jorge Alvarez High School',
    'Excellence in Education!'
];

// Helper function to determine if it's during school hours
function isDuringSchoolHours(now) {
  const schoolStart = moment('7:00', 'H:mm');
  const schoolEnd = moment('15:00', 'H:mm');
  return now.isBetween(schoolStart, schoolEnd);
}

// Helper function to get current period
function getCurrentPeriod(schedule) {
  const now = moment();
  
  // If outside school hours, return null
  if (!isDuringSchoolHours(now)) {
    return null;
  }

  for (const period of schedule) {
    const start = moment(period.start, 'H:mm');
    const end = moment(period.end, 'H:mm');
    if (now.isBetween(start, end)) {
      return period;
    }
  }
  return null;
}

// Helper function to get next period
function getNextPeriod(schedule, currentPeriod) {
  if (!currentPeriod) return null;
  const currentIndex = schedule.findIndex(p => p.period === currentPeriod.period);
  if (currentIndex < schedule.length - 1) {
    return schedule[currentIndex + 1];
  }
  return null;
}

// Admin routes
app.get('/admin', basicAuth, (req, res) => {
    res.render('admin', {
        activeAnnouncements,
        scheduleOverrides
    });
});

app.post('/admin/announcement', basicAuth, (req, res) => {
    const { message, duration } = req.body;
    const id = Date.now().toString();
    const expiresAt = moment().add(duration, 'minutes').toDate();
    
    activeAnnouncements.push({
        id,
        message,
        expiresAt
    });

    // Schedule announcement removal
    setTimeout(() => {
        activeAnnouncements = activeAnnouncements.filter(a => a.id !== id);
        io.emit('announcementsUpdate', activeAnnouncements);
    }, duration * 60 * 1000);

    io.emit('announcementsUpdate', activeAnnouncements);
    res.redirect('/admin');
});

app.delete('/admin/announcement/:id', basicAuth, (req, res) => {
    const { id } = req.params;
    activeAnnouncements = activeAnnouncements.filter(a => a.id !== id);
    io.emit('announcementsUpdate', activeAnnouncements);
    res.sendStatus(200);
});

app.post('/admin/override', basicAuth, (req, res) => {
    const { date, scheduleType, reason } = req.body;
    scheduleOverrides.push({
        date,
        scheduleType,
        reason
    });
    io.emit('overridesUpdate', scheduleOverrides);
    res.redirect('/admin');
});

app.delete('/admin/override/:date', basicAuth, (req, res) => {
    const { date } = req.params;
    scheduleOverrides = scheduleOverrides.filter(o => o.date !== date);
    io.emit('overridesUpdate', scheduleOverrides);
    res.sendStatus(200);
});

// Update getScheduleType function to check for overrides
function getScheduleType() {
    const now = moment();
    const today = now.format('YYYY-MM-DD');
    
    // Check for override
    const override = scheduleOverrides.find(o => o.date === today);
    if (override) {
        return override.scheduleType;
    }
    
    // Default logic
    if (now.day() === 4) { // Thursday
        return 'extended';
    } else if (now.day() === 3) { // Wednesday
        return 'early';
    }
    return 'regular';
}

// Routes
app.get('/', (req, res) => {
    try {
        const scheduleType = getScheduleType();
        const currentSchedule = schedule[scheduleType];
        const now = moment();
        const currentPeriod = getCurrentPeriod(currentSchedule);
        const nextPeriod = getNextPeriod(currentSchedule, currentPeriod);
        
        // Check for special events
        const today = now.format('YYYY-MM-DD');
        const specialEvent = specialEvents.find(event => event.date === today);
        
        res.render('index', {
            schedule: currentSchedule,
            currentPeriod: currentPeriod,
            nextPeriod: nextPeriod,
            scheduleType: scheduleType,
            isSchoolHours: isDuringSchoolHours(now),
            marqueeMessages: marqueeMessages,
            specialEvent: specialEvent
        });
    } catch (error) {
        console.error('Error in route handler:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Socket.IO for real-time updates
io.on('connection', async (socket) => {
    console.log('A user connected');
    
    // Send initial announcements
    socket.emit('announcementsUpdate', activeAnnouncements);
    socket.emit('overridesUpdate', scheduleOverrides);
    
    // Initial weather fetch
    let weatherData = await getWeather();
    
    // Send time updates every second
    const interval = setInterval(async () => {
        const now = moment();
        const scheduleType = getScheduleType();
        const currentSchedule = schedule[scheduleType];
        const currentPeriod = getCurrentPeriod(currentSchedule);
        const nextPeriod = getNextPeriod(currentSchedule, currentPeriod);
        
        // Check if it's time to ring the bell
        const currentTime = now.format('HH:mm');
        const shouldRingBell = bellTimes.has(currentTime);
        
        // Calculate countdown to next period
        let countdown = '';
        if (nextPeriod) {
            const nextStart = moment(nextPeriod.start, 'HH:mm');
            // Adjust nextStart if it's for tomorrow
            if (nextStart.isBefore(now)) {
                nextStart.add(1, 'day');
            }
            const duration = moment.duration(nextStart.diff(now));
            const minutes = duration.minutes();
            const seconds = duration.seconds();
            countdown = `${minutes}m ${seconds}s`;
        }
        
        // Update weather every 5 minutes
        if (now.minutes() % 5 === 0 && now.seconds() === 0) {
            weatherData = await getWeather();
        }

        socket.emit('timeUpdate', {
            time: now.format('HH:mm:ss'),
            date: now.format('dddd, MMMM D, YYYY'),
            currentPeriod: currentPeriod,
            nextPeriod: nextPeriod,
            scheduleType: scheduleType,
            isSchoolHours: isDuringSchoolHours(now),
            marqueeMessages: marqueeMessages,
            weather: weatherData,
            ringBell: shouldRingBell,
            countdown: countdown
        });
    }, 1000);

    socket.on('disconnect', () => {
        clearInterval(interval);
        console.log('User disconnected');
    });
});

// Update package.json scripts
const fs = require('fs');
const packageJson = require('./package.json');
packageJson.scripts.start = 'node server.js';
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 