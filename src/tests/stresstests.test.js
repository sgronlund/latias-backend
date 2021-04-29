const { createServer } = require("http");
const { express } = require("express")();
const backend = require("../backend");
const faker = require("faker/locale/en_US");
const Client = require("socket.io-client");
const Database = require("better-sqlite3");

describe("Stress testing", () => {
  let io, serverSocket, clientSocket, db, users;

  beforeAll((done) => {
    db = new Database("./tests/db_for_stress_test.db");
    const table = db.prepare(
      "CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255), score INT)"
    );
    table.run();
    const httpServer = createServer(express);
    io = require("socket.io")(httpServer, { cors: { origin: "*" } });
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      io.on("connection", (socket) => {
        serverSocket = socket;
      });
      clientSocket.on("connect", done);
    });
    users = [];
  });

  afterEach(async (done) => {
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS questions").run();
    users = [];
    done();
  });

  afterAll(async () => {
    await io.close();
    await clientSocket.close();
  });

  test("Test register random users 10000 times", async (done) => {
    serverSocket.on("stress", (user, pass, email, index) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeTruthy();
      if (index === 1000) {
        done();
      }
    });
    for (var i = 0; i <= 1000; i++) {
      var name = faker.internet.userName() + i + faker.random.alphaNumeric(8);
      var pass = faker.internet.password() + i;
      var mail =
        faker.random.alphaNumeric(8) + i + faker.internet.exampleEmail();
      clientSocket.emit("stress", name, pass, mail, i);
    }
  }, 50000);
});
