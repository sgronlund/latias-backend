var app = require('express')('192.168.0.104');
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
    console.log("new client connected " + socket.id);
    socket.emit('connection');
    socket.on('register', (username, password, email) => {
        if(clientRegister(username, password, email)) {
            socket.emit('registerSuccess');
            console.log("Register successful");
        } else {
            socket.emit('registerFailure');
            console.log("Register failed");
        }
    });
    socket.on('login', (username, password) => {
        if(clientLogin(username, password)) {
            socket.emit('loginSuccess');
            console.log("Login successful");
        } else {
            socket.emit('loginFailure');
            console.log("Login failed");
        }
    });
    
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
        console.log("login funkade, skaffa keys")
        var server_private_key = 3; //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
        var g = 2579; //TODO: Change me
        var p = 5159; //TODO: Change me
        var server_public_key = (g**server_private_key) % p;
        client.emit('server-public', server_public_key, g, p);
    });
    socket.on('client-public',(client_public_key) => {
        var server_private_key = 3; //TODO bättre keys här. randomizeade, helst 256 bit nummer läste jag på google
        
        var g = 2579; //TODO: Change me
        var p = 5159; //TODO: Change me
        var server_public_key = (g**server_private_key) % p;
        var shared_key = (client_public_key**server_private_key) % p;
        console.log("SHARED = " + shared_key);
    });
});

function clientRegister(username, password, email) {
    const table = db.prepare('CREATE TABLE IF NOT EXISTS login (username varchar(255), password varchar(255), email varchar(255))');
    table.run();

    const checkUser = db.prepare('SELECT * FROM login WHERE username = ? OR email = ?');
    var user = checkUser.get(username, email);

    if(user !== undefined) return false; //If username is busy, return false

    const addUser = db.prepare('INSERT INTO login (username, password, email) VALUES (?, ?, ?)');
    addUser.run(username, password, email);

    return true;
}

function clientLogin(username, password) {
    const table = db.prepare('CREATE TABLE IF NOT EXISTS login (username varchar(255), password varchar(255), email varchar(255))');
    table.run();
    const checkUser = db.prepare('SELECT * FROM login WHERE username = ? AND password = ?');
    var user = checkUser.get(username, password);

    return user !== undefined;
}

function addQuestion(question, answers) {
    if(answers.length !== 4) return;
    const table = db.prepare('CREATE TABLE IF NOT EXISTS questions (question varchar(255), A1 varchar(255), A2 varchar(255), A3 varchar(255), A4 varchar(255))');
    table.run();

    const addQuestion = db.prepare('INSERT INTO questions (question, A1, A2, A3, A4) VALUES (?, ?, ?, ?, ?)');
    addQuestion.run(question, answers[0], answers[1], answers[2], answers[3]);
}


function sendMail(code) {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'TheRealDeal.reset@gmail.com',
          pass: 'Brf5mBLxAw5LZg2h'
        }
      });
      
      var mailOptions = {
        from: 'TheRealDeal.reset@gmail.com',
        to: 'jakob.paulsson123@gmail.com', //Plz don't spam me
        subject: 'Password Reset',
        text: code
      };
      
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
        } else {
          console.log('Email sent: ' + info.response);
        }
      });
}
