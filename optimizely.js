import {
  createInstance,
  setLogger,
  enums,
  setLogLevel,
} from "@optimizely/optimizely-sdk";
import { generateUUID as optimizelyGenerateUUID } from "@optimizely/js-sdk-utils";
import { logger } from "log";
import { httpRequest } from "http-request";

/***/
const optimizelyOptions = require("@optimizely/optimizely-sdk")
  .OptimizelyDecideOption;
let DefaultConfig = require("./ew_default_config.json");

// Datafile converted to JS Object and parsed during initialization
const defaultDataFile = DefaultConfig.datafile;

/**
 * Logging for development. You should disable while in production.
 */
function setLogging() {
  // Set the custom logger
  setLogger({
    log: function(level, message) {
      var LOG_LEVEL = enums.LOG_LEVEL;
      switch (level) {
        case LOG_LEVEL.INFO:
          // INFO log message
          logger.log("[I]: " + message);
          break;

        case LOG_LEVEL.DEBUG:
          // DEBUG log message
          logger.log("[D]: " + message);
          break;

        case LOG_LEVEL.WARNING:
          // WARNING log message
          logger.log("[W]: " + message);
          break;

        case LOG_LEVEL.ERROR:
          // ERROR log message
          logger.log("[E]: " + message);
          break;
      }
    },
  });

  setLogLevel(enums.LOG_LEVEL.DEBUG);
}

//setLogging();

// Generates a UUID for the user ID. Uses the SDK internal method.
function generateUUID() {
  return optimizelyGenerateUUID();
}

/**
 * Custom datafile manager. For development we are hard coding the datafile.
 * This should be used in conjuction wiht the Edge KV store for performance.
 * If inDevelopement param is true, the embedded datafile is used and not downloaded
 *
 * @param {*} inDevelopment
 * @param {*} sdkKey
 * @returns
 */
async function getDataFile(inDevelopment, urlTemplate, sdkKey) {
  let datafile = "{}";
  if (inDevelopment) {
    return JSON.stringify(defaultDataFile);
  } else {
    try {
      const datafileResponse = await httpRequest(
        urlTemplate + sdkKey + ".json"
      );
      if (datafileResponse.ok) {
        datafile = await datafileResponse.json();
        logger.log("Using remote datafile");
      } else {
        logger.log(
          "Unable to retrieve datafile due to invalid status code: %s",
          datafileResponse.status
        );
      }
    } catch (err) {
      logger.log("Unable to retrieve datafile due to error: %s", err.message);
    }

    return datafile;
  }
}

export {
  enums,
  getDataFile,
  createInstance,
  generateUUID,
  defaultDataFile,
  optimizelyOptions,
  DefaultConfig
};
