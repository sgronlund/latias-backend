///Array that maps socket ids to usernames
let users = [];

let currentlyPlaying = [];

///Array that maps socket ids to cryptographic keys
let clients = [];

///Variable for checking if quiz is ready or not
let quizOpen = false;

///Number of clients currently playing the article quiz
var playerCount = 0;

///Variable for timeout interval
let interval;

var backend = require("./backend");
var app = require("express")("192.168.1.150");
var nodemailer = require("nodemailer");
var bigInt = require("big-integer");
var CronJob = require("cron").CronJob;

const Database = require("better-sqlite3");
const db = new Database("database.db", { verbose: console.log });

db.prepare(
  "CREATE TABLE IF NOT EXISTS users (username VARCHAR(255) COLLATE NOCASE, password VARCHAR(255), email varchar(255), resetcode varchar(255), score INT, balance INT)"
).run();
db.prepare(
  "CREATE TABLE IF NOT EXISTS questions (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), correct varchar(255), weekNumber INT)"
).run();
db.prepare(
  "CREATE TABLE IF NOT EXISTS questionsArticle (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), wrong3 varchar(255), correct varchar(255), weekNumber INT)"
).run();

var leaderboard = backend.getTopPlayers(db);
updateLeaderboard = () => {
  leaderboard = backend.getTopPlayers(db);
};
setInterval(updateLeaderboard, 60 * 1000);

/**
 * CORS is a mechanism which restricts us from hosting both the client and the server.
 * The package cors allows us the bypass this
 * */
var cors = require("cors");
app.use(cors());

/// Creates an HTTP server using ExpressJS
var http = require("http").createServer(app);
const PORT = 8080;
/// The cors: ... is also required to bypass the restriction stated above
var server = require("socket.io")(http, { cors: { origin: "*" } });

/// Starts listening on the chosen port
http.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});

/**
 * @summary Determines the behaviour for when
 * a client connects to our socket.
 */
