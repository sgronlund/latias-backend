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
var app = require("express")();
var nodemailer = require("nodemailer");
var bigInt = require("big-integer");
var CronJob = require("cron").CronJob;

const Database = require("better-sqlite3");
const db = new Database("database.db", { verbose: console.log });
db.prepare(
  "CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255), score INT, scoreArticle INT, balance INT)"
).run();
db.prepare(
  "CREATE TABLE IF NOT EXISTS questions (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), correct varchar(255), weekNumber INT)"
).run();
db.prepare(
  "CREATE TABLE IF NOT EXISTS questionsArticle (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), wrong3 varchar(255), correct varchar(255), weekNumber INT)"
).run();
db.prepare(
  "CREATE TABLE IF NOT EXISTS articles (name varchar(255), link varchar(255), weekNumber INT)"
).run();
db.prepare(
  "CREATE TABLE IF NOT EXISTS coupons (name varchar(255), price INT)"
).run();

var newsLeaderboard = backend.getTopPlayersNewsQ(db);
var artLeaderboard = backend.getTopPlayersArtQ(db);

updateLeaderboards = () => {
  newsLeaderboard = backend.getTopPlayersNewsQ(db);
  artLeaderboard = backend.getTopPlayersArtQ(db);
};
setInterval(updateLeaderboards, 60 * 1000);

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
      case "valid":
        socket.emit("loginSuccess");
        break;
      case "root":
        socket.emit("loginRoot");
        break;
      case "invalidLoggedIn":
        socket.emit("alreadyLoggedIn");
        break;
      case "validUserDetails":
        socket.emit("loginSuccess");
        break;
      case "invalidUserDetails":
        socket.emit("invalidUserDetails");
        break;
      default:
        socket.emit("loginFailure");
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
    if (backend.clientLogout(id, users) === true) socket.emit("logoutSuccess");
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
   * @summary When the socket receives an addCoupon signal,
   * the database is updated with the new coupon
   */
  socket.on("addCoupon", (name, price) => {
    if (backend.addCoupon(name, price, db)) {
      socket.emit("addCouponSuccess");
    } else {
      socket.emit("addCouponFailure");
    }
  });

  /**
   * @summary When the socket receives a getCoupon signal,
   * the coupon is fetched from the database and returned
   * to the client socket
   */
  socket.on("getCoupon", (name) => {
    var getCoupon = backend.getCoupon(name, db);
    if (getCoupon) socket.emit("getCouponSuccess", getCoupon);
    else socket.emit("getCouponSuccess");
  });

  /**
   * @summary When the socket receives a resetCoupons signal,
   * it deletes all coupons
   */
  socket.on("resetCoupons", () => {
    backend.resetCoupons(db);
  });

  /**
   * @summary When the socket receives an addArticle signal,
   * the database is updated with the new article
   */
  socket.on("addArticle", (name, link, weekNumber) => {
    if (backend.addArticle(name, link, weekNumber, db)) {
      socket.emit("addArticleSuccess");
    } else {
      socket.emit("addArticleFailure");
    }
  });

  /**
   * @summary When the socket receives a getArticle signal,
   * the article is fetched from the database and returned
   * to the client socket
   */
  socket.on("getArticle", (name) => {
    var getArticle = backend.getArticle(name, db);
    if (getArticle) socket.emit("getArticleSuccess", getArticle);
    else socket.emit("getArticleSuccess");
  });

  /**
   * @summary When the socket receives a resetArticles signal,
   * it deletes all articles with a given week
   */
  socket.on("resetArticles", (weekNumber) => {
    backend.resetArticles(db, weekNumber);
  });

  /**
   * @summary When the user has answered all the questions in a
   * news quiz, he/she submits the amount of answers that were
   * correct and gets their score increased
   */
  socket.on("submitAnswers", (submittedScore) => {
    var username = backend.getUser(socket.id, users);
    var currentScore = backend.getScore(username, db);
    var newScore = currentScore + submittedScore;
    backend.updateScore(username, newScore, db);
  });

  /**
   * @summary When the user has answered all the questions in a
   * news quiz, he/she submits the amount of answers that were
   * correct and gets their score increased
   */
  socket.on("submitAnswersArticle", (submittedScore) => {
    var username = backend.getUser(socket.id, users);
    var currentScore = backend.getScoreArticle(username, db);

    //if currentScore is not 0, we don't want to add score again
    if (!currentScore) {
      var newScore = currentScore + submittedScore;
      backend.updateScoreArticle(username, newScore, db);
    }
    socket.emit("changeScreenFinishedArtQ");
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
    var balance = backend.getBalance(id, users, db);
    if (balance !== undefined) socket.emit("returnBalanceSuccess", balance);
    else socket.emit("returnBalanceFailure");
  });

  socket.on("getLeaderboard", (type) => {
    if (type === "newsq") socket.emit("updateLeaderboard", newsLeaderboard);
    else socket.emit("updateLeaderboard", artLeaderboard);
  });

  socket.on("changeBalance", (id, price) => {
    var newBalance = backend.changeBalance(id, users, price, db);
    if (newBalance !== undefined) {
      socket.emit("returnUpdateSuccess", newBalance);
    } else socket.emit("returnUpdateFailure");
  });

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
