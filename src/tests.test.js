const { createServer } = require("http");
const { express } = require("express")("192.168.0.104")
const backend = require("./server");
const faker = require("faker");
const Client = require("socket.io-client");
const Database = require('better-sqlite3');

describe("Test Suite for Server", () => {
  let io, serverSocket, clientSocket, db;


  beforeAll((done) => {
    db = new Database('db_for_test.db', { verbose: console.log });
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255))');
    table.run();
    const httpServer = createServer(express);
    io = require('socket.io')(httpServer, {cors: {origin:"*"}});
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://192.168.0.104:${port}`);
      io.on("connection", (socket) => {
        serverSocket = socket;
      });
      clientSocket.on("connect", done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    db.prepare("DROP TABLE IF EXISTS users")
  });

  test("Login in with faulty user fails", (done) => {
    serverSocket.on("login", (user, pass) => {
      expect(backend.clientLogin(user, pass, db)).toBeFalsy();
      done();
    });
    var usr = faker.internet.userName();
    var pass = faker.internet.password();
    clientSocket.emit("login", usr, pass);
  });

  test("Login in with wrong password for registered user", (done) => {
    serverSocket.on("login", (user, pass) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeTruthy();
      expect(backend.clientLogin(user, "wrongpasswordihope", db)).toBeFalsy();
      done();
    });
    var usr = faker.internet.userName();
    var pass = faker.internet.password();
    var email = faker.internet.exampleEmail();
    clientSocket.emit("login", usr, pass, email);
  });
});