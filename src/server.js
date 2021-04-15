/* The comment below is for the jest testing framework to ignore
the following code statement */
/* istanbul ignore next */
function main() {
  let users = [];

  var app = require("express")();
  var nodemailer = require("nodemailer");
  var bigInt = require("big-integer");

  const Database = require("better-sqlite3");
  const db = new Database("database.db", { verbose: console.log });

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

    socket.on("register", (username, password, email) => {
      if (clientRegister(username, password, email, db))
        socket.emit("registerSuccess");
      else socket.emit("registerFailure");
    });

    /**
     * @summary When the socket receives a login signal,
     * the username and password is checked and a
     * corresponding success/fail message is sent
     */
    socket.on("login", (username, password) => {
      if (clientLogin(username, password, db, users, socket.id) === "valid")
        socket.emit("loginSuccess");
      else if (clientLogin(username, password, db, users, socket.id) === "root")
        socket.emit("loginRoot");
      else socket.emit("loginFailure");
    });

    /**
     * @summary When the socket receives a logout signal,
     * a check is made if the socket id matches a user and
     * if it does, logs out user and sends a success message,
     * otherwise failure message
     */
     socket.on("logout", () => {
      if (clientLogout(socket.id, users) === "valid") socket.emit("logoutSuccess");
      else socket.emit("logoutFailure");
    });

    /**
     * @summary When the socket receives a resetPass signal,
     * the mail is checked in the database and a corresponding
     * success/fail message is sent. If successful, a code is
     * sent to the mail
     */
    socket.on("resetPass", (email) => {
      if (checkMail(email, db)) {
        var code = generateCode(8);
        insertCode(code, email, db);
        sendMail(code, email, nodemailer);
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
      if (checkCode(code, email, db)) socket.emit("codeSuccess");
      else socket.emit("codeFailure");
    });

    /**
     * @summary When the socket receives an updatePass signal,
     * the users password is updated with the received password
     */
    socket.on("updatePass", (email, password) => {
      if (updatePassword(password, email, db)) socket.emit("updatePassSuccess");
      else socket.emit("updatePassFailure");
    });

    /**
     * @summary When the socket receives an addQuestion signal,
     * the database is updated with the new question
     */
    socket.on("addQuestion", (question, answers, quizId) => {
      if (addQuestion(question, answers, db, quizId)) socket.emit("addQuestionSuccess");
      else socket.emit("addQuestionFailure");
    });

    /**
     * @summary When the socket receives a getQuestion signal,
     * the question and answers are fetched from the database
     * and returned to the client socket
     */
    socket.on("getQuestion", (question, quizId) => {
      var getQuestion = getQuestion(question, db, quizId);
      if (getQuestion) socket.emit("getQuestionSuccess", getQuestion);
      else socket.emit("getQuestionFailure");
    });

    /**
     * @summary When the socket receives a getUser signal,
     * the username is fetched from the database and
     * returned to the client socket
     */
    socket.on("getUser", (id) => {
      var user = getUser(id, users);
      if (user) socket.emit("returnUserSuccess", user);
      else socket.emit("returnUserFailure");
    });

    socket.on("start-key-exchange", () => {
      var server_private_key = bigInt(4201337); //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
      var g = bigInt(2579);
      var p = bigInt(5159);
      var server_public_key = g.modPow(server_private_key, p);
      client.emit(
        "server-public",
        Number(server_public_key),
        Number(g),
        Number(p)
      );
    });

    socket.on("client-public", (client_public_key) => {
      var server_private_key = bigInt(4201337); //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
      var g = bigInt(2579);
      var p = bigInt(5159);
      client_public_key = bigInt(client_public_key);
      var shared_key = client_public_key.modPow(server_private_key, p);
    });

    /**
     * @summary emits the current time left to every connected
     * client every second
     */
    setInterval(() => {
      socket.emit("timeLeft", stringifySeconds(counter));
    }, 1000);
  });
}

/**
 * @summary Tries to register a new username. If username or
 * email is busy, register will not be successful and function
 * will return false
 * @param {String} username username of the new user
 * @param {String} password password of the new user
 * @param {String} email email of the new user
 * @param {Database} db database to register user in
 * @returns {Boolean} true if register was successful, false if not
 */
function clientRegister(username, password, email, db) {
  if (!username || !password || !email || !db) return false;
  if (username === "root") return false; //TODO: return something else and emit to user
  //This should only be necessary while testing as the table SHOULD exist already
  const table = db.prepare(
    "CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255))"
  );
  table.run();
  const checkUser = db.prepare(
    "SELECT * FROM users WHERE username = ? OR email = ?"
  );
  var user = checkUser.get(username, email);

  if (user) return false; //If username or email is busy, return false

  const addUser = db.prepare(
    "INSERT INTO users (username, password, email) VALUES (?, ?, ?)"
  ); //resetcode not generated yet
  addUser.run(username, password, email);

  return true;
}

