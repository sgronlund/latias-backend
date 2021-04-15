const { createServer } = require("http");
const { express } = require("express")();
const backend = require("../server");
const faker = require("faker/locale/en_US");
const Client = require("socket.io-client");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");

describe("Test Suite for Server", () => {
  let io, serverSocket, clientSocket, db, users;

  beforeAll((done) => {
    db = new Database("db_for_test.db");
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

  beforeEach((done) => {
    const tableUsers = db.prepare(
      "CREATE TABLE IF NOT EXISTS users (username VARCHAR(255), password VARCHAR(255), email varchar(255), resetcode varchar(255))"
    );
    const tableQuestions = db.prepare(
      "CREATE TABLE IF NOT EXISTS questions (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), wrong3 varchar(255), correct varchar(255))"
    );
    tableUsers.run();
    tableQuestions.run();
    done();
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

  test("Login with inputs as null", (done) => {
    serverSocket.on("nullUser", (user, pass, id, users) => {
      const bool = backend.clientLogin(user, pass, db, users, id);
      expect(bool).toBe("invalid");
      done();
    });
    clientSocket.emit("nullUser");
  });

  test("Login in with faulty user fails", (done) => {
    serverSocket.on("faultyUser", (user, pass, id, users) => {
      const bool2 = backend.clientLogin(user, pass, db, users, id);
      expect(bool2).toBe("invalid");
      done();
    });
    var usr = faker.internet.userName();
    var pass = faker.internet.password();
    clientSocket.emit("faultyUser", usr, pass, clientSocket.id, users);
  });

  test("Login in with wrong password for registered user", (done) => {
    serverSocket.on("wrongPass", (user, pass, email, id, users) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeTruthy();
      expect(
        backend.clientLogin(user, "wrongpasswordihope", db, users, id)
      ).toBe("invalid");
      done();
    });
    clientSocket.emit(
      "wrongPass",
      faker.internet.userName(),
      faker.internet.password(),
      faker.internet.exampleEmail(),
      clientSocket.id,
      users
    );
  });

  test("Login in with wrong user for registered user", (done) => {
    serverSocket.on("wrongUser", (user, pass, email, id, users) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeTruthy();
      expect(
        backend.clientLogin("wrongusernameihope", pass, db, users, id)
      ).toBe("invalid");
      done();
    });
    clientSocket.emit(
      "wrongUser",
      faker.internet.userName(),
      faker.internet.password(),
      faker.internet.exampleEmail(),
      clientSocket.id,
      users
    );
  });

  test("Register user and log in", (done) => {
    serverSocket.on("validUser", (user, pass, email, id, users) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeTruthy();
      expect(backend.clientLogin(user, pass, db, users, id)).toBe("valid");
      done();
    });
    clientSocket.emit(
      "validUser",
      faker.internet.userName(),
      faker.internet.password(),
      faker.internet.exampleEmail(),
      clientSocket.id,
      users
    );
  });

  test("Register user and try register user with same username", (done) => {
    serverSocket.on("doubleRegister", (user, pass1, pass2, email1, email2) => {
      const register1 = backend.clientRegister(user, pass1, email1, db);
      const register2 = backend.clientRegister(user, pass2, email2, db);
      expect(register1).toBeTruthy();
      expect(register2).toBeFalsy();
      done();
    });
    var username = faker.internet.userName();
    var pass1 = faker.internet.password();
    var pass2 = faker.internet.password();
    var email1 = faker.internet.exampleEmail();
    var email2 = faker.internet.exampleEmail();
    clientSocket.emit("doubleRegister", username, pass1, pass2, email1, email2);
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
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "registerRoot",
      "root",
      faker.internet.password(),
      faker.internet.exampleEmail()
    );
  });

  test("Register with username, password and email as null", (done) => {
    serverSocket.on("detailsNull", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit("detailsNull");
  });

  test("Register with username, password and email as empty", (done) => {
    serverSocket.on("detailsEmpty", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit("detailsEmpty", "", "", "");
  });

  test("Add question with question and answer as null", (done) => {
    serverSocket.on("addQuestionNull", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionNull");
  });

  test("Add question with empty array", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION", []);
  });

  test("Add question with all answers as undefined", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION", [undefined, undefined , undefined, undefined]);
  });

  test("Add question with first answer as undefined", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION", [undefined, "A" , "B", "C"]);
  });

  test("Add question with second answer as undefined", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION", ["A", undefined, "B", "C"]);
  });

  test("Add question with third answer as undefined", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION", ["A", "B", undefined, "C"]);
  });

  test("Add question with fourth answer as undefined", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION", ["A", "B", "C", undefined]);
  });

  test("Add question with too short answer array", (done) => {
    serverSocket.on("addQuestionShort", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionShort", "QUESTION", ["A", "B", "C"]);
  });

  test("Add question and check for it's existence", (done) => {
    serverSocket.on("addQuestionExistence", (question, answers) => {
      const operation = backend.addQuestion(question, answers, db);
      expect(operation).toBeTruthy();
      done();
    });
    clientSocket.emit("addQuestionExistence", "QUESTION", [
      "FALSE1",
      "FALSE2",
      "FALSE3",
      "CORRECT",
    ]);
  });

  test("checkAnswer with null arguments", (done) => {
    serverSocket.on("checkAnswerNull", (question, answers) => {
      backend.addQuestion(question, answers, db);
      const check = backend.checkAnswer(question, answers, db);
      expect(check).toBeFalsy();
      done();
    });
    clientSocket.emit("checkAnswerNull");
  });

  test("Add question and check with correct answer", (done) => {
    serverSocket.on("correctAnswer", (question, answers) => {
      backend.addQuestion(question, answers, db);
      const check = backend.checkAnswer("QUESTION", "CORRECT", db);
      expect(check).toBeTruthy();
      done();
    });
    clientSocket.emit("correctAnswer", "QUESTION", [
      "FALSE1",
      "FALSE2",
      "FALSE3",
      "CORRECT",
    ]);
  });

  test("Add question and check with wrong answer", (done) => {
    serverSocket.on("wrongAnswer", (question, answers) => {
      backend.addQuestion(question, answers, db);
      const check = backend.checkAnswer("QUESTION", "FALSE1", db);
      expect(check).toBeFalsy();
      done();
    });
    clientSocket.emit("wrongAnswer", "QUESTION", [
      "FALSE1",
      "FALSE2",
      "FALSE3",
      "CORRECT",
    ]);
  });

  test("sendMail with null arguments", (done) => {
    serverSocket.on("sendMailNull", (code, mail, nodemailer) => {
      expect(backend.sendMail(code, mail, nodemailer)).toBeUndefined();
      done();
    });
    clientSocket.emit("sendMailNull");
  });

  test("sendMail with faulty mail", (done) => {
    serverSocket.on("sendMailInvalid", (code, mail) => {
      expect(backend.sendMail(code, mail, nodemailer)).toBeUndefined();
      done();
    });
    clientSocket.emit("sendMailInvalid", "test", "NOTMAIL");
  });

  test("Try getting question with question as null", (done) => {
    serverSocket.on("getQuestionNull", (question) => {
      const getQuestion = backend.getQuestion(question, db);
      expect(getQuestion).toBeUndefined();
      done();
    });
    clientSocket.emit("getQuestionNull");
  });

  test("Try getting question that does not exist", (done) => {
    serverSocket.on("getQuestionNotExist", (question) => {
      const getQuestion = backend.getQuestion(question, db);
      expect(getQuestion).toBeUndefined();
      done();
    });
    clientSocket.emit("getQuestionNotExist", "QUESTION");
  });

  test("Get existing question", (done) => {
    serverSocket.on("getQuestion", (question) => {
      expect(
        backend.addQuestion(
          "QUESTION",
          ["FALSE", "FALSE", "FALSE", "CORRECT"],
          db
        )
      ).toBeTruthy();
      const getQuestion = backend.getQuestion(question, db);
      expect(getQuestion).toEqual({
        correct: "CORRECT",
        question: "QUESTION",
        wrong1: "FALSE",
        wrong2: "FALSE",
        wrong3: "FALSE",
      });
      done();
    });
    clientSocket.emit("getQuestion", "QUESTION");
  });

  test("Register user, login and fetch the username", (done) => {
    serverSocket.on("register", (user, pass, email, id) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeTruthy();
      expect(backend.clientLogin(user, pass, db, users, id)).toBe("valid");
    });
    serverSocket.on("fetchUser", (id, user) => {
      var testUser = backend.getUser(id, users);
      expect(testUser).toBe(user);
      done();
    });
    var user = faker.internet.userName();
    clientSocket.emit(
      "register",
      user,
      faker.internet.password(),
      faker.internet.exampleEmail(),
      clientSocket.id
    );
    clientSocket.emit("fetchUser", clientSocket.id, user);
  });

  test("try to fetch existing user with non-existing socket id", (done) => {
    serverSocket.on("register2", (user, pass, email, id) => {
      backend.clientRegister(user, pass, email, db);
      backend.clientLogin(user, pass, db, users, id);
    });
    serverSocket.on("fetchUserNonExistingSocket", (id) => {
      var testUser = backend.getUser(id, users);
      expect(testUser).toBe(undefined);
      done();
    });
    var user = faker.internet.userName();
    clientSocket.emit(
      "register2",
      user,
      faker.internet.password(),
      faker.internet.exampleEmail(),
      clientSocket.id + "b"
    );
    clientSocket.emit("fetchUserNonExistingSocket", clientSocket.id, user);
  });

  test("try to fetch existing non-existing user with correct socket id", (done) => {
    serverSocket.on("fetchUserWrongId", (id) => {
      var testUser = backend.getUser(id, users);
      expect(testUser).toBe(undefined);
      done();
    });
    clientSocket.emit(
      "fetchUserWrongId",
      clientSocket.id,
      faker.internet.userName()
    );
  });

  test("try generate code with 0 as length", (done) => {
    serverSocket.on("generateCodeZero", (length) => {
      var code = backend.generateCode(length);
      expect(code).toBeUndefined();
      done();
    });
    clientSocket.emit("generateCodeZero", 0);
  });

  test("try generate code", (done) => {
    serverSocket.on("generateCode", (length) => {
      var code = backend.generateCode(length);
      expect(code).toHaveLength(length);
      done();
    });
    var length = Math.floor((Math.random() + 1) * 50);
    clientSocket.emit("generateCode", length);
  });

  test("Try insert code with null arguments", (done) => {
    serverSocket.on("insertCodeNull", (code, email, db) => {
      var code = backend.insertCode(code, email, db);
      expect(code).toBeUndefined();
      done();
    });
    clientSocket.emit("insertCodeNull");
  });

  test("Insert code and check it's existence", (done) => {
    serverSocket.on("register3", (user, pass, email) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeTruthy();
    });
    serverSocket.on("insertCode", (code, email) => {
      backend.insertCode(code, email, db);
      expect(backend.checkCode(code, email, db)).toBeTruthy();
      done();
    });
    var user = faker.internet.userName();
    var pass = faker.internet.password();
    var mail = faker.internet.exampleEmail();
    clientSocket.emit("register3", user, pass, mail);
    clientSocket.emit("insertCode", "CODE", mail);
  });

  test("Check non-existing code", (done) => {
    serverSocket.on("checkNonExistingCode", (code, email) => {
      backend.insertCode(code, email, db);
      expect(backend.checkCode(code, email, db)).toBeFalsy();
      done();
    });
    var mail = faker.internet.exampleEmail();
    clientSocket.emit("checkNonExistingCode", "CODE", mail);
  });

  test("checkCode with null arguments", (done) => {
    serverSocket.on("checkCodeNull", (code, email) => {
      backend.insertCode(code, email, db);
      expect(backend.checkCode(code, email, db)).toBeFalsy();
      done();
    });
    clientSocket.emit("checkCodeNull");
  });

  test("updatePassword with null arguments", (done) => {
    serverSocket.on("updatePasswordNull", (pass, email) => {
      expect(backend.updatePassword(pass, email, db)).toBeFalsy();
      done();
    });
    clientSocket.emit("updatePasswordNull");
  });

  test("Update password for an existing user and login after", (done) => {
    serverSocket.on("register4", (user, pass, mail) => {
      expect(backend.clientRegister(user, pass, mail, db)).toBeTruthy();
    });
    serverSocket.on("updatePassword", (newPass, mail, user, id) => {
      expect(backend.updatePassword(newPass, mail, db, user)).toBeTruthy();
      expect(backend.clientLogin(user, newPass, db, users, id)).toBeTruthy();
      done();
    });
    var user = faker.internet.userName();
    var pass = faker.internet.password();
    var newPass = faker.internet.password();
    var mail = faker.internet.exampleEmail();
    clientSocket.emit("register4", user, pass, mail);
    clientSocket.emit("updatePassword", newPass, mail, user, clientSocket.id);
  });

  test("checkMail with null arguments", (done) => {
    serverSocket.on("checkMailNull", (pass, email) => {
      expect(backend.checkMail(pass, email, db)).toBeFalsy();
      done();
    });
    clientSocket.emit("checkMailNull");
  });

  test("Check existing email", (done) => {
    serverSocket.on("register5", (user, pass, mail) => {
      expect(backend.clientRegister(user, pass, mail, db)).toBeTruthy();
    });
    serverSocket.on("checkMail", (mail) => {
      expect(backend.checkMail(mail, db)).toBeTruthy();
      done();
    });
    var user = faker.internet.userName();
    var pass = faker.internet.password();
    var mail = faker.internet.exampleEmail();
    clientSocket.emit("register5", user, pass, mail);
    clientSocket.emit("checkMail", mail);
  });

  ///Mega hard coded but want that good stuff LCOV any %
  test("StringifySeconds", (done) => {
    serverSocket.on("stringifySeconds", (week) => {
      expect(backend.stringifySeconds(week)).toBe(
        "days: 0 hours: 15 minutes: 5 seconds: 21"
      );
      done();
    });
    clientSocket.emit("stringifySeconds", 54321);
  });

  test("getUser with NULL arguments", (done) => {
    serverSocket.on("getUserNull", (pass, email) => {
      expect(backend.getUser(pass, email, db)).toBeUndefined();
      done();
    });
    clientSocket.emit("getUserNull");
  });
});
