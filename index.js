// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
var router = express.Router();

app.use(express.static(path.join(__dirname, 'public')));
app.use("/",router);
app.use(express.static(path.join(__dirname, 'testing')));

router.get("/index",function(req,res){
  res.sendFile(path.join(__dirname, 'testing') + "/index.html");
});

var numUsers = 0;

var numOnline = 0;
var choiceVotes = [0, 0, 0];

var currQuestionObject = null;
var nineInSeconds = 75600;
var threeInSeconds = 54000;
var dayInSeconds = 86400;
var thirtyMin = 1800;
var resetTimer = false;
var gameStarted = false;
var removeTimer = false;

//For debugging
gameStarted = true;

function resetTime() {
  console.log("Reset");
  resetTimer = false;
  gameStarted = false;
}


// Update the count down every 1 second
var x = setInterval(function() {
  // Get todays date and time
  var now = new Date();

  var day = now.getDay();
  var dayHours = now.getHours();
  var dayMins = now.getMinutes();
  var daySeconds = now.getSeconds();
  var dayInSeconds = (dayHours * 3600) + (dayMins * 60) + daySeconds

  var diffNine = dayInSeconds - nineInSeconds;
  var diffThree = dayInSeconds - threeInSeconds;

  if (resetTimer == false) {
    //Saturday
    if (day == 6) {
      //Reached 9pm
      if (diffNine > 0 && diffNine < thirtyMin) {
        resetTimer = true;
        gameStarted = true;
        //reset timer 30 minutes after game starts
        setTimeout(resetTime, thirtyMin * 1000);
      } else if (diffNine >= thirtyMin) {
        //If after 9:30 pm but not sunday yet
        var time = nineInSeconds + (dayInSeconds - dayInSeconds);
        io.sockets.emit('update timer', time);
      } else {
        io.sockets.emit('update timer', -diffNine);
      }
    } //Sunday
    else if (day == 0) {
      //Reached 9pm
      if (diffNine > 0 && diffNine < thirtyMin) {
        resetTimer = true;
        gameStarted = true;
        //reset timer 30 minutes after game starts
        setTimeout(resetTime, thirtyMin * 1000);
      } else if (diffNine >= thirtyMin) {
        //If after 9:30 pm but not sunday yet
        var time = threeInSeconds + (dayInSeconds - dayInSeconds);
        io.sockets.emit('update timer', time);
      } else {
        io.sockets.emit('update timer', -diffNine);
      }
    } //Mon, Tues, Wed, Thur, Fri
    else {
      //Reached 3pm
      if (diffThree > 0 && diffThree < thirtyMin) {
        resetTimer = true;
        gameStarted = true;
        //reset timer 30 minutes after game starts
        setTimeout(resetTime, thirtyMin * 1000);
      } else if (diffThree >= thirtyMin && diffNine < 0) {
        //If after 3:30 pm but not 9pm yet
        io.sockets.emit('update timer', -diffNine);
      } else if (diffNine > 0 && diffNine < thirtyMin) {
        resetTimer = true;
        gameStarted = true;
        //reset timer 30 minutes after game starts
        setTimeout(resetTime, thirtyMin * 1000);
      } else if (diffNine >= thirtyMin){
        //If after 9:30 pm but not Tuesday yet
        //if friday, next day is saturday so check 9 pm
        var timeAdd = threeInSeconds;
        if (day == 5) {
          timeAdd = nineInSeconds;
        }
        var time = timeAdd + (dayInSeconds - dayInSeconds);
        io.sockets.emit('update timer', time);
      } else {
        //Not 3pm yet
        io.sockets.emit('update timer', -diffThree);
      }
    }
  }

}, 1000);


io.on('connection', (socket) => {
  console.log("connected")
  numOnline++;

  io.sockets.emit('update all user', {
    'choices': choiceVotes,
    'numOnline': numOnline});

  socket.emit('update user', currQuestionObject);

  socket.on('new question', (data) => {
    // echo globally (all clients) that a person has connected
    currQuestionObject = data
    choiceVotes[0] = 0;
    choiceVotes[1] = 0;
    choiceVotes[2] = 0;
    console.log("new question");
    socket.broadcast.emit('add question', data);
  });

  socket.on('answer', (data) => {
    console.log("answer");
    data["choices"] = choiceVotes;
    socket.broadcast.emit('add answer', data);
  });

  socket.on('add vote 1', (data) => {
    if (gameStarted) {
      choiceVotes[0]++;
      io.sockets.emit('added vote 1', choiceVotes);
    }
  });

  socket.on('add vote 2', (data) => {
    if (gameStarted) {
      choiceVotes[1]++;
      io.sockets.emit('added vote 2', choiceVotes);
    }
  });

  socket.on('add vote 3', (data) => {
    if (gameStarted) {
      choiceVotes[2]++;
      io.sockets.emit('added vote 3', choiceVotes);
    }
  });







  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;

    console.log('hi');
    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    console.log("disconnect")
    numOnline--;

    socket.broadcast.emit('user disconnect', numOnline);


    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
