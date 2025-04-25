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
        { period: '1', start: '07:25', end: '08:47' },
        { period: '2', start: '08:51', end: '10:13' },
        { period: '3', start: '10:17', end: '11:39' },
        { period: 'Lunch', start: '11:39', end: '12:09' },
        { period: '4', start: '12:13', end: '13:35' },
        { period: '5', start: '13:39', end: '15:01' }
    ],
    extended: [
        { period: '1', start: '07:25', end: '08:40' },
        { period: '2', start: '08:44', end: '09:59' },
        { period: 'Advisory', start: '10:03', end: '10:48' },
        { period: '3', start: '10:52', end: '12:07' },
        { period: 'Lunch', start: '12:07', end: '12:37' },
        { period: '4', start: '12:41', end: '13:56' },
        { period: '5', start: '14:00', end: '15:15' }
    ],
    early: [
        { period: '1', start: '07:25', end: '08:35' },
        { period: '2', start: '08:39', end: '09:49' },
        { period: '3', start: '09:53', end: '11:03' },
        { period: '4', start: '11:07', end: '12:17' },
        { period: 'Lunch', start: '12:17', end: '12:47' },
        { period: '5', start: '12:51', end: '14:01' }
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

    const firstPeriod = schedule[currentSchedule][0];
    const lastPeriod = schedule[currentSchedule][schedule[currentSchedule].length - 1];
    
    // Convert schedule times to 24-hour format for comparison
    const dayStart = firstPeriod.start;
    const dayEnd = lastPeriod.end;
    
    return currentTime >= dayStart && currentTime <= dayEnd;
}

// Helper function to get current period
function getCurrentPeriod() {
    const now = moment();
    const currentTime = now.format('HH:mm');
    const currentSchedule = getCurrentScheduleType();
    
    if (!currentSchedule) return null;
    
    for (const period of schedule[currentSchedule]) {
        if (currentTime >= period.start && currentTime <= period.end) {
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
    
    for (let i = 0; i < schedule[currentSchedule].length; i++) {
        const period = schedule[currentSchedule][i];
        if (currentTime < period.start) {
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

    // Default to regular schedule
    return 'regular';
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
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Send initial data
    socket.emit('timeUpdate', {
        time: moment().format('h:mm:ss A'), // Changed to 12-hour format with AM/PM
        date: moment().format('dddd, MMMM D, YYYY'),
        currentPeriod: getCurrentPeriod(),
        nextPeriod: getNextPeriod(),
        isDuringSchool: isDuringSchoolHours(),
        scheduleType: getCurrentScheduleType()
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Update time and schedule information every second
setInterval(() => {
    // Clean up expired announcements
    activeAnnouncements = activeAnnouncements.filter(a => a.expires > Date.now());
    
    // Send updates to all connected clients
    io.emit('timeUpdate', {
        time: moment().format('h:mm:ss A'), // Changed to 12-hour format with AM/PM
        date: moment().format('dddd, MMMM D, YYYY'),
        currentPeriod: getCurrentPeriod(),
        nextPeriod: getNextPeriod(),
        isDuringSchool: isDuringSchoolHours(),
        scheduleType: getCurrentScheduleType(),
        announcements: activeAnnouncements
    });
}, 1000);

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 