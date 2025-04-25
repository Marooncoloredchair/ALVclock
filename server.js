const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const moment = require('moment');

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

// Helper function to get current period
function getCurrentPeriod(schedule) {
  const now = moment();
  for (const period of schedule) {
    const start = moment(period.start, 'H:mm');
    const end = moment(period.end, 'H:mm');
    if (now.isBetween(start, end)) {
      return period;
    }
  }
  return null;
}

// Routes
app.get('/', (req, res) => {
  const currentSchedule = schedule.regular; // You can make this dynamic based on the day
  const currentPeriod = getCurrentPeriod(currentSchedule);
  res.render('index', {
    schedule: currentSchedule,
    currentPeriod: currentPeriod,
    schoolName: 'Alvarez High School'
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('A user connected');
  
  // Send time updates every second
  const interval = setInterval(() => {
    const now = moment();
    socket.emit('timeUpdate', {
      time: now.format('HH:mm:ss'),
      date: now.format('dddd, MMMM D, YYYY'),
      currentPeriod: getCurrentPeriod(schedule.regular)
    });
  }, 1000);

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('User disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 