server.on("connection", (socket) => {
  console.log("new client connected");
  socket.emit("connection");

  /**
   * @summary When the socket receives a register signal,
   * the username, password and email is checked and a
   * corresponding success/fail message is sent
   */

  socket.on("register", (username, encryptedPassword, email) => {
    var password = backend.decryptPassword(
      clients,
      encryptedPassword,
      socket.id
    );
    if (backend.clientRegister(username, password, email, db))
      socket.emit("registerSuccess");
    else socket.emit("registerFailure");
  });

  /**
   * @summary When the socket receives a login signal,
   * the username and password is checked and a
   * corresponding success/fail message is sent
   */
  socket.on("login", (username, encryptedPassword) => {
    var password = backend.decryptPassword(
      clients,
      encryptedPassword,
      socket.id
    );
    var loggedIn = backend.clientLogin(
      username,
      password,
      db,
      users,
      socket.id
    );
    switch (loggedIn) {
      case "invalid":
        socket.emit("blankDetails");
        break;
      case "root":
        socket.emit("loginRoot");
        break;
      case "loggedInAlready":
        socket.emit("alreadyLoggedIn");
        break;
      case "validUserDetails":
        socket.emit("loginSuccess");
        break;
      case "invalidUserDetails":
        socket.emit("invalidUserDetails");
        break;
      default:
        console.log("Unknown error");
        break;
    }
  });

  /**
   * @summary When the socket receives a logout signal,
   * a check is made if the socket id matches a user and
   * if it does, logs out user and sends a success message,
   * otherwise failure message
   */
  socket.on("logout", (id) => {
    if (backend.clientLogout(id, users)) socket.emit("logoutSuccess");
    else socket.emit("logoutFailure");
  });

  /**
   * @summary When the socket receives a resetPass signal,
   * the mail is checked in the database and a corresponding
   * success/fail message is sent. If successful, a code is
   * sent to the mail
   */
  socket.on("resetPass", (email) => {
    if (backend.checkMail(email, db)) {
      var code = backend.generateCode(8);
      backend.insertCode(code, email, db);
      backend.sendMail(code, email, nodemailer);
      socket.emit("emailSuccess");
    } else {
      socket.emit("emailFailure");
    }
  });

  /**
   * @summary When the socket receives a submitCode signal,
   * the code and email is checked against the database and
   * a corresponding success/fail message is sent
   */
  socket.on("submitCode", (code, email) => {
    if (backend.checkCode(code, email, db)) socket.emit("codeSuccess");
    else socket.emit("codeFailure");
  });

  /**
   * @summary When the socket receives an updatePass signal,
   * the users password is updated with the received password
   */
  socket.on("updatePass", (email, encryptedPassword) => {
    var password = backend.decryptPassword(
      clients,
      encryptedPassword,
      socket.id
    );
    if (backend.updatePassword(password, email, db))
      socket.emit("updatePassSuccess");
    else socket.emit("updatePassFailure");
  });

  /**
   * @summary When the socket receives an addQuestion signal,
   * the database is updated with the new question
   */
  socket.on("addQuestion", (question, answers, weekNumber) => {
    if (backend.addQuestionNews(question, answers, db, weekNumber)) {
      socket.emit("addQuestionSuccess");
    } else {
      socket.emit("addQuestionFailure");
    }
  });

  /**
   * @summary When the socket receives a getQuestion signal,
   * the question and answers are fetched from the database
   * and returned to the client socket
   */
  socket.on("getQuestion", (question, weekNumber) => {
    var getQuestion = backend.getQuestionNews(question, db, weekNumber);
    if (getQuestion) socket.emit("getQuestionSuccess", getQuestion);
    else socket.emit("getQuestionFailure");
  });

  /**
   * @summary When the socket receives a getQuestions signal,
   * all questions with the given weekNumber are returned and
   * emitted to the client socket
   */
  socket.on("getQuestions", (weekNumber) => {
    var questions = backend.getQuestionsNews(db, weekNumber);
    if (questions) socket.emit("getQuestionsSuccess", questions);
    else socket.emit("getQuestionsFailure");
  });

  /**
   * @summary resets all questions for a given week number
   */
  socket.on("resetQuestions", (weekNumber) => {
    backend.resetQuestionsNews(db, weekNumber);
  });

  /**
   * @summary When the socket receives an addQuestion signal,
   * the database is updated with the new question
   */
  socket.on("addQuestionArticle", (question, answers, weekNumber) => {
    if (backend.addQuestionArticle(question, answers, db, weekNumber))
      socket.emit("addQuestionArticleSuccess");
    else socket.emit("addQuestionArticleFailure");
  });

  /**
   * @summary When the socket receives a getQuestion signal,
   * the question and answers are fetched from the database
   * and returned to the client socket
   */
  socket.on("getQuestionArticle", (question, weekNumber) => {
    var getQuestion = backend.getQuestionArticle(question, db, weekNumber);
    if (getQuestion) socket.emit("getQuestionArticleSuccess", getQuestion);
    else socket.emit("getQuestionArticleFailure");
  });

  /**
   * @summary When the socket receives a getQuestions signal,
   * all questions with the given weekNumber are returned and
   * emitted to the client socket
   */
  socket.on("getQuestionsArticle", (weekNumber) => {
    var questions = backend.getQuestionsArticle(db, weekNumber);
    if (questions) socket.emit("getQuestionsArticleSuccess", questions);
    else socket.emit("getQuestionsArticleFailure");
  });

  /**
   * @summary resets all questions for a given week number
   */
  socket.on("resetQuestionsArticle", (weekNumber) => {
    backend.resetQuestionsArticle(db, weekNumber);
  });

  /**
   * @summary When the user has answered all the questions in a
   * news quiz, he/she submits the amount of answers that were
   * correct and gets their score increased
   */
  socket.on("submitAnswers", (correctAnswers) => {
    var username = backend.getUser(socket.id, users);
    var currentScore = backend.getScore(username, db);
    var newScore = currentScore + correctAnswers;
    backend.updateScore(username, newScore, db);
  });

  /**
   * @summary When the socket receives a getUser signal,
   * the username is fetched from the database and
   * returned to the client socket
   */
  socket.on("getUser", (id) => {
    var user = backend.getUser(id, users);
    if (user) socket.emit("returnUserSuccess", user);
    else socket.emit("returnUserFailure");
  });

  /**
   * @summary When the socket receives a getBalance signal,
   * the balance is fetched from the database and
   * returned to the client socket
   */
  socket.on("getBalance", (id) => {
    var balance = backend.getBalance(id, users);
    if (balance !== undefined) socket.emit("returnBalanceSuccess", balance);
    else socket.emit("returnBalanceFailure");
  });

  socket.on("changeBalance", (id, price) => {
    var newbalance = backend.changeBalance(id, users, price, db);
    if (newbalance !== undefined)
      socket.emit("returnUpdateSuccess", user.balance);
    else socket.emit("returnUpdateFailure");
  });

  let g, p;
  /*
   * @summary will send the current version of the leaderboard to a requesting client
   */
  socket.on("getLeaderboard", () => {
    socket.emit("updatedLB", leaderboard);
  });

  //TODO: document this
  socket.on("getUserByEmail", (email) => {
    var user = backend.getUserByEmail(email, db);
    if (user) socket.emit("returnUserByEmailSuccess", user);
    else socket.emit("returnUserByEmailFailure");
  });

  socket.on("startKeyExchange", () => {
    var server_private_key = bigInt(4201337); //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
    g = bigInt(backend.randomPrime());
    p = bigInt(2 * g + 1);
    var server_public_key = g.modPow(server_private_key, p);
    socket.emit(
      "serverPublic",
      Number(server_public_key),
      Number(g),
      Number(p)
    );
  });

  //TODO: document this
  socket.on("clientPublic", (client_public_key) => {
    var server_private_key = bigInt(4201337); //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
    client_public_key = bigInt(client_public_key);
    var shared_key = client_public_key.modPow(server_private_key, p);
    console.log("the established key: " + shared_key);

    clients.push({
      id: socket.id,
      key: shared_key,
    });
  });

  /**
   * @summary when a client connects, we increase the
   * current player number
   */
  socket.on("quizConnect", () => {
    currentlyPlaying.push(socket.id);
    playerCount++;
  });

  /**
   * @summary when a client disconnects, we decrease the
   * current player number
   */
  socket.on("quizDisconnect", () => {
    playerCount--;
  });

  /**
   * @summary emits the current time left until the
   * quiz opens every second
   */
  interval = setInterval(() => {
    var date = quizCountdown.nextDate().toDate();
    var seconds = backend.calculateTimeToDateSeconds(date);
    socket.emit("timeLeft", backend.stringifySeconds(seconds));
  }, 1000);

  /**
   * @summary determines behaviour when client disconnects
   */
  socket.on("disconnect", () => {
    var user = backend.getUser(socket.id, users);
    if (user) console.log("client disconnected with username: " + user);
    else console.log("guest client disconnected");

    /* Should only decrease player count
    if the player is currently playing */
    if (currentlyPlaying.includes(socket.id)) {
      currentlyPlaying.splice(currentlyPlaying.indexOf(socket.id));
      playerCount--;
    }
    users.splice(users.indexOf(user), 1);
    clients.splice(clients.indexOf(socket.id), 1);
    clearInterval(interval);
  });
});

/**
 *
 * @summary Schedules a job every week according to the
 * Europe/Stockholm time zone
 */
var quizCountdown = new CronJob(
  //"* 20 * * SUN",
  "*/10 * * * * *",
  function () {
    server.emit("quizReady");
    quizOpen = true;
    setInterval(() => {
      server.emit("updatePlayerCount", playerCount);
    }, 1000);
  },
  null,
  true,
  "Europe/Stockholm"
);

quizCountdown.start();
