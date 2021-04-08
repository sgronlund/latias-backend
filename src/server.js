var app = require('express')('192.168.1.150');

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
    socket.on('register', (username, password) => {
        if(clientRegister(username, password)) {
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
});

function clientRegister(username, password) {
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username varchar(255), password varchar(255))');
    table.run();

    const checkUser = db.prepare('SELECT * FROM users WHERE username = ?');
    var user = checkUser.get(username);

    if(user !== undefined) return false; //If username is busy, return false

    const addUser = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    addUser.run(username, password);

    return true;
}

function clientLogin(username, password) {
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username varchar(255), password varchar(255))');
    table.run();

    const checkUser = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
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