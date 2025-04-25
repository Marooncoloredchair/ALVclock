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
    const now = moment().tz("America/New_York");
    const currentTime = now.format('HH:mm');
    const dayOfWeek = now.format('dddd');
    const currentSchedule = getCurrentScheduleType();

    console.log('DEBUG - isDuringSchoolHours check:', {
        currentTime,
        dayOfWeek,
        currentSchedule,
        rawMoment: now.format(),
        unixTimestamp: now.valueOf(),
        timezone: now.tz(),
        utcOffset: now.utcOffset()
    });

    // Check if it's a weekend
    if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
        console.log('DEBUG - Weekend detected:', dayOfWeek);
        return false;
    }

    if (!currentSchedule) {
        console.log('DEBUG - No schedule type found for today');
        return false;
    }

    const scheduleForToday = schedule[currentSchedule];
    if (!scheduleForToday) {
        console.log('DEBUG - No schedule found for type:', currentSchedule);
        return false;
    }

    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    // Get first period start time
    const firstPeriod = scheduleForToday[0];
    const [startHour, startMinute] = firstPeriod.start.split(':').map(Number);
    const schoolStartMinutes = startHour * 60 + startMinute;

    // Get last period end time
    const lastPeriod = scheduleForToday[scheduleForToday.length - 1];
    const [endHour, endMinute] = lastPeriod.end.split(':').map(Number);
    // Convert end hour to 24-hour format if it's PM (1-11)
    const endHour24 = endHour < 7 ? endHour + 12 : endHour;
    const schoolEndMinutes = endHour24 * 60 + endMinute;

    console.log('DEBUG - Time calculations:', {
        currentTime: `${currentHour}:${currentMinute}`,
        currentMinutes,
        schoolStartTime: `${startHour}:${startMinute}`,
        schoolStartMinutes,
        schoolEndTime: `${endHour24}:${endMinute}`,
        schoolEndMinutes,
        bufferStart: schoolStartMinutes - 20,
        bufferEnd: schoolEndMinutes + 10
    });

    // Check if current time is within school hours (including buffers)
    const isDuringHours = currentMinutes >= (schoolStartMinutes - 20) && 
                         currentMinutes <= (schoolEndMinutes + 10);

    console.log('DEBUG - Final result:', {
        isDuringHours,
        beforeSchool: currentMinutes < (schoolStartMinutes - 20),
        afterSchool: currentMinutes > (schoolEndMinutes + 10)
    });

    return isDuringHours;
}

// Helper function to get current period
function getCurrentPeriod() {
    if (!isDuringSchoolHours()) {
        console.log('Not during school hours - no current period');
        return null;
    }

    const now = moment().tz("America/New_York");
    const currentTime = now.format('HH:mm');
    const currentSchedule = getCurrentScheduleType();
    
    console.log('Getting current period:', {
        currentTime,
        currentSchedule,
        rawTime: now.format(),
        timezone: now.tz()
    });

    if (!currentSchedule) {
        console.log('No schedule type found for today');
        return null;
    }

    const scheduleForToday = schedule[currentSchedule];
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    for (const period of scheduleForToday) {
        const [startHour, startMinute] = period.start.split(':').map(Number);
        const [endHour, endMinute] = period.end.split(':').map(Number);
        // Convert hours to 24-hour format if they're PM (1-11)
        const startHour24 = startHour < 7 ? startHour + 12 : startHour;
        const endHour24 = endHour < 7 ? endHour + 12 : endHour;
        const startMinutes = startHour24 * 60 + startMinute;
        const endMinutes = endHour24 * 60 + endMinute;

        console.log('Checking period:', {
            periodName: period.period,
            startTime: `${startHour24}:${startMinute}`,
            endTime: `${endHour24}:${endMinute}`,
            currentMinutes,
            startMinutes,
            endMinutes,
            isWithinPeriod: currentMinutes >= startMinutes && currentMinutes <= endMinutes
        });

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
            console.log('Found current period:', period.period);
            return period;
        }
    }

    console.log('No current period found in schedule');
    return null;
}

