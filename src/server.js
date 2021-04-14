function main() {
    var app = require('express')();
    var nodemailer = require('nodemailer');
    var bigInt = require('big-integer');
    
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
            if(clientRegister(username, password, email, db)) socket.emit('registerSuccess');
            else socket.emit('registerFailure');
        });

        /**
         * @summary When the socket receives a login signal,
         * the username and password is checked and a
         * corresponding success/fail message is sent
         */
        socket.on('login', (username, password) => {
            if(clientLogin(username, password, db) === "valid") socket.emit('loginSuccess');
            else if(clientLogin(username, password, db) === "root") socket.emit('loginRoot');
            else socket.emit('loginFailure');
        });

        /**
         * @summary When the socket receives a resetPass signal,
         * the mail is checked in the database and a corresponding 
         * success/fail message is sent. If successful, a code is
         * sent to the mail
         */
        socket.on('resetPass', (email) => {
            if(checkMail(email, db)) { 
                var code = generateCode(8);
                insertCode(code, email, db);
                sendMail(code, email, nodemailer);
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
            if(checkCode(code, email, db)) socket.emit('codeSuccess');
            else socket.emit('codeFailure');
        })

        /**
         * @summary When the socket receives an updatePass signal,
         * the users password is updated with the received password
         */
        socket.on('updatePass', (email, password) => {
            if(updatePassword(password, email, db)) socket.emit("updatePassSuccess");
            else socket.emit("updatePassFailure");
        });

        socket.on('addQuestion', (question, answers) => {
            if(!addQuestion(question, answers, db)) socket.emit("questionFailure");
        })
        
        //TODO måste ha unika private och public keys för varje client. 
        /*
            var clients = [];
            var private_keys = [];
            var public_keys = [];

            Dessa måste pushas med ny info direkt när en ny client connectar.

            Möjligt problem med detta är att vi connectar så ofta, typ varje gång vi gör nånting. Vet inte 
            hur socket beter sig när man connectar två gånger från samma client men olika sockets
        */

        socket.on('start-key-exchange', () => {
            var server_private_key = bigInt(4201337); //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
            var g = bigInt(2579);
            var p = bigInt(5159);
            var server_public_key = g.modPow(server_private_key,p);
            client.emit('server-public', Number(server_public_key), Number(g), Number(p));
        });
        socket.on('client-public',(client_public_key) => {
            var server_private_key = bigInt(4201337); //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
            var g = bigInt(2579);
            var p = bigInt(5159);
            client_public_key = bigInt(client_public_key);
            var shared_key = client_public_key.modPow(server_private_key,p);
        });


        /**
         * @summary emits the current time left to every connected
         * client every second
         */
        setInterval(() =>{
            socket.emit("timeLeft", stringifySeconds(counter))
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
 * @returns true if register was successful, false if not
 */
function clientRegister(username, password, email, db) {
    if(!username || !password || !email || !db) return false;
    if(username === "root") return false; //TODO: return something else and emit to user
    //This should only be necessary while testing as the table SHOULD exist already
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255))');
    table.run();
    const checkUser = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
    var user = checkUser.get(username, email);
  
    if(user) return false; //If username or email is busy, return false
  
    const addUser = db.prepare('INSERT INTO users (username, password, email) VALUES (?, ?, ?)'); //resetcode not generated yet
    addUser.run(username, password, email);
    
    return true;
}

/** 
 * @param {Database} db database to check user/password against
 * @returns true if login was successful, false if not
 */
function clientLogin(username, password, db) {
    if(!username || !password || !db) return "invalid";

    if(username === "root" && password === "rootPass") {
        return "root";
    }

    const checkUser = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    var user = checkUser.get(username, password);

    if(user) return "valid";
    else return "invalid";
}

 * @summary Adds a new question along with it's answers to
 * the database.
 * @param {String} question The question to add
 * @param {[String, String, String, String]} answers An array
 * @param {Database} db database to add question to
 * of answers to add 
 * @returns true if input is correct, false if not
 */
function addQuestion(question, answers, db) {
    if(!question || !answers || !db) return false;
    if(answers.length !== 4) return false;

    const table = db.prepare('CREATE TABLE IF NOT EXISTS questions (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), wrong3 varchar(255), correct varchar(255))');
    table.run();

    const addQuestion = db.prepare('INSERT INTO questions (question, wrong1, wrong2, wrong3, correct) VALUES (?, ?, ?, ?, ?)');
    addQuestion.run(question, answers[0], answers[1], answers[2], answers[3]);

    return true;
}

/**
 * @summary Checks in the database if the question is in the
 * database and if the answer matches the correct one
 * @param {String} question The question to check
 * @param {String} answer The answer to check 
 * @param {Database} db database to check in
 * @returns true if answer is correct, false if not
 */
function checkAnswer(question, answer, db) {
    if(!question || !answer || !db) return false;

    const checkAnswer = db.prepare('SELECT * FROM questions where question = ? AND correct = ?');
    var correct = checkAnswer.get(question, answer);
    if(correct) {
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
    if(!code || !email || !nodemailer) return;

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
 * @returns pseudo-random string or undefined if
 * length is 0
 */
function generateCode(length) {
    if(length == 0) return undefined;
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
 * @param {Database} db database to add code to
 */
function insertCode(code, email, db) {
    if(!code || !email || !db) return;

    const insertCode = db.prepare(`UPDATE users SET resetcode = ? WHERE email = ?`);
    insertCode.run(code, email);
}

/**
 * @summary Checks if a resetcode matches a given email in
 * the database
 * @param {String} code resetcode to test 
 * @param {String} email email to test the code with
 * @param {Database} db database to check code against
 * @returns true if code matches, false if not
 */
function checkCode(code, email, db) {
    if(!code || !email || !db) return false;

    const checkCode = db.prepare(`SELECT * FROM users WHERE resetcode = ? AND email = ?`);
    var user = checkCode.get(code, email);
    if(user) {
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
 * @return true if password, email and database is valied, false
 * if not
 */
function updatePassword(password, email, db) {
    if(!password || !email || !db) return false;

    const updatePassword = db.prepare(`UPDATE users SET password = ? WHERE email = ?`);
    updatePassword.run(password, email);

    return true;
}

/**
 * @summary Checks if an email exists in the database
 * @param {String} email email to check
 * @param {Database} db database to check mail against
 * @returns true if email exists, false if not
 */
function checkMail(email, db) {
    if(!email || !db) return false;

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
        counter = 604800
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

if(require.main === module) {
    main();
}

exports.clientLogin = clientLogin
exports.clientRegister = clientRegister
exports.addQuestion = addQuestion
exports.checkAnswer = checkAnswer
exports.checkMail = checkMail
exports.insertCode = insertCode
exports.checkCode = checkCode
exports.updatePassword = updatePassword
exports.generateCode = generateCode
exports.stringifySeconds = stringifySeconds