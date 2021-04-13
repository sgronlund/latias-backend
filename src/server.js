var app = require('express')();
var nodemailer = require('nodemailer');

const Database = require('better-sqlite3');
const db = new Database('database.db', { verbose: console.log });

/** 
 * CORS is a mechanism which restricts us from hosting both the client and the server.
 * The package cors allows us the bypass this
 * */ 
var cors = require('cors');
app.use(cors());

/// Creates an HTTP server using ExpressJS
var http = require('http').createServer(app);
const PORT = 8080;
/// The cors: ... is also required to bypass the restriction stated above
var client = require('socket.io')(http, {cors: {origin:"*"}});

/// Starts listening on the chosen port
http.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});

/**
 * @summary Determines the behaviour for when 
 * a client connects to our socket.
 */
client.on('connection', (socket) => {
    console.log("new client connected");
    socket.emit('connection');

    /**
     * @summary When the socket receives a register signal,
     * the username, password and email is checked and a
     * corresponding success/fail message is sent
     */
    socket.on('register', (username, password, email) => {
        if(clientRegister(username, password, email)) socket.emit('registerSuccess');
        else socket.emit('registerFailure');
    });

    /**
     * @summary When the socket receives a login signal,
     * the username and password is checked and a
     * corresponding success/fail message is sent
     */
    socket.on('login', (username, password) => {
        if(clientLogin(username, password)) socket.emit('loginSuccess');
        else socket.emit('loginFailure');
    });

    /**
     * @summary When the socket receives a resetPass signal,
     * the mail is checked in the database and a corresponding 
     * success/fail message is sent. If successful, a code is
     * sent to the mail
     */
    socket.on('resetPass', (email) => {
        if(checkMail(email)) { 
            var code = generateCode(8);
            insertCode(code, email);
            sendMail(code, email);
            socket.emit('emailSuccess');
        } else {
            socket.emit('emailFailure');       
        }
    })

    /**
     * @summary When the socket receives a submitCode signal,
     * the code and email is checked against the database and
     * a corresponding success/fail message is sent.
     */
    socket.on('submitCode', (code, email) => {
        if(checkCode(code, email)) socket.emit('codeSuccess');
        else socket.emit('codeFailure');
    })

    /**
     * @summary When the socket receives an updatePass signal,
     * the users password is updated with the received password
     */
    socket.on('updatePass', (email, password) => {updatePassword(password, email)});
    
    /**
     * @summary emits the current time left to every connected
     * client every second
     */
    setInterval(() =>{
        socket.emit("timeLeft", stringifySeconds(counter))
    }, 1000);
});

/**
 * @summary Tries to register a new username. If username or
 * email is busy, register will not be successful
 * @param {String} username username of the new user
 * @param {String} password password of the new user
 * @param {String} email email of the new user
 * @returns true if register was successful, false if not
 */
function clientRegister(username, password, email) {
    //This should only be necessary while testing as the table SHOULD exist already
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255))');
    table.run();

    const checkUser = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    var user = checkUser.get(username, email);

    if(user !== undefined) return false; //If username is busy, return false

    const addUser = db.prepare('INSERT INTO users (username, password, email) VALUES (?, ?, ?)'); //resetcode not generated yet
    addUser.run(username, password, email);

    return true;
}

/**
 * @summary Tries to login a user. If the username or
 * password does not match any user in the database, the
 * login will not be successful.
 * @param {String} username username of the user logging in
 * @param {String} password password of the user logging in
 * @returns true if login was successful, false if not
 */
function clientLogin(username, password) {
    const checkUser = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    var user = checkUser.get(username, password);

    return user !== undefined;
}

/**
 * @summary Adds a new question along with it's answers to
 * the database.
 * @param {String} question The question to add
 * @param {[String, String, String, String]} answers An array
 * of answers to add 
 */
function addQuestion(question, answers) {
    if(answers.length !== 4) return;
    const table = db.prepare('CREATE TABLE IF NOT EXISTS questions (question varchar(255), A1 varchar(255), A2 varchar(255), A3 varchar(255), A4 varchar(255))');
    table.run();

    const addQuestion = db.prepare('INSERT INTO questions (question, A1, A2, A3, A4) VALUES (?, ?, ?, ?, ?)');
    addQuestion.run(question, answers[0], answers[1], answers[2], answers[3]);
}

/**
 * Sends an email from TheRealDeal.reset@gmail.com to the
 * specified email
 * @param {String} code code to send
 * @param {String} email email to send to
 * @throws error if mail is not existent
 */
function sendMail(code, email) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'TheRealDeal.reset@gmail.com',
          pass: 'Brf5mBLxAw5LZg2h'
        }
      });
      
      var mailOptions = {
        from: 'TheRealDeal.reset@gmail.com',
        to: email,
        subject: 'Password Reset',
        text: `Hello!\n\nWe wanted to let you know that your password in the Real Deal has been reset.\nHere is your reset code: ${code}\nIf you did not perform this action, please reset your password in the Real Deal application.`
      };
      
      transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log(error);
            else console.log(info);
      });
}

/**
 * Generates a pseudo-random string of letters
 * @param {String} length length of the string
 * @returns pseudo-random string
 */
function generateCode(length) {
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for ( let i = 0; i < length; i++ ) {
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
 */
function insertCode(code, email) {
    const insertCode = db.prepare(`UPDATE users SET resetcode = ? WHERE email = ?`);
    insertCode.run(code, email);
}

/**
 * @summary Checks if a resetcode matches a given email in
 * the database
 * @param {String} code resetcode to test 
 * @param {String} email email to test the code with
 * @returns true if code matches, false if not
 */
function checkCode(code, email) {
    const checkCode = db.prepare(`SELECT * FROM users WHERE resetcode = ? AND email = ?`);
    var user = checkCode.get(code, email);
    return user !== undefined;
}

/**
 * @summary Updates the password for a user with a given email
 * @param {String} password password of the user 
 * @param {String} email email of the user
 */
function updatePassword(password, email) {
    const updatePassword = db.prepare(`UPDATE users SET password = ? WHERE email = ?`);
    updatePassword.run(password, email);
}

/**
 * @summary Checks if an email exists in the database
 * @param {String} email email to check
 * @returns true if email exists, false if not
 */
function checkMail(email) {
    const checkMail = db.prepare(`SELECT * FROM users WHERE email = ?`);
    var mail = checkMail.get(email);
    return mail !== undefined;
}

/**
 * @summary This code is ran every 1000ms and counts down
 * from 604800 seconds down to 0
 */
var counter = 604800;
var countDown = setInterval(function(){
    counter--;
    if (counter === 0) {
        //TODO: when counter is done, open up the quiz!
        console.log("counter done");
        clearInterval(countDown);
    }
}, 1000);

/**
 * @summary Converts seconds to days, hours, minutes and
 * seconds
 * @param {String} counter seconds to convert to string
 * @returns "stringified" seconds
 */
function stringifySeconds(counter) {
    var day = 86400; //A day in seconds
    var hour = 3600; //An hour in seconds
    var minute = 60; //A minute in seconds
    // Figure out better solution for calculating this.
    days = Math.floor(counter/day);
    hours = Math.floor((counter%day)/hour);
    minutes = Math.floor(((counter%day)%hour)/minute)
    seconds = Math.floor(((counter%day)%hour)%minute);
    return "days: " + days + " hours: " + hours + " minutes: " + minutes + " seconds: " + seconds;
}