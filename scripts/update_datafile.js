const fs = require("fs");
const fetch = require("node-fetch");
const configFile = require("../ew_default_config.json");

const datafile_dir = "./datafile/";
const datafile_full_path = datafile_dir + configFile.sdkKey + ".json";
const datafile_url =
  configFile.datafileURLTemplate + configFile.sdkKey + ".json";
const autoUpdateExperimentList = configFile.autoUpdateActiveExperiments;

console.log("Updating embedded Optimizely datafile...");

function arrayIsValid(_array_) {
  return _array_ && Array.isArray(_array_) && _array_.length > 0;
}

function trimArray(arr) {
  let i;
  for (i = 0; i < arr.length; i++) {
    arr[i] = arr[i].replace(/^\s\s*/, "").replace(/\s\s*$/, "");
  }
  return arr;
}

function getExperimentFlagKeys(current_datafile) {
  if (!current_datafile) {
    return undefined;
  }

  let i;
  let resultList = [];
  let flagKeys = current_datafile.featureFlags;
  if (arrayIsValid(flagKeys)) {
    console.log("Retrieving experiment keys from datafile.");
    for (i = 0; i < flagKeys.length; i++) {
      resultList.push(flagKeys[i].key);
    }
    
    console.log(`The edge worker default configuration has been updated with the active experiments list.`);
    console.log(resultList);
    resultList = trimArray(resultList);
    return resultList.toString();
  }
}

async function saveToFile(dest, data) {
  fs.writeFileSync(dest, data);
}

/**
 * Fetches a datafile from a CDN or remote server.
 *
 * @param url
 * @returns {Promise<object>}
 */
async function fetchFileSync(url) {
  const response = await fetch(url);
  return await response.json();
}

/**
 * Fetches the SDK datafile from a CDN or remote server and saves to datafile directory
 *
 * @param url
 * @param dest
 * @returns {Promise<*>}
 */
async function fetchDatafile(url, dest) {
  try {
    let datafile = await fetchFileSync(url);
    // console.log(datafile);

    if (datafile) {
      await saveToFile(dest, JSON.stringify(datafile));
      configFile.datafile = datafile;

      if (autoUpdateExperimentList) {
        let resultList = getExperimentFlagKeys(configFile.datafile);
        if (resultList) {
          configFile.activeExperiments = resultList;
        }
      }

      await saveToFile(
        "./ew_default_config.json",
        JSON.stringify(configFile, null, 4)
      );

      console.log(
        "Successfully downloaded datafile: " +
          datafile_url +
          " [Revision: " +
          datafile.revision +
          "]"
      );
    }
    return datafile;
  } catch (err) {
    console.error("Unable to download datafile: " + err);
    return null;
  }
}

async function updateLocalDatafile() {
  const datafile = await fetchDatafile(datafile_url, datafile_full_path);
}

updateLocalDatafile();
