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
    // If the socket receives submit from a client, add submitted
    // username and password to the database
    socket.on('register', (username, password) => {clientRegister(username, password);});
    socket.on('login', (username, password) => {
        if(clientLogin(username, password)) {
            socket.emit('success');
            console.log("Login successful");
        } else {
            socket.emit('failure');
            console.log("Login failed");
        }
    });
});

function clientRegister(username, password) {
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username varchar(255), password varchar(255))');
    table.run();

    const checkUser = db.prepare('SELECT * FROM users WHERE username = ?');
    var user = checkUser.get(username);

    if(user !== undefined) {return console.log("\nUsername is busy!")}
    
    const addUser = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    addUser.run(username, password);
}

function clientLogin(username, password) {
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username varchar(255), password varchar(255))');
    table.run();

    const checkUser = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    var user = checkUser.get(username, password);

    return user !== undefined;
}