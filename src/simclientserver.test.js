const { createServer } = require("http");
const { express } = require("express")("192.168.0.104")
const backend = require("./server");
const faker = require("faker/locale/en_US");
const Client = require("socket.io-client");
const Database = require('better-sqlite3');

describe("Test Suite for Server", () => {
  let io, serverSocket, clientSocket, db;


  beforeAll((done) => {
    db = new Database('db_for_test.db');
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

  afterAll(async () => {
    await io.close();
    await clientSocket.close();
    const query = db.prepare("DROP TABLE IF EXISTS users");
    query.run();
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

/**
 * Running the test which check if faulty input is handled together makes them fail?????????????????????
 */

  test("Login in with wrong password for registered user", (done) => {
    serverSocket.on("login", (user, pass, email) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeTruthy();
      expect(backend.clientLogin(user, "wrongpasswordihope", db)).toBeFalsy();
      done();
    });
    //clientSocket.emit("login", faker.internet.userName(), faker.internet.password(), faker.internet.exampleEmail());
    clientSocket.emit("login", "masterquizzer", "thecorrectpassword", "user@email.com")
  });

  test("Login in with wrong user for registered user", (done) => {
    // Kör själv och passar
    serverSocket.on("login", (user, pass, email) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeTruthy();
      expect(backend.clientLogin("wrongusernameihope", pass, db)).toBeFalsy();
      done();
    });
    ///clientSocket.emit("login", faker.internet.userName(), faker.internet.password(), faker.internet.exampleEmail());
    clientSocket.emit("login", "arealuser", "userpassword", "user@email.com")
  });


  test("Test register with username, password and email as null", (done) => {
    serverSocket.on("login", (user, pass, email) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeFalsy();
      done();
      
    });
    clientSocket.emit("login");
  });

  test("Test register with username, password and email as empty", (done) => {
    serverSocket.on("login", (user, pass, email) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeFalsy();
      done();
    });
    clientSocket.emit("login", "", "", "");
  });
});