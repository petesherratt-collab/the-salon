const vm = require("vm");
const fs = require("fs");
const path = require("path");
const scriptDir = __dirname;
process.argv[1] = path.join(scriptDir, "run-judgements.js");
const code = fs.readFileSync(path.join(scriptDir, "run-judgements.js"), "utf8");
const ctx = vm.createContext({
  require, __dirname: scriptDir,
  __filename: path.join(scriptDir, "run-judgements.js"),
  process, console, module: { exports: {}, require }, exports: {},
  setTimeout, clearTimeout, setInterval, clearInterval, Promise, URL,
  Buffer, global, fetch
});
vm.runInContext(code, ctx);
