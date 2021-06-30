const fs = require("fs");

let newVersion = 10000;

console.log("Incrementing edge-worker bundle...");

fs.readFile("./bundle.json", function(err, content) {
  if (err) throw err;

  let bundle = JSON.parse(content);
  newVersion = Number(bundle["edgeworker-version"]) + 1;
  bundle["edgeworker-version"] = newVersion.toString();

  fs.writeFile("./bundle.json", JSON.stringify(bundle, null, 1), function(err) {
    if (err) throw err;
    console.log(`Current edge-woker version is: ${newVersion}`);

    fs.readFile("./package.json", function(err, content) {
      if (err) throw err;
      console.log(`Updating package.json bundleVersion value: ${newVersion}`);
      let packageJson = JSON.parse(content);
      packageJson.config.bundleVersion = newVersion.toString();

      fs.writeFile(
        "./package.json",
        JSON.stringify(packageJson, null, 4),
        function(err) {
          if (err) throw err;
          console.log(
            `package.json bundle version was updated to new version: ${newVersion}`
          );
        }
      );
    });
  });
});