/**
 * @summary logs in a user
 * @param {Database} db database to check user/password against
 * @param {{ID: String, username: String}} users array of all users
 * @param {String} id socket id
 * @returns {Boolean} true if login was successful, false if not
 */
function clientLogin(username, password, db, users, id) {
  if (!username || !password || !db || !users || !id) return "invalid";
  if (username === "root" && password === "rootPass") return "root";

  users.push({ ID: id, username: username });

  const checkUser = db.prepare(
    "SELECT * FROM users WHERE username = ? AND password = ?"
  );
  var user = checkUser.get(username, password);

  if (user) return "valid";
  else return "invalid";
}

/**
 * @summary logs out a user given a socket id
 * @param {String} id socket id 
 * @returns {Boolean} true if client was found, false if not
 */
function clientLogout(id, users) {
  if(!id || !users) return false;

  /* We could use the getUser() function here but we need 
  the index for removing the user from the array */ 
  for (var i = 0; i < users.length; i++) {
    if (users[i].ID === id) {
      users.splice(i, 1);
      return true;
    }
  }
  return false;
}

/**
 * @summary Adds a new question along with it's answers to
 * the database.
 * @param {String} question The question to add
 * @param {[String, String, String, String]} answers An array
 * of strings representing each answer
 * @param {String} quizId id of the quiz
 * @param {Database} db database to add question to
 * @returns {Boolean} true if input is correct, false if not
 */
function addQuestion(question, answers, db, quizId) {
  if (!question || !answers || answers.includes(undefined) || !quizId || !db) return false;
  if (answers.length !== 4) return false;
  if (quizId > 52 || quizId < 1) return false;

  const table = db.prepare(
    "CREATE TABLE IF NOT EXISTS questions (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), wrong3 varchar(255), correct varchar(255), quizId varchar(255))"
  );
  table.run();

  const checkQuestion = db.prepare(
    "SELECT * FROM questions WHERE question = ?"
  );
  var questionExists = checkQuestion.get(question);

  if (questionExists) return false;

  const addQuestion = db.prepare(
    "INSERT INTO questions (question, wrong1, wrong2, wrong3, correct, quizId) VALUES (?, ?, ?, ?, ?, ?)"
  );
  addQuestion.run(question, answers[0], answers[1], answers[2], answers[3], quizId);

  return true;
}

/**
 * @summary Looks up a question in the database and returns
 * the question with it's answers
 * @param {String} question The question to find
 * @param {Database} db database to look up in
 * @returns {{  question: String,
 *              wrong1: String,
 *              wrong2: String,
 *              wrong3: String,
 *              correct: String }}
 */
function getQuestion(question, db, quizId) {
  if (!question || !db) return undefined;
  const table = db.prepare(
    "CREATE TABLE IF NOT EXISTS questions (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), wrong3 varchar(255), correct varchar(255))"
  );
  table.run();
  const getAnswer = db.prepare("SELECT * FROM questions where question = ? AND quizId = ?");

  //This will return undefined if get() does not find any row, which means we don't have to check it manually
  return getAnswer.get(question, quizId);
}

/**
 * @summary Checks in the database if the question is in the
 * database and if the answer matches the correct one
 * @param {String} question The question to check
 * @param {String} answer The answer to check
 * @param {Database} db database to check in
 * @returns {Boolean} true if answer is correct, false if not
 */
function checkAnswer(question, answer, db) {
  if (!question || !answer || !db) return false;

  const checkAnswer = db.prepare(
    "SELECT * FROM questions where question = ? AND correct = ?"
  );
  var correct = checkAnswer.get(question, answer);
  if (correct) {
    return true;
  } else {
    return false;
  }
}

/**
 * Sends an email from TheRealDeal.reset@gmail.com to the
 * specified email
 * @param {String} code code to send
 * @param {String} email email to send to
 * @param {Object} nodemailer node to send email from
 * @throws error if mail is not existent
 */
