
let users = [];
var backend = require('./backend')
var app = require("express")();
var nodemailer = require("nodemailer");
var bigInt = require("big-integer");

const Database = require("better-sqlite3");
const db = new Database("database.db", { verbose: console.log });
db.prepare("CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255))").run();

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
    if (backend.clientRegister(username, password, email, db))
      socket.emit("registerSuccess");
    else socket.emit("registerFailure");
  });

  /**
   * @summary When the socket receives a login signal,
   * the username and password is checked and a
   * corresponding success/fail message is sent
   */
  socket.on("login", (username, password) => {
    if (backend.clientLogin(username, password, db, users, socket.id) === "valid")
      socket.emit("loginSuccess");
    else if (backend.clientLogin(username, password, db, users, socket.id) === "root")
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
    if (backend.clientLogout(socket.id, users) === true) socket.emit("logoutSuccess");
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
  socket.on("updatePass", (email, password) => {
    if (backend.updatePassword(password, email, db)) socket.emit("updatePassSuccess");
    else socket.emit("updatePassFailure");
  });

  /**
   * @summary When the socket receives an addQuestion signal,
   * the database is updated with the new question
   */
  socket.on("addQuestion", (question, answers, weekNumber) => {
    if (backend.addQuestion(question, answers, db, weekNumber)) socket.emit("addQuestionSuccess");
    else socket.emit("addQuestionFailure");
  });

  /**
   * @summary When the socket receives a getQuestion signal,
   * the question and answers are fetched from the database
   * and returned to the client socket
   */
  socket.on("getQuestion", (question, weekNumber) => {
    var getQuestion = backend.getQuestion(question, db, weekNumber);
    if (getQuestion) socket.emit("getQuestionSuccess", getQuestion);
    else socket.emit("getQuestionFailure");
  });

  /**
     * @summary When the socket receives a getQuestions signal,
     * all questions with the given weekNumber are returned and 
     * emitted to the client socket
     */
   socket.on("getQuestions", (weekNumber) => {
    var questions = backend.getQuestions(db, weekNumber);
    if (questions) socket.emit("getQuestionsSuccess", questions);
    else socket.emit("getQuestionsFailure");
  })

  /**
   * @summary resets all questions for a given week number
   */
  socket.on("resetQuestions", (weekNumber) => {backend.resetQuestions(db, weekNumber)})

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
   * @summary emits the current time left to every connected
   * client every second
   */
  setInterval(() => {
    socket.emit("timeLeft", backend.stringifySeconds(counter));
  }, 1000);
});
