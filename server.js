require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const moment = require('moment-timezone');
moment.tz.setDefault("America/New_York"); // Set timezone to EST
const fetch = require('node-fetch');
const basicAuth = require('./middleware/auth');

// Add body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Store for announcements and overrides
let activeAnnouncements = [];
let scheduleOverrides = [];

// Weather API configuration
const WEATHER_API_KEY = '02d39b49eff3bd53bef68749d6b4d5b8';
const PROVIDENCE_LAT = '41.8240';
const PROVIDENCE_LON = '-71.4128';

// Special events configuration
const specialEvents = [
    // Add your special events here
    // { date: '2024-04-26', message: 'Early Dismissal Today', type: 'early' }
];

// School schedule configuration
const schedule = {
    regular: [
        { period: '1', start: '07:45', end: '08:55' },
        { period: '2', start: '09:00', end: '10:10' },
        { period: '3/Lunch', start: '10:14', end: '12:01' },
        { period: 'Lunch A', start: '10:14', end: '10:47' },
        { period: 'Lunch B', start: '10:51', end: '11:24' },
        { period: 'Lunch C', start: '11:28', end: '12:01' },
        { period: '4', start: '12:05', end: '01:15' },
        { period: '5', start: '01:20', end: '02:30' }
    ],
    wednesday: [
        { period: '1', start: '07:45', end: '08:45' },
        { period: '2', start: '08:50', end: '09:50' },
        { period: 'Advisory', start: '09:54', end: '10:39' },
        { period: '3/Lunch', start: '10:43', end: '12:21' },
        { period: 'Lunch A', start: '10:43', end: '11:13' },
        { period: 'Lunch B', start: '11:17', end: '11:47' },
        { period: 'Lunch C', start: '11:51', end: '12:21' },
        { period: '4', start: '12:25', end: '01:25' },
        { period: '5', start: '01:30', end: '02:30' }
    ],
    delay1hr: [
        { period: '1', start: '08:45', end: '09:45' },
        { period: '2', start: '09:48', end: '10:48' },
        { period: '3/Lunch', start: '10:51', end: '12:23' },
        { period: 'Lunch A', start: '10:51', end: '11:19' },
        { period: 'Lunch B', start: '11:23', end: '11:51' },
        { period: 'Lunch C', start: '11:55', end: '12:23' },
        { period: '4', start: '12:27', end: '01:27' },
        { period: '5', start: '01:30', end: '02:30' }
    ],
    delay2hr: [
        { period: '1', start: '09:45', end: '10:34' },
        { period: '2', start: '10:38', end: '11:27' },
        { period: '3/Lunch', start: '11:31', end: '01:16' },
        { period: 'Lunch A', start: '11:31', end: '11:54' },
        { period: 'Lunch B', start: '11:57', end: '12:20' },
        { period: 'Lunch C', start: '12:53', end: '01:16' },
        { period: '4', start: '01:20', end: '02:08' },
        { period: '5', start: '02:12', end: '03:00' }
    ]
};

