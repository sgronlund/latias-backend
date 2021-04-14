const { createServer } = require("http");
const { express } = require("express")();
const backend = require("./server");
const faker = require("faker/locale/en_US");
const Client = require("socket.io-client");
const Database = require('better-sqlite3');

describe("Test Suite for Server", () => {
  let io, serverSocket, clientSocket, db, users, httpServer;

  beforeAll((done) => {
    db = new Database('db_for_test.db');
    const table = db.prepare('CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255))');
    table.run();
    httpServer = createServer(express);
    io = require('socket.io')(httpServer, {cors: {origin:"*"}});
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
  

  test("Login in with faulty user fails", (done) => {
    serverSocket.on("faultyUser", (user, pass, id, users) => {
      const bool = backend.clientLogin(user, pass, db, users, id)
      expect(bool).toBe("invalid");
      done();
    });
    var usr = faker.internet.userName();
    var pass = faker.internet.password();
    clientSocket.emit("faultyUser", usr, pass, clientSocket.id, users);
  });

  test("Login in with wrong password for registered user", (done) => {
    serverSocket.on("wrongPass", (user, pass, email, id, users) => {
      const register = backend.clientRegister(user, pass, email, db)
      expect(register).toBeTruthy();
      expect(backend.clientLogin(user, "wrongpasswordihope", db, users, id)).toBe("invalid");
      done();
    });
    clientSocket.emit("wrongPass", faker.internet.userName(), faker.internet.password(), faker.internet.exampleEmail(), clientSocket.id, users);
  });

  test("Login in with wrong user for registered user", (done) => {
    serverSocket.on("wrongUser", (user, pass, email, id, users) => {
      const register = backend.clientRegister(user, pass, email, db)
      expect(register).toBeTruthy();
      expect(backend.clientLogin("wrongusernameihope", pass, db, users, id)).toBe("invalid");
      done();
    });
    clientSocket.emit("wrongUser", faker.internet.userName(), faker.internet.password(), faker.internet.exampleEmail(), clientSocket.id, users);
  });

  test("Register user and log in", (done) => {
    serverSocket.on("validUser", (user, pass, email, id, users) => {
      const register = backend.clientRegister(user, pass, email, db)
      expect(register).toBeTruthy();
      expect(backend.clientLogin(user, pass, db, users, id)).toBe("valid");
      done();
    });
    clientSocket.emit("validUser", faker.internet.userName(), faker.internet.password(), faker.internet.exampleEmail(), clientSocket.id, users);
  });
 
  test("Login as root", (done) => {
    serverSocket.on("loginRoot", (user, pass, id, users) => {
      expect(backend.clientLogin(user, pass, db, users, id)).toBe("root");
      done();
    });
    clientSocket.emit("loginRoot", "root", "rootPass", clientSocket.id, users);
  });

  test("Register root", (done) => {
    serverSocket.on("registerRoot", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db)
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit("registerRoot", "root", faker.internet.password(), faker.internet.exampleEmail());
  });

  test("Register with username, password and email as null", (done) => {
    serverSocket.on("detailsNull", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db)
      expect(register).toBeFalsy();
      done();
      
    });
    clientSocket.emit("detailsNull");
  });

  test("Register with username, password and email as empty", (done) => {
    serverSocket.on("detailsEmpty", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db)
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit("detailsEmpty", "", "", "");
  });

  test("Add question with question and answer as null", (done) => {
    serverSocket.on("addQuestionNull", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db)
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionNull");
  });

  test("Add question with empty array", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db)
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION" , []);
  });

  test("Add question with too short answer array", (done) => {
    serverSocket.on("addQuestionShort", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db)
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionShort", "QUESTION" , ["A","B","C"]);
  });

  test("Add question and check for it's existence", (done) => {
    serverSocket.on("addQuestionExistence", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db)
      expect(operation).toBeTruthy();
      done();
    });
    clientSocket.emit("addQuestionExistence", "QUESTION", ["FALSE1","FALSE2","FALSE3","CORRECT"]);
  });

  test("Add question and check with correct answer", (done) => {
    serverSocket.on("addQuestionCheck", (question, answers) => {
      backend.addQuestion(question, answers, db);
      const check = backend.checkAnswer("QUESTION","CORRECT", db);
      expect(check).toBeTruthy();
      done();
    });
    clientSocket.emit("addQuestionCheck", "QUESTION", ["FALSE1","FALSE2","FALSE3","CORRECT"]);
  });

  test("Add question and check with wrong answer", (done) => {
    serverSocket.on("addQuestionCheck", (question, answers) => {
      backend.addQuestion(question, answers, db);
      const check = backend.checkAnswer("QUESTION","FALSE1", db);
      expect(check).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionCheck", "QUESTION", ["FALSE1","FALSE2","FALSE3","CORRECT"]);
  });

  test("Register user, login and fetch the username", (done) => {
    serverSocket.on("register", (user, pass, email, id) => {
      backend.clientRegister(user, pass, email, db);
      backend.clientLogin(user, pass, db, users, id);
      done();
    });
    serverSocket.on("fetchUser", (id, user) => {
      var testUser = backend.getUser(id, users);
      expect(testUser).toBe(user);
      done();
    });
    var user = faker.internet.userName(); 
    clientSocket.emit("register", user, faker.internet.password(), faker.internet.exampleEmail(), clientSocket.id);
    clientSocket.emit("fetchUser", clientSocket.id, user);
  });

  test("try to fetch existing user with non-existing socket id", (done) => {
    serverSocket.on("register2", (user, pass, email, id) => {
      backend.clientRegister(user, pass, email, db);
      backend.clientLogin(user, pass, db, users, id);
      done();
    });
    serverSocket.on("fetchUserNonExistingSocket", (id) => {
      var testUser = backend.getUser(id, users);
      expect(testUser).toBe(undefined);
      done();
    });
    var user = faker.internet.userName(); 
    clientSocket.emit("register2", user, faker.internet.password(), faker.internet.exampleEmail(), clientSocket.id + "b");
    clientSocket.emit("fetchUserNonExistingSocket", clientSocket.id, user);
  });

  test("try to fetch existing non-existing user with correct socket id", (done) => {
    serverSocket.on("fetchUserWrongId", (id) => {
      var testUser = backend.getUser(id, users);
      expect(testUser).toBe(undefined);
      done();
    });
    clientSocket.emit("fetchUserWrongId", clientSocket.id, faker.internet.userName());
  });

  ///Tried to connect a new client, however could not get it to work
  /*
  test.only("try to fetch existing user with wrong (but existing) socket id", (done) => {
    const port = httpServer.address().port;
    wrongClientSocket = new Client(`http://localhost:${port}`);
    expect(wrongClientSocket).toBe(!undefined);
    serverSocket.on("register3", (user, pass, email, id) => {
      backend.clientRegister(user, pass, email, db);
      backend.clientLogin(user, pass, db, users, id);
      done();
    });
    serverSocket.on("fetchUserWrongSocket", (id) => {
      var testUser = backend.getUser(id, users);
      expect(testUser).toBe(undefined);
      done();
    });

    var user = faker.internet.userName(); 
    clientSocket.emit("register3", user, faker.internet.password(), faker.internet.exampleEmail(), wrongClientSocket.id);
    clientSocket.emit("fetchUserWrongSocket", clientSocket.id, user);
  });
  */
});
