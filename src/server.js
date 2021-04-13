function main() {
    var app = require('express')("192.168.0.104");
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

    /// Determines the behaviour for when a client connects to our socket.
    client.on('connection', (socket) => {
        console.log("new client connected");
        socket.emit('connection');
        socket.on('register', (username, password, email) => {
            if(clientRegister(username, password, email, db)) socket.emit('registerSuccess');
            else socket.emit('registerFailure');
        });
        socket.on('login', (username, password) => {
            if(clientLogin(username, password, db)) socket.emit('loginSuccess');
            else socket.emit('loginFailure');
        });
        socket.on('resetPass', (email) => {
            if(checkMail(email)) { 
                var code = generateCode(8);
                insertCode(code, email, db);
                sendMail(code, email, db);
                socket.emit('emailSuccess');
            } else {
                socket.emit('emailFailure');       
            }
        })
        socket.on('submitCode', (code, email) => {
            if(checkCode(code, email, db)) socket.emit('codeSuccess');
            else socket.emit('codeFailure');
        })
        socket.on('updatePass', (email, password) => {updatePassword(password, email)})
    });
}
function clientRegister(username, password, email, db) {
    if (username && password && email && db) {
        //This should only be necessary while testing as the table SHOULD exist already
        const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username TINYTEXT, password TINYTEXT, email TINYTEXT, resetcode TINYTEXT, points INT)');
        table.run();

        const checkUser = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?');
        var user = checkUser.get(username, email);

        if(user) return false; //If username is busy, return false

        const addUser = db.prepare('INSERT INTO users (username, password, email) VALUES (?, ?, ?)'); //resetcode not generated yet
        addUser.run(username, password, email);

        return true;
    } else {
        return false;
    }
}

function clientLogin(username, password, db) {
    if(username && password && db) {
        const checkUser = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
        var user = checkUser.get(username, password);
        if(user) {
            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
}

function addQuestion(question, answers, db) {
    if(answers.length !== 4) return;
    // TODO: Might need to change the datatype here since 255 characters might be to short for a question
    const table = db.prepare('CREATE TABLE IF NOT EXISTS questions (question TINYTEXT, A1 TINYTEXT, A2 TINYTEXT, A3 TINYTEXT, A4 TINYTEXT)');
    table.run();

    const addQuestion = db.prepare('INSERT INTO questions (question, A1, A2, A3, A4) VALUES (?, ?, ?, ?, ?)');
    addQuestion.run(question, answers[0], answers[1], answers[2], answers[3]);
}


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

function generateCode(length) {
    const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for ( let i = 0; i < length; i++ ) {
        //Might give non integer value, so we floor the value
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return result;
}

function insertCode(code, email, db) {
    const insertCode = db.prepare(`UPDATE users SET resetcode = ? WHERE email = ?`);
    insertCode.run(code, email);
}

function checkCode(code, email, db) {
    const checkCode = db.prepare(`SELECT * FROM users WHERE resetcode = ? AND email = ?`);
    var user = checkCode.get(code, email);
    if(user) {
        return true;
    } else {
        return false;
    }
}

function updatePassword(password, email, db) {
    const updatePassword = db.prepare(`UPDATE users SET password = ? WHERE email = ?`);
    updatePassword.run(password, email);
}

function checkMail(email, db) {
    const checkMail = db.prepare(`SELECT * FROM users WHERE email = ?`);
    var mail = checkMail.get(email);
    return mail !== undefined;
}

if(require.main === module) {
    main();
}

exports.clientLogin = clientLogin
exports.clientRegister = clientRegister
exports.addQuestion = addQuestion
exports.checkMail = checkMail
exports.insertCode = insertCode
exports.checkCode = checkCode
exports.updatePassword = updatePassword
exports.generateCode = generateCode