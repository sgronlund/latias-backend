var os = require("os");
const { exec } = require("child_process");

//Windows
if (os.type() === "Windows_NT") {
  exec(
    'del package-lock.json db_for_test.db db_for_stress_test.db && rd /s /q "../docs/out" "../docs/coverage" node_modules"'
  );
  //Linux/Mac
} else if (os.type() === "Darwin" || os.type() == "Linux") {
  exec(
    "rm -f package-lock.json db_for_test.db db_for_stress_test.db && rm -rf node_modules ../docs/out ../docs/coverage"
  );
}