function sendMail(code, email, nodemailer) {
  if (!code || !email || !nodemailer) return;

  var transporter = nodemailer.createTransport({
    service: "gmail",
    secure: true,
    auth: {
      user: "TheRealDeal.reset@gmail.com",
      pass: "Brf5mBLxAw5LZg2h",
    },
  });

  var mailOptions = {
    from: "TheRealDeal.reset@gmail.com",
    to: email,
    subject: "Password Reset",
    text: `Hello!\n\nWe wanted to let you know that your password in the Real Deal has been reset.\nHere is your reset code: ${code}\nIf you did not perform this action, please reset your password in the Real Deal application.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.log(error);
    else console.log(info);
  });
}

/**
 * Generates a pseudo-random string of letters
 * @param {String} length length of the string
 * @returns {String} pseudo-random string or undefined if
 * length is 0
 */
function generateCode(length) {
  if (length == 0) return undefined;
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    //Might give non integer value, so we floor the value
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

/**
 * @summary Inserts a resetcode in the database for a user
 * given an email
 * @param {String} code resetcode to insert
 * @param {String} email email of the user
 * @param {Database} db database to add code to
 */
function insertCode(code, email, db) {
  if (!code || !email || !db) return;

  const insertCode = db.prepare(
    `UPDATE users SET resetcode = ? WHERE email = ?`
  );
  insertCode.run(code, email);
}

/**
 * @summary Checks if a resetcode matches a given email in
 * the database
 * @param {String} code resetcode to test
 * @param {String} email email to test the code with
 * @param {Database} db database to check code against
 * @returns {Boolean} true if code matches, false if not
 */
function checkCode(code, email, db) {
  if (!code || !email || !db) return false;

  const checkCode = db.prepare(
    `SELECT * FROM users WHERE resetcode = ? AND email = ?`
  );
  var user = checkCode.get(code, email);
  if (user) {
    return true;
  } else {
    return false;
  }
}

/**
 * @summary Updates the password for a user with a given email
 * @param {String} password password of the user
 * @param {String} email email of the user
 * @param {Database} db database to update password in
 * @return {Boolean} true if password, email and database is valied, false
 * if not
 */
function updatePassword(password, email, db) {
  if (!password || !email || !db) return false;

  const updatePassword = db.prepare(
    `UPDATE users SET password = ? WHERE email = ?`
  );
  updatePassword.run(password, email);

  return true;
}

/**
 * @summary Checks if an email exists in the database
 * @param {String} email email to check
 * @param {Database} db database to check mail against
 * @returns {Boolean} true if email exists, false if not
 */
function checkMail(email, db) {
  if (!email || !db) return false;

  const checkMail = db.prepare(`SELECT * FROM users WHERE email = ?`);
  var mail = checkMail.get(email);
  return mail !== undefined;
}

/**
 * @summary This code is ran every 1000ms and counts down
 * from 604800 seconds down to 0
 */
var counter = 604800;
var countDown = setInterval(function () {
  counter--;
  if (counter === 0) {
    counter = 604800;
    //TODO: Send question to clients
    //TODO: Reset questions table
    console.log("counter done");
    clearInterval(countDown);
  }
}, 1000);

/**
 * @summary Converts seconds to days, hours, minutes and
 * seconds
 * @param {String} counter seconds to convert to string
 * @returns {String} "stringified" seconds
 */
function stringifySeconds(counter) {
  var day = 86400; //A day in seconds
  var hour = 3600; //An hour in seconds
  var minute = 60; //A minute in seconds
  // Figure out better solution for calculating this.
  days = Math.floor(counter / day);
  hours = Math.floor((counter % day) / hour);
  minutes = Math.floor(((counter % day) % hour) / minute);
  seconds = Math.floor(((counter % day) % hour) % minute);
  return (
    "days: " +
    days +
    " hours: " +
    hours +
    " minutes: " +
    minutes +
    " seconds: " +
    seconds
  );
}

/**
 * @summary Gets the username for a given socket id
 * @param {String} id id of the socket
 * @param {{ID: String, username: String}} users array of all users
 * @returns {String} username for the given socket id or undefined
 * if it can't find the user
 */
function getUser(id, users) {
  if (!id || !users) return undefined;

  for (user of users) {
    if (user.ID === id) {
      return user.username;
    }
  }
  return undefined;
}

/* The comment below is for the jest testing framework to ignore
the following code statement */
/* istanbul ignore next */
if (require.main === module) {
  main();
}

exports.clientLogin = clientLogin;
exports.clientRegister = clientRegister;
exports.clientLogout = clientLogout;
exports.addQuestion = addQuestion;
exports.getQuestion = getQuestion;
exports.checkAnswer = checkAnswer;
exports.sendMail = sendMail;
exports.checkMail = checkMail;
exports.insertCode = insertCode;
exports.checkCode = checkCode;
exports.updatePassword = updatePassword;
exports.generateCode = generateCode;
exports.stringifySeconds = stringifySeconds;
exports.getUser = getUser;
