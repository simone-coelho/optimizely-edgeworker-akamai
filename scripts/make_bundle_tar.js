const fs = require("fs");
const execSh = require("exec-sh");
let packageJson;
let workingDir;

fs.readFile("../package.json", function(err, content) {
  if (err) throw err;

  packageJson = JSON.parse(content);
  workingDir = packageJson.config.distributionRelativePath;
  console.log("Compressing and creating TAR file...");

  execSh(
    //"tar -czvf optly-akamai-agent.tgz main.js bundle.json edgekv.js edgekv_tokens.js",
    "tar -czvf optly-akamai-agent.tgz main.js bundle.json",
    { cwd: workingDir },
    (err) => {
      if (err) {
        console.log("Exit code: ", err.code);
        return;
      }
    }
  );
});
