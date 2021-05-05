const { createServer } = require("http");
const { express } = require("express")();
const backend = require("../backend");
const faker = require("faker/locale/en_US");
const Client = require("socket.io-client");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
var CryptoJS = require("crypto-js");
const bigInt = require("big-integer");

describe("Test Suite for Server", () => {
  let io, serverSocket, clientSocket, db, users, clients;

  beforeAll((done) => {
    db = new Database("./tests/db_for_test.db");
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
    clients = [];
  });

  beforeEach((done) => {
    const tableUsers = db.prepare(
      "CREATE TABLE IF NOT EXISTS users (username VARCHAR(255) COLLATE NOCASE, password VARCHAR(255), email varchar(255), resetcode varchar(255), score INT, scoreArticle INT, balance INT)"
    );
    const tableQuestionsNews = db.prepare(
      "CREATE TABLE IF NOT EXISTS questions (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), correct varchar(255), weekNumber INT)"
    );
    const tableQuestionsArticle = db.prepare(
      "CREATE TABLE IF NOT EXISTS questionsArticle (question varchar(255), wrong1 varchar(255), wrong2 varchar(255), wrong3 varchar(255), correct varchar(255), weekNumber INT)"
    );
    const tableArticles = db.prepare(
      "CREATE TABLE IF NOT EXISTS articles (name varchar(255), link varchar(255), weekNumber INT)"
    );
    const tableCoupons = db.prepare(
      "CREATE TABLE IF NOT EXISTS coupons (name varchar(255), price INT)"
    );
    tableUsers.run();
    tableQuestionsNews.run();
    tableQuestionsArticle.run();
    tableArticles.run();
    tableCoupons.run();
    done();
  });

  afterEach(async (done) => {
    await db.prepare("DROP TABLE IF EXISTS users").run();
    await db.prepare("DROP TABLE IF EXISTS questions").run();
    await db.prepare("DROP TABLE IF EXISTS questionsArticle").run();
    await db.prepare("DROP TABLE IF EXISTS articles").run();
    await db.prepare("DROP TABLE IF EXISTS coupons").run();
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
      expect(bool2).toBe("invalidUserDetails");
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
      ).toBe("invalidUserDetails");
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
      ).toBe("invalidUserDetails");
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
      expect(backend.clientLogin(user, pass, db, users, id)).toBe(
        "validUserDetails"
      );
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

  test("Register user and log in with case insensetive username", (done) => {
    serverSocket.on("validUsernameCase", (user, pass, email, id, users) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeTruthy();
      expect(backend.clientLogin("uSeRnAmE", pass, db, users, id)).toBe(
        "validUserDetails"
      );
      done();
    });
    clientSocket.emit(
      "validUsernameCase",
      "username",
      faker.internet.password(),
      faker.internet.exampleEmail(),
      clientSocket.id,
      users
    );
  });

  test("Login as root", (done) => {
    serverSocket.on("loginRoot", (user, pass, id, users) => {
      expect(backend.clientLogin(user, pass, db, users, id)).toBe("root");
      done();
    });
    clientSocket.emit(
      "loginRoot",
      "root",
      "7ce01a79235ccc49582b0c683f5ac8e257b3bc5b771702506b2058aac0514d41",
      clientSocket.id,
      users
    );
  });

  test("Logout with socket id value undefined", (done) => {
    serverSocket.on("logoutUndefined", (id) => {
      const logout = backend.clientLogout(id, users);
      expect(logout).toBeFalsy();
      done();
    });
    var user = faker.internet.userName();
    clientSocket.emit("logoutUndefined", undefined);
  });

  test("Logout with socket id not matching any user", (done) => {
    serverSocket.on("logoutNonExisting", (id) => {
      const logout = backend.clientLogout(id, users);
      expect(logout).toBeFalsy();
      done();
    });
    clientSocket.emit("logoutNonExisting", clientSocket.id);
  });

  test("Register user, log in, log out and check that user is removed from users", (done) => {
    serverSocket.on("register6", (user, pass, email, id) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeTruthy();
      expect(backend.clientLogin(user, pass, db, users, id)).toBe(
        "validUserDetails"
      );
    });
    serverSocket.on("logout", (id, user) => {
      const logout = backend.clientLogout(id, users);
      expect(logout).toBeTruthy();
      expect(users.includes(user)).toBeFalsy();
      done();
    });
    var user = faker.internet.userName();
    var pass = faker.internet.password();
    var email = faker.internet.exampleEmail();
    clientSocket.emit("register6", user, pass, email, clientSocket.id);
    clientSocket.emit("logout", clientSocket.id, user);
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

  test("Register with two @'s in email", (done) => {
    serverSocket.on("registerTwo@", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "registerTwo@",
      faker.internet.userName(),
      faker.internet.password(),
      "foo@bar@foo.bar"
    );
  });

  test("Register with no ending dot in email", (done) => {
    serverSocket.on("registerNoEnding", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "registerNoEnding",
      faker.internet.userName(),
      faker.internet.password(),
      "foo@bar"
    );
  });

  test("Register with only one word as email", (done) => {
    serverSocket.on("registerOnlyOneWord", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "registerOnlyOneWord",
      faker.internet.userName(),
      faker.internet.password(),
      "foo"
    );
  });

  test("Register with no @'s in email", (done) => {
    serverSocket.on("registerNo@", (user, pass, email) => {
      const register = backend.clientRegister(user, pass, email, db);
      expect(register).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "registerNo@",
      faker.internet.userName(),
      faker.internet.password(),
      "foo.bar"
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

  test("Add question to news quiz with with all arguments as null", (done) => {
    serverSocket.on("addQuestionNull", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionNull");
  });

  test("Add question to news quiz with empty array", (done) => {
    serverSocket.on("addQuestionEmpty", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmpty", "QUESTION", [], 1);
  });

  test("Add question to news quiz with all answers as undefined", (done) => {
    serverSocket.on("addQuestionAllUndefined", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addQuestionAllUndefined",
      "QUESTION",
      [undefined, undefined, undefined],
      1
    );
  });

  test("Add question to news quiz with first answer as undefined", (done) => {
    serverSocket.on("addQuestionFirstUndefined", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addQuestionFirstUndefined",
      "QUESTION",
      [undefined, "A", "B"],
      1
    );
  });

  test("Add question to news quiz with second answer as undefined", (done) => {
    serverSocket.on("addQuestionSecondUndefined", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addQuestionSecondUndefined",
      "QUESTION",
      ["A", undefined, "B"],
      1
    );
  });

  test("Add question to news quiz with third answer as undefined", (done) => {
    serverSocket.on("addQuestionThirdUndefined", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addQuestionThirdUndefined",
      "QUESTION",
      ["A", "B", undefined],
      1
    );
  });

  test("Add question to news quiz with too short answer array", (done) => {
    serverSocket.on("addQuestionShort", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionShort", "QUESTION", ["A", "B"], 1);
  });

  test("Add question to news quiz and check for it's existence", (done) => {
    serverSocket.on("addQuestionExistence", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, db, id);
      expect(operation).toBeTruthy();
      done();
    });
    clientSocket.emit(
      "addQuestionExistence",
      "QUESTION",
      ["FALSE1", "FALSE2", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Try adding question to news quiz that already exists", (done) => {
    serverSocket.on("addQuestionBusy", (question, answers, id) => {
      const operation = backend.addQuestionNews(question, answers, db, id);
      const operationBusy = backend.addQuestionNews(question, answers, db, id);
      expect(operation).toBeTruthy();
      expect(operationBusy).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addQuestionBusy",
      "QUESTION",
      ["FALSE1", "FALSE2", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("checkAnswer with news quiz with null arguments", (done) => {
    serverSocket.on("checkAnswerNull", (question, answers, id) => {
      backend.addQuestionNews(question, answers, db);
      const check = backend.checkAnswerNews(question, answers, id, db);
      expect(check).toBeFalsy();
      done();
    });
    clientSocket.emit("checkAnswerNull");
  });

  test("Add question to news quiz and check with correct answer", (done) => {
    serverSocket.on("correctAnswer", (question, answers, id) => {
      backend.addQuestionNews(question, answers, db, id);
      const check = backend.checkAnswerNews("QUESTION", "CORRECT", db);
      expect(check).toBeTruthy();
      done();
    });
    clientSocket.emit(
      "correctAnswer",
      "QUESTION",
      ["FALSE1", "FALSE2", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Add question to news quiz and check with wrong answer", (done) => {
    serverSocket.on("wrongAnswer", (question, answers, id) => {
      backend.addQuestionNews(question, answers, id, db);
      const check = backend.checkAnswerNews("QUESTION", "FALSE1", db);
      expect(check).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "wrongAnswer",
      "QUESTION",
      ["FALSE1", "FALSE2", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Add question to news quiz with invalid week number", (done) => {
    serverSocket.on("getQuestionInvalidWeek", (question, answers, id) => {
      expect(backend.addQuestionNews(question, answers, db, id)).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "getQuestionInvalidWeek",
      "QUESTION",
      ["FALSE", "FALSE", , "CORRECT"],
      faker.datatype.number({ min: 53, max: 1000 })
    );
  });

  test("Add question to article quiz with with all arguments as null", (done) => {
    serverSocket.on("addQuestionNullArticle", (question, answers, id) => {
      const operation = backend.addQuestionArticle(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionNullArticle");
  });

  test("Add question to article quiz with empty array", (done) => {
    serverSocket.on("addQuestionEmptyArticle", (question, answers, id) => {
      const operation = backend.addQuestionArticle(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit("addQuestionEmptyArticle", "QUESTION", [], 1);
  });

  test("Add question to article quiz with all answers as undefined", (done) => {
    serverSocket.on(
      "addQuestionAllUndefinedArticle",
      (question, answers, id) => {
        const operation = backend.addQuestionArticle(question, answers, id, db);
        expect(operation).toBeFalsy();
        done();
      }
    );
    clientSocket.emit(
      "addQuestionAllUndefinedArticle",
      "QUESTION",
      [undefined, undefined, undefined, undefined],
      1
    );
  });

  test("Add question to article quiz with first answer as undefined", (done) => {
    serverSocket.on(
      "addQuestionFirstUndefinedArticle",
      (question, answers, id) => {
        const operation = backend.addQuestionArticle(question, answers, id, db);
        expect(operation).toBeFalsy();
        done();
      }
    );
    clientSocket.emit(
      "addQuestionFirstUndefinedArticle",
      "QUESTION",
      [undefined, "A", "B", "C"],
      1
    );
  });

  test("Add question to article quiz with second answer as undefined", (done) => {
    serverSocket.on(
      "addQuestionSecondUndefinedArticle",
      (question, answers, id) => {
        const operation = backend.addQuestionArticle(question, answers, id, db);
        expect(operation).toBeFalsy();
        done();
      }
    );
    clientSocket.emit(
      "addQuestionSecondUndefinedArticle",
      "QUESTION",
      ["A", undefined, "B", "C"],
      1
    );
  });

  test("Add question to article quiz with third answer as undefined", (done) => {
    serverSocket.on(
      "addQuestionThirdUndefinedArticle",
      (question, answers, id) => {
        const operation = backend.addQuestionArticle(question, answers, id, db);
        expect(operation).toBeFalsy();
        done();
      }
    );
    clientSocket.emit(
      "addQuestionThirdUndefinedArticle",
      "QUESTION",
      ["A", "B", undefined, "C"],
      1
    );
  });

  test("Add question to article quiz with fourth answer as undefined", (done) => {
    serverSocket.on(
      "addQuestionFourthUndefinedArticle",
      (question, answers, id) => {
        const operation = backend.addQuestionArticle(question, answers, id, db);
        expect(operation).toBeFalsy();
        done();
      }
    );
    clientSocket.emit(
      "addQuestionFourthUndefinedArticle",
      "QUESTION",
      ["A", "B", "C", undefined],
      1
    );
  });

  test("Add question to article quiz with too short answer array", (done) => {
    serverSocket.on("addQuestionShortArticle", (question, answers, id) => {
      const operation = backend.addQuestionArticle(question, answers, id, db);
      expect(operation).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addQuestionShortArticle",
      "QUESTION",
      ["A", "B", "C"],
      1
    );
  });

  test("Add question to article quiz and check for it's existence", (done) => {
    serverSocket.on("addQuestionExistenceArticle", (question, answers, id) => {
      const operation = backend.addQuestionArticle(question, answers, db, id);
      expect(operation).toBeTruthy();
      done();
    });
    clientSocket.emit(
      "addQuestionExistenceArticle",
      "QUESTION",
      ["FALSE1", "FALSE2", "FALSE3", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Try adding question to article quiz that already exists", (done) => {
    serverSocket.on("addQuestionBusyArticle", (question, answers, id) => {
      const operation = backend.addQuestionArticle(question, answers, db, id);
      const operationBusy = backend.addQuestionArticle(
        question,
        answers,
        db,
        id
      );
      expect(operation).toBeTruthy();
      expect(operationBusy).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addQuestionBusyArticle",
      "QUESTION",
      ["FALSE1", "FALSE2", "FALSE3", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("checkAnswer with article quiz with null arguments", (done) => {
    serverSocket.on("checkAnswerNullArticle", (question, answers, id) => {
      backend.addQuestionArticle(question, answers, db);
      const check = backend.checkAnswerArticle(question, answers, id, db);
      expect(check).toBeFalsy();
      done();
    });
    clientSocket.emit("checkAnswerNullArticle");
  });

  test("Add question to article quiz and check with correct answer", (done) => {
    serverSocket.on("correctAnswerArticle", (question, answers, id) => {
      backend.addQuestionArticle(question, answers, db, id);
      const check = backend.checkAnswerArticle("QUESTION", "CORRECT", db);
      expect(check).toBeTruthy();
      done();
    });
    clientSocket.emit(
      "correctAnswerArticle",
      "QUESTION",
      ["FALSE1", "FALSE2", "FALSE3", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Add question to article quiz and check with wrong answer", (done) => {
    serverSocket.on("wrongAnswerArticle", (question, answers, id) => {
      backend.addQuestionArticle(question, answers, id, db);
      const check = backend.checkAnswerArticle("QUESTION", "FALSE1", db);
      expect(check).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "wrongAnswerArticle",
      "QUESTION",
      ["FALSE1", "FALSE2", "FALSE3", "CORRECT"],
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Add question to article quiz with invalid week number", (done) => {
    serverSocket.on(
      "getQuestionInvalidWeekArticle",
      (question, answers, id) => {
        expect(
          backend.addQuestionArticle(question, answers, db, id)
        ).toBeFalsy();
        done();
      }
    );
    clientSocket.emit(
      "getQuestionInvalidWeekArticle",
      "QUESTION",
      ["FALSE", "FALSE", "FALSE", "CORRECT"],
      faker.datatype.number({ min: 53, max: 1000 })
    );
  });

  test("Add 10 questions and try to add 1 more", (done) => {
    serverSocket.on("AddTooMany", (question, answers, id) => {
      for (var i = 0; i < 10; i++) {
        expect(
          backend.addQuestionNews(question + i, answers, db, id)
        ).toBeTruthy();
      }

      expect(
        backend.addQuestionNews("too many " + question, answers, db, id)
      ).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "AddTooMany",
      "QUESTION",
      ["FALSE", "FALSE", "CORRECT"],
      1
    );
  });

  test("Add coupon with null arguments", (done) => {
    serverSocket.on("addCouponNull", (name, price) => {
      expect(backend.addCoupon(name, price, db)).toBeFalsy();
      done();
    });
    clientSocket.emit("addCouponNull");
  });

  test("Add coupon with real arguments", (done) => {
    serverSocket.on("addCouponReal", (name, price) => {
      expect(backend.addCoupon(name, price, db)).toBeTruthy();
      done();
    });
    clientSocket.emit("addCouponReal", "couponName", 50);
  });

  test("Add coupon and get it from the database", (done) => {
    serverSocket.on("addCouponAndGet", (name, price) => {
      expect(backend.addCoupon(name, price, db)).toBeTruthy();
      const coupon = backend.getCoupons(db);
      expect(coupon).toEqual([{ name: name, price: price }]);
      done();
    });
    clientSocket.emit("addCouponAndGet", "couponName", 50);
  });

  test("Add multiple coupons and get them from the database", (done) => {
    serverSocket.on(
      "addCouponAndGetMultiple",
      (name, price, name2, price2, name3, price3) => {
        expect(backend.addCoupon(name, price, db)).toBeTruthy();
        expect(backend.addCoupon(name2, price2, db)).toBeTruthy();
        expect(backend.addCoupon(name3, price3, db)).toBeTruthy();
        const coupon = backend.getCoupons(db);
        expect(coupon).toEqual([
          { name: name, price: price },
          { name: name2, price: price2 },
          { name: name3, price: price3 },
        ]);
        done();
      }
    );
    clientSocket.emit(
      "addCouponAndGetMultiple",
      "couponName",
      faker.datatype.number({ min: 0, max: 1000 }),
      "couponName2",
      faker.datatype.number({ min: 0, max: 1000 }),
      "couponName3",
      faker.datatype.number({ min: 0, max: 1000 })
    );
  });

  test("Add coupon, reset coupons and check that coupon table is empty", (done) => {
    serverSocket.on("addCouponReset", (name, price) => {
      expect(backend.addCoupon(name, price, db)).toBeTruthy();
      expect(backend.resetCoupons(db)).toBeTruthy();
      const getAllCoupons = db.prepare("SELECT * FROM coupons").get();
      expect(getAllCoupons).toBeUndefined();
      done();
    });
    clientSocket.emit("addCouponReset", "couponName", 50);
  });

  test("Add already existing coupon", (done) => {
    serverSocket.on("addCouponDuplicate", (name, price) => {
      expect(backend.addCoupon(name, price, db)).toBeTruthy();
      expect(backend.addCoupon(name, price, db)).toBeFalsy();
      done();
    });
    clientSocket.emit("addCouponDuplicate", "couponName", 50);
  });

  test("Add article with null arguments", (done) => {
    serverSocket.on("addArticleNull", (name, link, weekNumber) => {
      expect(backend.addArticle(name, link, weekNumber, db)).toBeFalsy();
      done();
    });
    clientSocket.emit("addArticleNull");
  });

  test("Add article with real arguments", (done) => {
    serverSocket.on("addArticleReal", (name, link, weekNumber) => {
      expect(backend.addArticle(name, link, weekNumber, db)).toBeTruthy();
      done();
    });
    clientSocket.emit(
      "addArticleReal",
      "ArticleNameReal",
      "https://www.youtube.com",
      10
    );
  });

  test("Add two articles with same week number and get both from the database", (done) => {
    serverSocket.on(
      "addArticlesAndGet",
      (name, link, name2, link2, weekNumber) => {
        expect(backend.addArticle(name, link, weekNumber, db)).toBeTruthy();
        expect(backend.addArticle(name2, link2, weekNumber, db)).toBeTruthy();
        const article = backend.getArticles(weekNumber, db);
        expect(article).toEqual([
          {
            name: name,
            link: link,
            weekNumber: weekNumber,
          },
          { name: name2, link: link2, weekNumber: weekNumber },
        ]);
        done();
      }
    );
    clientSocket.emit(
      "addArticlesAndGet",
      "ArticleNameReal",
      "https://www.youtube.com",
      "ArticleNameReal2",
      "https://www.google.com",
      10
    );
  });

  test("Add articles and fetch ONLY those with a specific week number", (done) => {
    serverSocket.on(
      "addArticlesAndGetMultiple",
      (name, link, name2, link2, weekNumber, weekNumber2) => {
        expect(backend.addArticle(name, link, weekNumber, db)).toBeTruthy();
        expect(backend.addArticle(name2, link2, weekNumber, db)).toBeTruthy();
        expect(backend.addArticle(name, link, weekNumber2, db)).toBeTruthy();
        const article = backend.getArticles(weekNumber, db);
        expect(article).toEqual([
          {
            name: name,
            link: link,
            weekNumber: weekNumber,
          },
          { name: name2, link: link2, weekNumber: weekNumber },
        ]);
        done();
      }
    );
    clientSocket.emit(
      "addArticlesAndGetMultiple",
      "ArticleNameReal",
      "https://www.youtube.com",
      "ArticleNameReal2",
      "https://www.google.com",
      10,
      15
    );
  });

  test("Add already existing article", (done) => {
    serverSocket.on("addArticleDuplicate", (name, link, weekNumber) => {
      expect(backend.addArticle(name, link, weekNumber, db)).toBeTruthy();
      expect(backend.addArticle(name, link, weekNumber, db)).toBeFalsy();
      done();
    });
    clientSocket.emit(
      "addArticleDuplicate",
      "ArticleNameReal",
      "https://www.youtube.com",
      10
    );
  });

  test("Add article, reset articles for that week number and check that there are no articles with that week number", (done) => {
    serverSocket.on("addArticleReset", (name, link, weekNumber) => {
      expect(backend.addArticle(name, link, weekNumber, db)).toBeTruthy();
      expect(backend.resetArticles(db, weekNumber)).toBeTruthy();
      const getAllArticles = db
        .prepare("SELECT * FROM articles where weeknumber = ?")
        .get(weekNumber);
      expect(getAllArticles).toBeUndefined();
      done();
    });
    clientSocket.emit(
      "addArticleReset",
      "ArticleNameReal",
      "https://www.youtube.com",
      10
    );
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

  test("Try getting question with ID as null", (done) => {
    serverSocket.on("getQuestionNullID", (question, id) => {
      const getQuestion = backend.getQuestionNews(question, db, id);
      expect(getQuestion).toBeUndefined();
      done();
    });
    clientSocket.emit("getQuestionNullID", "QUESTION", undefined);
  });

  test("Try getting question with question as null", (done) => {
    serverSocket.on("getQuestionNullQuestion", (question, id) => {
      const getQuestion = backend.getQuestionNews(question, db, id);
      expect(getQuestion).toBeUndefined();
      done();
    });
    clientSocket.emit(
      "getQuestionNullQuestion",
      undefined,
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Try getting question that does not exist", (done) => {
    serverSocket.on("getQuestionNotExist", (question, id) => {
      const getQuestion = backend.getQuestionNews(question, db, id);
      expect(getQuestion).toBeUndefined();
      done();
    });
    clientSocket.emit(
      "getQuestionNotExist",
      "QUESTION",
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Get existing question", (done) => {
    serverSocket.on("getQuestion", (question, id) => {
      expect(
        backend.addQuestionNews(
          "QUESTION",
          ["FALSE", "FALSE", "CORRECT"],
          db,
          id
        )
      ).toBeTruthy();
      const getQuestion = backend.getQuestionNews(question, db, id);
      expect(getQuestion).toEqual({
        correct: "CORRECT",
        question: "QUESTION",
        wrong1: "FALSE",
        wrong2: "FALSE",
        weekNumber: id,
      });
      done();
    });
    clientSocket.emit(
      "getQuestion",
      "QUESTION",
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Try getting questions when there are none for the given week", (done) => {
    serverSocket.on("getQuestionsNotExist", (weekNumber) => {
      const getQuestions = backend.getQuestionsNews(db, weekNumber);
      expect(getQuestions).toBeUndefined();
      done();
    });
    clientSocket.emit(
      "getQuestionsNotExist",
      faker.datatype.number({ min: 1, max: 52 })
    );
  });

  test("Try getting questions when weekNumber is undefined", (done) => {
    serverSocket.on("getQuestionsUndefined", (weekNumber) => {
      const getQuestions = backend.getQuestionsNews(db, weekNumber);
      expect(getQuestions).toBeUndefined();
      done();
    });
    clientSocket.emit("getQuestionsUndefined", undefined);
  });

  test("Try getting questions with invalid week number", (done) => {
    serverSocket.on("getQuestionTooHigh", (weekNumber) => {
      const getQuestions = backend.getQuestionsNews(db, weekNumber);
      expect(getQuestions).toBeUndefined();
    });
    serverSocket.on("getQuestionTooLow", (weekNumber) => {
      const getQuestions = backend.getQuestionsNews(db, weekNumber);
      expect(getQuestions).toBeUndefined();
      done();
    });
    clientSocket.emit(
      "getQuestionTooHigh",
      faker.datatype.number({ min: 53, max: 200 })
    );
    clientSocket.emit(
      "getQuestionTooLow",
      faker.datatype.number({ min: -100, max: 0 })
    );
  });

  test("Get questions with exactly 10 questions", (done) => {
    for (var i = 0; i < 10; i++) {
      backend.addQuestionNews(
        `QUESTION ${i}`,
        ["FALSE", "FALSE", "CORRECT"],
        db,
        1
      );
    }
    serverSocket.on("getQuestionsCorrect", (weekNumber) => {
      var expected = [
        {
          correct: "CORRECT",
          question: "QUESTION 0",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 1",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 2",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 3",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 4",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 5",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 6",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 7",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 8",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
        {
          correct: "CORRECT",
          question: "QUESTION 9",
          weekNumber: 1,
          wrong1: "FALSE",
          wrong2: "FALSE",
        },
      ];
      expect(backend.getQuestionsNews(db, weekNumber)).toEqual(expected);
      done();
    });
    clientSocket.emit("getQuestionsCorrect", 1);
  });

  test("run reset questions with null parameters", (done) => {
    expect(backend.resetQuestionsNews()).toBeFalsy();
    done();
  });

  test("reset questions for a given week number and check that it's no longer in database", (done) => {
    backend.addQuestionNews("QUESTION", ["a", "b", "c"], 1);
    expect(backend.resetQuestionsNews(db, 1)).toBeTruthy();
    const getQuestion = db.prepare(
      "SELECT * FROM questions where weekNumber = 1"
    );
    expect(getQuestion.get()).toBeUndefined();
    done();
  });

  test("Register user, login and fetch the username", (done) => {
    serverSocket.on("register", (user, pass, email, id) => {
      expect(backend.clientRegister(user, pass, email, db)).toBeTruthy();
      expect(backend.clientLogin(user, pass, db, users, id)).toBe(
        "validUserDetails"
      );
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

  test("StringifySeconds less than one day", (done) => {
    serverSocket.on("stringifySecondsLess", (week) => {
      expect(backend.stringifySeconds(week)).toBe("15:05:21");
      done();
    });
    clientSocket.emit("stringifySecondsLess", 54321);
  });

  test("StringifySeconds more than one day", (done) => {
    serverSocket.on("stringifySecondsMore", (week) => {
      expect(backend.stringifySeconds(week)).toBe("6 days 9 hours");
      done();
    });
    clientSocket.emit("stringifySecondsMore", 554321);
  });

  test("getUser with NULL arguments", (done) => {
    serverSocket.on("getUserNull", (pass, email) => {
      expect(backend.getUser(pass, email, db)).toBeUndefined();
      done();
    });
    clientSocket.emit("getUserNull");
  });

  test("decryptPassword with NULL arguments", (done) => {
    serverSocket.on("decryptPasswordNull", (pass, email) => {
      expect(backend.decryptPassword()).toBeUndefined();
      done();
    });
    clientSocket.emit("decryptPasswordNull");
  });

  test("decrypt a password", (done) => {
    var password = faker.internet.password();
    serverSocket.on("decryptPassword", (clients, encryptedPassword, id) => {
      var decryptedPassword = backend.decryptPassword(
        clients,
        encryptedPassword,
        id
      );
      expect(decryptedPassword).toBe(password);
      done();
    });
    var encryptedPassword = CryptoJS.AES.encrypt(password, "key").toString();
    clients.push({ id: clientSocket.id, key: "key" });
    clientSocket.emit(
      "decryptPassword",
      clients,
      encryptedPassword,
      clientSocket.id
    );
  });

  test("Simulate asymmetric key exchange and compare shared keys", (done) => {
    var serverPrivateKey = bigInt(faker.finance.account(256));
    var g = bigInt(backend.randomPrime());
    var p = bigInt(2 * g + 1);
    var serverPublicKey = g.modPow(serverPrivateKey, p);

    serverSocket.on("clientPublic", (clientPublicKey, expectedSharedKey) => {
      clientPublicKey = bigInt(clientPublicKey);
      var sharedKey = clientPublicKey.modPow(serverPrivateKey, p);
      expect(sharedKey.toString()).toMatch(expectedSharedKey.toString());
      done();
    });

    clientSocket.on("serverPublic", (serverPublicKey, g, p) => {
      serverPublicKey = bigInt(serverPublicKey);
      g = bigInt(g);
      p = bigInt(p);
      var privateKey = bigInt(faker.finance.account(256));
      var clientPublicKey = g.modPow(privateKey, p);
      sharedKey = serverPublicKey.modPow(privateKey, p);
      clientSocket.emit(
        "clientPublic",
        Number(clientPublicKey),
        Number(sharedKey)
      );
    });
    serverSocket.emit(
      "serverPublic",
      Number(serverPublicKey),
      Number(g),
      Number(p)
    );
  });

  test("Generate prime, check that it's prime and between 5000-10000", (done) => {
    function isPrime(value) {
      for (var i = 2; i < value; i++) {
        if (value % i === 0) {
          return false;
        }
      }
      return value > 1;
    }

    serverSocket.on("generatePrime", () => {
      var prime = backend.randomPrime();
      expect(prime).toBeGreaterThan(5000);
      expect(prime).toBeLessThan(10000);
      expect(isPrime(prime)).toBeTruthy();
      done();
    });
    clientSocket.emit("generatePrime");
  });
});
