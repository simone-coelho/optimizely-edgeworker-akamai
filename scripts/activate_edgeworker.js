const fs = require("fs");
const execSh = require("exec-sh");
const { version } = require("typescript");
let versionId = "NO_VERSION_FOUND";
let bundleVersion;

fs.readFile("./package.json", function(err, content) {
  if (err) throw err;
  console.log(`Retrieving edge worker ID from package.json`);
  let packageJson = JSON.parse(content);
  versionId = packageJson.config.edgeWorkerId;

  if (versionId && versionId !== "NO_VERSION_FOUND") {
    fs.readFile("./bundle.json", function(err, content) {
      if (err) throw err;

      let bundle = JSON.parse(content);
      bundleVersion = bundle["edgeworker-version"];
      console.log(
        `Activating edge-worker ID No. ${versionId} version: ${bundleVersion}`
      );

      execSh(
        `akamai edgeworkers activate ${versionId} staging ${bundleVersion}`,
        //{ cwd: workingDir },
        (err) => {
          if (err) {
            console.log("Exit code: ", err.code);
            return;
          }
        }
      );
    });
  } else {
    console.log(
      `Unable to activate edge-worker ID No. ${versionId} version: ${bundleVersion}`
    );
  }
});