// Bell sound configuration - moved after schedule definition
const bellTimes = new Set();
Object.values(schedule).forEach(daySchedule => {
    daySchedule.forEach(period => {
        bellTimes.add(period.start);
        bellTimes.add(period.end);
    });
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

// Helper function to convert 24h time to 12h time for comparison
function convertTo24Hour(time12h) {
    return moment(time12h, 'h:mm A').format('HH:mm');
}

// Helper function to determine if it's during school hours
function isDuringSchoolHours() {
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentSchedule = getCurrentScheduleType();
    
    if (!currentSchedule) return false;

    const scheduleForToday = schedule[currentSchedule];
    const firstPeriod = scheduleForToday[0];
    const lastPeriod = scheduleForToday[scheduleForToday.length - 1];

    // Check if it's a weekday (Monday = 1, Sunday = 0)
    const dayOfWeek = now.day();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    // Convert times to comparable format (minutes since midnight)
    const currentMinutes = moment(currentTime, 'HH:mm').hours() * 60 + moment(currentTime, 'HH:mm').minutes();
    const startMinutes = moment(firstPeriod.start, 'HH:mm').hours() * 60 + moment(firstPeriod.start, 'HH:mm').minutes();
    const endMinutes = moment(lastPeriod.end, 'HH:mm').hours() * 60 + moment(lastPeriod.end, 'HH:mm').minutes();

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// Helper function to get current period
function getCurrentPeriod() {
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentSchedule = getCurrentScheduleType();
    
    if (!currentSchedule) return null;

    // Convert current time to minutes since midnight
    const currentMinutes = moment(currentTime, 'HH:mm').hours() * 60 + moment(currentTime, 'HH:mm').minutes();
    
    for (const period of schedule[currentSchedule]) {
        // Convert period times to minutes since midnight
        const startMinutes = moment(period.start, 'HH:mm').hours() * 60 + moment(period.start, 'HH:mm').minutes();
        const endMinutes = moment(period.end, 'HH:mm').hours() * 60 + moment(period.end, 'HH:mm').minutes();
        
        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
            return period;
        }
    }
    return null;
}

// Helper function to get next period
function getNextPeriod() {
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentSchedule = getCurrentScheduleType();
    
    if (!currentSchedule) return null;

    // Convert current time to minutes since midnight
    const currentMinutes = moment(currentTime, 'HH:mm').hours() * 60 + moment(currentTime, 'HH:mm').minutes();
    
    for (const period of schedule[currentSchedule]) {
        // Convert period start time to minutes since midnight
        const startMinutes = moment(period.start, 'HH:mm').hours() * 60 + moment(period.start, 'HH:mm').minutes();
        
        if (currentMinutes < startMinutes) {
            return period;
        }
    }
    return null;
}

// Helper function to get current schedule type
function getCurrentScheduleType() {
    // Check for schedule overrides first
    const today = moment().format('YYYY-MM-DD');
    const override = scheduleOverrides.find(o => o.date === today);
    if (override) return override.type;

    // Check if it's Wednesday
    const dayOfWeek = moment().day();
    if (dayOfWeek === 3) { // Wednesday is 3
        return 'wednesday';
    }

    // Default to regular schedule
    return 'regular';
}

// Function to fetch weather data
async function getWeatherData() {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${PROVIDENCE_LAT}&lon=${PROVIDENCE_LON}&appid=${WEATHER_API_KEY}&units=imperial`
        );
        const data = await response.json();
        return {
            temp: Math.round(data.main.temp),
            description: data.weather[0].description,
            icon: data.weather[0].icon
        };
    } catch (error) {
        console.error('Error fetching weather:', error);
        return null;
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('index', {
        schedule: schedule[getCurrentScheduleType()],
        scheduleType: getCurrentScheduleType(),
        announcements: activeAnnouncements,
        marqueeMessages: marqueeMessages,
        currentPeriod: getCurrentPeriod(),
        nextPeriod: getNextPeriod(),
        specialEvent: null,
        isSchoolHours: isDuringSchoolHours(),
        moment: moment
    });
});

app.get('/admin', (req, res) => {
    res.render('admin', {
        schedule,
        announcements: activeAnnouncements,
        scheduleOverrides
    });
});

// Admin routes for managing announcements and schedule overrides
app.post('/admin/announcement', (req, res) => {
    const { message, duration } = req.body;
    const announcement = {
        id: Date.now(),
        message,
        expires: moment().add(duration, 'minutes').valueOf()
    };
    activeAnnouncements.push(announcement);
    res.json({ success: true, announcement });
});

app.post('/admin/schedule-override', (req, res) => {
    const { date, type } = req.body;
    scheduleOverrides.push({ date, type });
    res.json({ success: true });
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
    console.log('A user connected');
    
    // Get initial weather data
    const weatherData = await getWeatherData();
    
    // Send initial data
    socket.emit('timeUpdate', {
        time: moment().format('h:mm:ss A'),
        date: moment().format('dddd, MMMM D, YYYY'),
        currentPeriod: getCurrentPeriod(),
        nextPeriod: getNextPeriod(),
        isDuringSchool: isDuringSchoolHours(),
        scheduleType: getCurrentScheduleType(),
        weather: weatherData,
        marqueeMessages: marqueeMessages
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Update time and schedule information every second
setInterval(async () => {
    // Clean up expired announcements
    activeAnnouncements = activeAnnouncements.filter(a => a.expires > Date.now());
    
    // Get weather data (update every 5 minutes)
    const currentMinute = new Date().getMinutes();
    let weatherData = null;
    if (currentMinute % 5 === 0) {
        weatherData = await getWeatherData();
    }

    // Check if we need to ring the bell
    const now = moment();
    const currentTime = now.format('HH:mm');
    const shouldRingBell = bellTimes.has(currentTime);
    
    // Send updates to all connected clients
    io.emit('timeUpdate', {
        time: moment().format('h:mm:ss A'),
        date: moment().format('dddd, MMMM D, YYYY'),
        currentPeriod: getCurrentPeriod(),
        nextPeriod: getNextPeriod(),
        isDuringSchool: isDuringSchoolHours(),
        scheduleType: getCurrentScheduleType(),
        announcements: activeAnnouncements,
        weather: weatherData,
        marqueeMessages: marqueeMessages,
        ringBell: shouldRingBell
    });
}, 1000);

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 