// Helper function to get next period
function getNextPeriod() {
    const now = moment().tz("America/New_York");
    const currentTime = now.format('HH:mm');
    const currentSchedule = getCurrentScheduleType();
    
    console.log('Getting next period:', {
        currentTime,
        currentSchedule,
        rawTime: now.format(),
        timezone: now.tz()
    });

    if (!currentSchedule) {
        console.log('No schedule type found for today');
        return null;
    }

    const scheduleForToday = schedule[currentSchedule];
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    let nextPeriod = null;
    let smallestDifference = Infinity;

    for (const period of scheduleForToday) {
        const [startHour, startMinute] = period.start.split(':').map(Number);
        // Convert start hour to 24-hour format if it's PM (1-11)
        const startHour24 = startHour < 7 ? startHour + 12 : startHour;
        const startMinutes = startHour24 * 60 + startMinute;
        const timeDifference = startMinutes - currentMinutes;

        console.log('Checking next period:', {
            periodName: period.period,
            startTime: `${startHour24}:${startMinute}`,
            currentMinutes,
            startMinutes,
            timeDifference,
            isNextPeriod: timeDifference > 0 && timeDifference < smallestDifference
        });

        if (timeDifference > 0 && timeDifference < smallestDifference) {
            smallestDifference = timeDifference;
            nextPeriod = period;
        }
    }

    if (nextPeriod) {
        console.log('Found next period:', nextPeriod.period);
    } else {
        console.log('No next period found in schedule');
    }

    return nextPeriod;
}

// Helper function to get current schedule type
function getCurrentScheduleType() {
    const now = moment().tz("America/New_York");
    const today = now.format('YYYY-MM-DD');
    console.log('Getting schedule type for date:', today);
    
    const override = scheduleOverrides.find(o => o.date === today);
    if (override) {
        console.log('Found schedule override:', override.type);
        return override.type;
    }

    // Check if it's Wednesday
    const dayOfWeek = now.day();
    console.log('Day of week:', dayOfWeek);
    
    if (dayOfWeek === 3) { // Wednesday is 3
        console.log('It is Wednesday, using wednesday schedule');
        return 'wednesday';
    }

    // Default to regular schedule
    console.log('Using regular schedule');
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
io.on('connection', (socket) => {
    console.log('A user connected');
    
    // Initial data send
    const now = moment().tz("America/New_York");
    console.log('Socket connection - sending initial time:', now.format());
    
    socket.emit('timeUpdate', {
        time: now.format('h:mm:ss A'),
        date: now.format('dddd, MMMM D, YYYY'),
        currentPeriod: getCurrentPeriod(),
        nextPeriod: getNextPeriod(),
        isDuringSchool: isDuringSchoolHours(),
        scheduleType: getCurrentScheduleType(),
        announcements: activeAnnouncements,
        weather: null,
        marqueeMessages: marqueeMessages,
        ringBell: false
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

    const now = moment().tz("America/New_York");
    // Check if we need to ring the bell
    const currentTime = now.format('HH:mm');
    const shouldRingBell = bellTimes.has(currentTime);
    
    // Send updates to all connected clients
    io.emit('timeUpdate', {
        time: now.format('h:mm:ss A'),
        date: now.format('dddd, MMMM D, YYYY'),
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
    console.log('Current server time:', moment().format());
    console.log('Current NY time:', moment().tz("America/New_York").format());
    console.log('Server timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('Node TZ env:', process.env.TZ);
    
    // Log initial schedule state
    const now = moment().tz("America/New_York");
    console.log('Initial schedule state:');
    console.log('- Time:', now.format('h:mm:ss A'));
    console.log('- Date:', now.format('dddd, MMMM D, YYYY'));
    console.log('- During school hours:', isDuringSchoolHours());
    console.log('- Current period:', getCurrentPeriod());
    console.log('- Next period:', getNextPeriod());
    console.log('- Schedule type:', getCurrentScheduleType());
});