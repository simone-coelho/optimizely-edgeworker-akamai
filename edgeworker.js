import {
  enums,
  getDataFile,
  createInstance,
  generateUUID,
  optimizelyOptions,
  DefaultConfig,
} from "./optimizely";

// import { createResponse } from "create-response";
import { logger } from "log";
import { httpRequest } from "http-request";
import { Cookies, SetCookie } from "cookies";
import URLSearchParams from "url-search-params";
import UrlPattern from "url-pattern";

// Boolean constants
let DISABLE_DECISION_EVENT = true;
let IN_AGENT_MODE = true;
const AGENT_MODE_ENABLED = true;
const eventsBridgeStorageVariable = "PMUSER_EVENTS_BRIDGE_STORAGE";
const inAgentModeVariable = "PMUSER_IN_AGENT_MODE";
/***/
const developmentKey = ""; // used for development, but will not be used in deployment
const inDevelopment = false; // set to false before deployment
const decisionsCookieName = "optly_akamai_ew_decisions"; // Name of cookie amd headers that stores previous decisions (test and variation assignment.)
const optlyDecisionsHeaderName = "optly-decisions";
const decisionsKeyName = "decisions";
const userCookieName = "optly_akamai_ew_user"; // Name of cookie that stores user identifier (visitorId) assignment
const optlyUserIdsHeaderName = "optly-user-id";
const userIdentifierKeyName = "user_identifier";
const userIdVariable = "PMUSER_OPTIMIZELY_USER_ID";
const flagsListVariable = "PMUSER_OPTIMIZELY_FLAGS_LIST";
const attributesListVariable_1 = "PMUSER_OPTIMIZELY_ATTR_LIST_1";
const attributesListVariable_2 = "PMUSER_OPTIMIZELY_ATTR_LIST_2";
const assignedDecisionsVariable = "PMUSER_OPTIMIZELY_DECISIONS";
const cookieExpirationSecs = 30 * 24 * 60 * 60;
const cookieExpirationInDays = 30;
const delimeter = "&";
const flag_var_delimiter = ":";
const key_value_delimiter = ",";

// Deafult configuration
let defaultConfig = DefaultConfig;
let defaultConfigUpdated = false;
// Account ID
let ACCOUNT_ID = defaultConfig.accountId;
let eventsEndpoint = defaultConfig.optlyEventsEndpoint;

/**
 *  KV_STORAGE_ENABLED = coniguration will be downloaded from KV store
 */
const KV_STORAGE_ENABLED = false; // not implemented due to sub-request limitations
const KV_NAMESPACE = defaultConfig.kv_namespace;
const KV_GROUP = defaultConfig.kv_group;
// const KV_ITEM_DATA_FILE = defaultConfig.kv_item_data_file;
// const KV_ITEM_CONFIG_FILE = defaultConfig.kv_item_config_file;

// this.#edgekv_uri = namespace.edgekv_uri || "https://edgekv.akamai-edge-svcs.net";
// Fetch from KV store or Feature Variable?
let activeExperimentList;
const ACTIVE_EXPERIMENTS = "experiment1,experiment2";

const urlPattern = new UrlPattern("/ew-agent(/*)");

let params;
// Development query parameters
const OVERRIDE_USER_ID_PARAM = "override_user_id";
// CDN Agent functionality
const SDK_KEY_PARAM = "skd_key"; // not implemented
const DATAFILE_SOURCE_PARAM = "datafile_source"; // not implemented
const FLAGS_PARAM = "flag_keys";
const ATTRIBUTES_PARAM = "attributes";
const USER_ID_PARAM = "user_id";

let requestQueryParams = {
  flagsList: [],
  userId: "",
  attributesList: [],
};

/**
 * Name of query parameter that contains A/B group assignment
 * This query parameter will be added to the outgoing onClientRequest.
 * The query parameter can be added to the incoming request to force A/B group assignment.
 */
const queryParamName = "assignedVariation";

/**
 * Trims all empty spaces from strings in the string array in case of human error.
 * When splitting a comma delimited string any spaces around the flagKeys will cause issues when retrieving decisions
 *
 * @param {*} arr
 * @returns
 */
function trimArray(arr) {
  let i;
  for (i = 0; i < arr.length; i++) {
    arr[i] = arr[i].replace(/^\s\s*/, "").replace(/\s\s*$/, "");
  }
  return arr;
}

// Test if object is a valid array
function arrayIsValid(_array_) {
  return _array_ && Array.isArray(_array_) && _array_.length > 0;
}
/**
 * Validates if a url path is valid for testing
 *
 * @param {*} path
 * @returns
 */
export function requestMatches(path) {
  return true;
  //return urlPattern.match(path);
}

function encodeURI(uri) {
  let encodedString = encodeURIComponent(uri);
  return encodedString;
}

function decodeURI(uri) {
  let decodedString = decodeURIComponent(uri_enc);
  return decodedString;
}

/**
 * Custom event dispatcher required to dispatch events back to the Optimizely "logx" endpoint
 * Akamai has several restrictions and limitations that require a custom implementation such
 */
const optimizelyEventDispatcher = {
  async dispatchEvent(event, callback) {
    return undefined;
  },
};

function findFlagByKey(objectArray, key) {
  objectArray.find((obj) => obj.featureKey === key);
}

/**
const object1 = {
  key1: 'value_1',
  key2: 'value_2'
};

for (const [key, value] of Object.entries(object1)) {
  console.log(`${key}: ${value}`);
}

 * 
 * @param {*} userId 
 * @param {*} snapShot 
 * @param {*} attributes 
 * @param {*} newSessionId 
 * @returns 
 */
function getPayloadVisitor(userId, attributes, newSessionId) {
  let visitor = {
    sessionId: newSessionId,
    visitor_id: "userId",
    attributes: [
      // {
      //   entity_id: "12370020842",
      //   key: "utmContent",
      //   type: "custom",
      //   value: "Simone - Optimizely",
      // },
    ],
    snapshots: [],
  };

  visitor.visitor_id = userId;
  return visitor;
}

function deepClone(obj) {
  if (obj) {
    return JSON.parse(JSON.stringify(obj));
  } else {
    return undefined;
  }
}

function buildVisitorsSnapshots(config, userId, decisionsJson, attributes) {
  let visitorsPayload = [];
  const featuresMap = config.featuresMap;
  const newSessionId = generateUUID();
  let decisions = JSON.parse(decisionsJson);
  if (decisions) {
    try {
      decisions.forEach((decision) => {
        const feature = featuresMap[decision.featureKey];
        const experimentsMap = feature.experimentsMap;
        const experiment = experimentsMap[decision.experimentKey];
        const variationsMap = experiment.variationsMap;
        const variation = variationsMap[decision.variationKey];
        const snapShot = deepClone(getSnapShot());
        snapShot.decisions[0].campaign_id = experiment.id;
        snapShot.decisions[0].experiment_id = experiment.id;
        snapShot.decisions[0].variation_id = variation.id;
        snapShot.events[0].entity_id = experiment.id;
        snapShot.events[0].type = "campaign_activated";
        snapShot.events[0].timestamp = new Date().getTime();
        snapShot.events[0].uuid = generateUUID();
        const newPayload = deepClone(
          getPayloadVisitor(userId, attributes, newSessionId)
        );
        newPayload.snapshots.push(snapShot);
        visitorsPayload.push(newPayload);
      });
    } catch (error) {
      logger.log(error.message);
    }
  }

  return visitorsPayload;
}

function getSnapShot() {
  let newSnapShot = {
    decisions: [
      {
        campaign_id: "0",
        experiment_id: "0",
        variation_id: "0",
      },
    ],
    events: [
      {
        entity_id: "0",
        type: "campaign_activated",
        timestamp: 1001,
        uuid: "UUID",
      },
    ],
  };
  return newSnapShot;
}

/**
 * @param {*} config
 * @param {*} userId
 * @param {*} decisions
 * @param {*} attributes
 * @returns
 */
function getDefaultPayload(config, userId, decisionsJson, attributes) {
  let allSnapshots = [];
  let defaultPayload = {
    account_id: ACCOUNT_ID,
    visitors: [],
    anonymize_ip: true,
    client_name: "Optimizely/Akamai/EventDispatcher",
    client_version: "1.0.0",
    enrich_decisions: true,
  };

  allSnapshots = buildVisitorsSnapshots(
    config,
    userId,
    decisionsJson,
    attributes
  );

  defaultPayload.visitors = [...allSnapshots];
  return JSON.stringify(defaultPayload);
}

/**
 * Custom event dispatcher required to dispatch events back to the Optimizely "logx" endpoint
 * Akamai has several restrictions and limitations that require a custom implementation such
 *
 * @param {*} payload
 */
async function httpDispatcher(payload) {
  const options = {};
  const jsonPayload = JSON.stringify(JSON.parse(payload));

  options.method = "POST";
  options.headers = {
    "Content-Type": "application/json",
    "Content-Length": jsonPayload.length,
  };
  options.body = jsonPayload;
  const url = eventsEndpoint;

  try {
    const response = await httpRequest(url, options);
    return response.status;
  } catch (error) {
    logger.log("HTTPDISP: %s", error.message);
  }
}

// User for development and local testing only
function getFormattedMessage(messageName, messageValue) {
  let result = { Message: "Message value is missing" };
  if (messageName && messageValue) {
    result = { messageName: messageValue };
  }
  return JSON.stringify(result);
}

/**
 * Returns an Optimizely client instance
 *
 * @param {*} sdkKey
 * @param {*} enableEventDispatching
 * @returns
 */
async function optimizelyInit(sdkKey, enableEventDispatching) {
  let optlyDatafile;

  // datafile source values: kvstorage, optly_cdn, embedded
  switch (defaultConfig.datafileSource) {
    case "kvstorage":
      optlyDatafile = await getDatafileFromKv();
      break;
    case "optly_cdn":
      optlyDatafile = await getDataFile(
        inDevelopment,
        defaultConfig.datafileURLTemplate,
        defaultConfig.sdkKey
      );
      break;
    case "embedded":
      optlyDatafile = JSON.stringify(defaultConfig.datafile);
      break;
    default:
      optlyDatafile = JSON.stringify(defaultConfig.datafile);
      break;
  }

  let optlySettings = {
    sdkKey: inDevelopment ? developmentKey : sdkKey,
    datafile: optlyDatafile,
    eventDispatcher: optimizelyEventDispatcher,
    eventBatchSize: 1000,
    eventFlushInterval: 10,
  };

  // If you do not want to download a datafile during development
  if (inDevelopment) {
    delete optlySettings.sdkKey;
  }

  const optimizely = createInstance(optlySettings);
  if (!optimizely) logger.log("Optly Not Init");

  return optimizely;
}

async function getDatafileFromKv() {
  // if (KV_STORAGE_ENABLED) {
  //   let err_msg = "";
  //   let kvDatafile = undefined;
  //   if (inDevelopment) {
  //     logger.log("InDev KVDF");
  //     return JSON.stringify(defaultConfig.datafile);
  //   }
  //   logger.log("Get KVDF");
  //   // Retrieve the default datafile from the EdgeKV
  //   try {
  //     kvDatafile = await edgeKvOptlyConfig.getJson({
  //       item: KV_ITEM_DATA_FILE,
  //     });
  //     logger.log("GOT KVDF");
  //     return JSON.stringify(kvDatafile);
  //   } catch (error) {
  //     // Catch the error and log the error message
  //     err_msg = error.toString();
  //     logger.log(
  //       "Datafile Error: " +
  //         encodeURI(err_msg).replace(/(%20|%0A|%7B|%22|%7D)/g, " ")
  //     );
  //     if (inDevelopment) {
  //       return JSON.stringify(defaultConfig.datafile);
  //     }
  //   }
  // }
  // return defaultConfig.datafile;
}

async function initConfiguration() {
  //
  if (defaultConfigUpdated) {
    return defaultConfig;
  }

  // if (KV_STORAGE_ENABLED) {
  //   logger.log("Get KVCFG");
  //   let err_msg = "";
  //   let kvDefaultConfig = undefined;
  //   // Retrieve the default configuration from the EdgeKV
  //   try {
  //     kvDefaultConfig = await edgeKvOptlyConfig.getJson({
  //       item: KV_ITEM_CONFIG_FILE,
  //     });

  //     //kvDefaultConfig = JSON.parse(kvDefaultConfig);
  //     logger.log("GOT KVCFG");
  //     if (kvDefaultConfig && kvDefaultConfig.version >= defaultConfig.version) {
  //       logger.log("KVConfig is Valid");
  //       defaultConfig = kvDefaultConfig;
  //     }
  //     defaultConfigUpdated = true;
  //   } catch (error) {
  //     // Catch the error and log the error message
  //     err_msg = error.toString();
  //     logger.log(
  //       "Config Error: " +
  //         encodeURI(err_msg).replace(/(%20|%0A|%7B|%22|%7D)/g, " ")
  //     );
  //     defaultConfigUpdated = false;
  //   }
  // }
  return defaultConfig;
}

function getUserId(cookies, request, override_user_id = "false") {
  let existingUserId = "";
  let newUserCreated = true;
  try {
    if (override_user_id !== "true") {
      existingUserId = cookies.get(userCookieName);
      newUserCreated = false;
    }

    const newUserId = existingUserId || `${generateUUID()}`;
    request.setHeader(optlyUserIdsHeaderName, newUserId);
    request.setVariable(userIdVariable, newUserId);
    return [newUserId, newUserCreated];
  } catch (err) {
    logger.log("Error getUserId: %s", err.message);
  }
}

/**
 * Compares active experiments against previouly saved decisions and returns an array with flags that are no longer valid
 *
 * @param {*} assignedDecisions
 * @returns
 */
function getInvalidDecisions(assignedDecisions) {
  let result = [];
  let activeExperiments = getActiveExperiments();
  if (assignedDecisions) {
    for (const decision of assignedDecisions) {
      if (!activeExperiments.includes(decision.featureKey)) {
        result.push(decision);
      }
    }
  }
  return result;
}

/**
 * Compares active experiments against previouly saved decisions and returns an array with flags that are still valid
 *
 * @param assignedDecisions - array of objects
 * @returns array of objects
 */
function getValidStoredDecisions(assignedDecisions) {
  let result = [];
  let activeExperiments = getActiveExperiments();

  if (assignedDecisions) {
    for (const decision of assignedDecisions) {
      if (activeExperiments.includes(decision.featureKey)) {
        result.push(decision);
      }
    }
  }
  return result;
}

/**
 * This method will map the cookie stored values into an object
 * Decisions are stored in a cookie as "flagKey:variationKey:experimentKe", Ex. "flagKey_1:variation_2:experiment1&flagKey_2:off:experiment_2"
 * Example return value: [{"flagKey":"flagKey_1","variationKey":"variation_2", experimentKey: "experiment_1"}, {"flagKey":"flagKey_2","variationKey":"off", "experimentKey":"experiment_2"}]
 *
 * @param cookies
 * @returns array of objects
 */
function deserializeDecisionsFromCookie(cookies) {
  let cookieDecisions = cookies.get(decisionsCookieName);
  if (!cookieDecisions) {
    return undefined;
  }

  let decisions = cookieDecisions
    .split(delimeter)
    .filter((str) => str && str.length > 0 && str !== "null")
    .map((str) => {
      const [featureKey, variationKey, experimentKey] = str.split(
        flag_var_delimiter
      );
      return { featureKey, variationKey, experimentKey };
    });

  return decisions;
}

/**
 * This method will serialize the decisions objects into a delimted string for storing in a cookie and header
 * Example of expected param: [{"flagKey":"flagKey_1","variationKey":"variation_2", experimentKey: "experiment_1"}, {"flagKey":"flagKey_2","variationKey":"off", "experimentKey":"experiment_2"}]
 * Example return value: "flagKey_1:variation_2:experiment1&flagKey_2:off:experiment_2"
 *
 * @param decisions - array of objects
 * @returns string
 */
function serializeDecisions(decisionsJson) {
  let decisions = JSON.parse(decisionsJson);

  return decisions
    .filter(({ variationKey }) => !!variationKey)
    .map(
      ({ featureKey, variationKey, experimentKey }) =>
        featureKey +
        flag_var_delimiter +
        variationKey +
        flag_var_delimiter +
        experimentKey
    )
    .join(delimeter);
}

/**
 * This method will map the decisions from a string into an object
 * String must have the following format "flagKey_1:variation_2:experiment1&flagKey_2:off:experiment_2"
 * Example return value: [{"flagKey":"flagKey_1","variationKey":"variation_2", experimentKey: "experiment_1"}, {"flagKey":"flagKey_2","variationKey":"off", "experimentKey":"experiment_2"}]
 *
 * @param value - string
 * @returns array of objects
 */
function deserializeDecisionsFromString(value) {
  let decisions = value
    .split(delimeter)
    .filter((str) => str && str.length > 0 && str !== "null")
    .map((str) => {
      const [featureKey, variationKey, experimentKey] = str.split(
        flag_var_delimiter
      );
      return { featureKey, variationKey, experimentKey };
    });

  return decisions;
}

/**
 * This method will create the attributes object used for decisions
 * String must have the following format "attribute_1:value_1,attribute_2:value_3,attribute_1:value_3"
 * Example return value: {attribute_1: "value_1", attribute_2: "value_2"}
 *
 * @param value - string
 * @returns object
 */
function getAttributes(attributes) {
  let result = {};

  attributes
    .split(key_value_delimiter)
    .filter((str) => str && str.length > 0 && str !== "null")
    .map((str) => {
      const [name, value] = str.split(flag_var_delimiter);
      result[name] = value;
    });

  return result;
}

// Returns an array list of flag keys requiring a decision
function getFlagKeysFromString(value) {
  if (!value) return [];

  let result = value.split(key_value_delimiter);
  result = trimArray(result);

  return result;
}

/**
 * Sets two request headers with all valid decisions and the current visitor / user ID that will be available to the Origin
 *
 * @param {*} request
 * @param {*} userId
 * @param {*} experiments
 * @param {*} attributes
 */
function setRequestHeaders(request, userId, experimentsJson, attributes) {
  let experiments = JSON.parse(experimentsJson);
  const experimentsSerialized = serializeDecisions(experimentsJson);
  request.setVariable(assignedDecisionsVariable, experimentsSerialized);
  if (IN_AGENT_MODE && AGENT_MODE_ENABLED) {
    request.setVariable(inAgentModeVariable, "true");
    if (attributes)
      request.setVariable(attributesListVariable_1, JSON.stringify(attributes));
  }

  request.setHeader(
    optlyDecisionsHeaderName,
    JSON.stringify({
      key: decisionsKeyName,
      value: experimentsSerialized,
    })
  );

  request.setHeader(
    optlyUserIdsHeaderName,
    JSON.stringify({
      key: userIdentifierKeyName,
      value: userId,
    })
  );
}

// for development and local testing only
function verifyCurrentUrl(url) {
  return requestMatches(url);
}

function evaluateCookie(rule, request, cookies) {
  let result = false;
  // exists, has_value, substring
  switch (rule.evaluation_type) {
    case "exists":
      const cookieNames = cookies.names();
      if (arrayIsValid(cookieNames)) {
        result = cookieNames.indexOf(rule.value);
      }
      break;
    case "has_value":
      const cookieValue = cookies.get(rule.cookie_name);
      result = cookieValue && cookieValue === rule.value;
      break;
    case "substring":
      try {
        let cookieValues = cookies.getAll(rule.cookie_name);
        if (arrayIsValid(cookieValues)) {
          const cookieString = cookieValues.toString();
          result = cookieString && cookieString.search(rule.value) > -1;
        }
      } catch (error) {
        result = false;
        logger.log("CookieEvalSubSt: %s", error);
      }
      break;
    default:
      result = false;
      break;
  }

  if (result) {
    return [result, rule];
  } else {
    return [result, {}];
  }
}

function evaluateUrl(rule, request, cookies) {
  let result = false;
  let urlString = request.url;

  switch (rule.evaluate) {
    case "path": // exact, substring, regex, pattern
      switch (rule.evaluation_type) {
        case "exact":
          result = rule.value === request.url;
          break;
        case "substring":
          result = urlString.search(rule.value) > -1;
          break;
        case "regex":
          const regex = new RegExp(rule.regex);
          result = regex.test(rule.value);
          break;
        case "pattern":
          const urlPattern = new UrlPattern(rule.value);
          result = urlPattern.match(urlString);
          break;
        default:
          result = false;
          break;
      }
      break;
    case "query_param": // exists, has_value, substring
      const params = new URLSearchParams(request.query);
      switch (rule.evaluation_type) {
        case "exists":
          result = params.has(rule.param_name);
          break;
        case "has_value":
          if (params.has(rule.param_name)) {
            const paramValue = params.get(rule.param_name);
            result = paramValue === rule.value;
          }
          break;
        case "substring":
          let paramString = params.toString();
          result = paramString.search(rule.value) > -1;
          break;
        default:
          reuslt = false;
          break;
      }
      break;
    default:
      result = false;
      break;
  }

  if (result) {
    return [result, rule];
  } else {
    return [result, {}];
  }
}

function evaluateRule(rule, request, cookies) {
  let result = false;
  let result_rule = undefined;

  switch (rule.evaluate) {
    case "path":
    case "query_param":
      [result, result_rule] = evaluateUrl(rule, request, cookies);
      break;
    case "cookie":
      [result, result_rule] = evaluateCookie(rule, request, cookies);
      break;
    default:
      result = false;
      break;
  }
  return [result, result_rule];
}

function evaluateAllRules(rules, request, cookies) {
  let result = false;
  let result_rule = undefined;

  try {
    if (arrayIsValid(rules)) {
      rules.forEach(function(rule) {
        if (!result) {
          [result, result_rule] = evaluateRule(rule, request, cookies);
        }
      });
    }
  } catch (error) {
    logger.log(error);
  }

  return result;
}

// Returns a array string list of all flagKeys for valid experiments that are running
function getActiveExperiments(flagList) {
  if (activeExperimentList) {
    return activeExperimentList;
  }

  activeExperimentList = trimArray(
    (defaultConfig.activeExperiments || ACTIVE_EXPERIMENTS || "").split(",")
  );
  return activeExperimentList;
}

async function getDecisionsForRequest(
  request,
  agentMode,
  userId,
  flagsToDecide,
  disableDecissionEvent = true,
  override_user_id = false,
  storedCookieDecisions = undefined,
  validStoredDecisions,
  attributes = undefined
) {
  let allDecisions = []; // concatenated array that will contain all valid previously stored valid and new decisions
  let optimizely; // Optimizely instance required to generate decisions and event tracking
  let user; // The user id and attributes of the user associated with the call to the Decide method
  let reasons; // An array of relevant error and log messages, in chronological order
  let decision; // Used to access an individual OptimizelyDecision object from the decisions array
  let decisions; // Array of all OptimizelyDecision objects for the current user

  if (arrayIsValid(flagsToDecide) && ACTIVE_EXPERIMENTS) {
    optimizely = await optimizelyInit(defaultConfig.sdkKey, false);
    if (attributes) {
      user = optimizely.createUserContext(userId);
    } else {
      user = optimizely.createUserContext(userId, attributes);
    }

    if (disableDecissionEvent) {
      decisions = user.decideForKeys(getActiveExperiments(), [
        optimizelyOptions.DISABLE_DECISION_EVENT,
      ]);
    } else {
      decisions = user.decideForKeys(getActiveExperiments(), [
        optimizelyOptions.DISABLE_DECISION_EVENT,
      ]);
    }

    try {
      flagsToDecide.forEach(function(flagKey) {
        decision = decisions[flagKey];
        const assignedVariation = decision["variationKey"];
        const assignedExperiment = decision["ruleKey"];
        if (assignedVariation) {
          allDecisions.push({
            featureKey: flagKey,
            variationKey: assignedVariation,
            experimentKey: assignedExperiment,
          });
        }
      });
    } catch (error) {
      logger.log("FTDError: %s", error.message);
    }

    if (!agentMode && override_user_id !== "true" && storedCookieDecisions) {
      allDecisions = allDecisions.concat(validStoredDecisions);
    }

    setRequestHeaders(
      request,
      userId,
      JSON.stringify(allDecisions),
      attributes
    );

    reasons = decision["reasons"];
    if (arrayIsValid(reasons)) {
      logger.log("Reasons: %s", JSON.stringify(reasons));
    }
  } else {
    if (!agentMode) allDecisions = validStoredDecisions;
  }

  return [allDecisions, reasons];
}

async function getRequestOptlyDecisions(request) {
  let allDecisions = []; // concatenated array that will contain all valid previously stored valid and new decisions
  let storedCookieDecisions; // contains a list of all previous decisions retrieved from the cookie
  let validStoredDecisions; // contains a list of all sticky decisions that are still valid
  let invalidStoredDecisions; // contains a list of all saved decisions in the cookie that are not longer valid
  let flagsToDecide; // contains a list of all flags that require a new decision
  let reasons; // An array of relevant error and log messages, in chronological order
  let user_id_query_param = "";
  let flagParamFound = false;
  let userId;
  let isNewUser;

  try {
    //   Create query parames object
    const params = new URLSearchParams(request.query);

    //  Used for testing. If set to string "true" all previous decisions are ignored and a new user ID will be generated
    const override_user_id = params.get(OVERRIDE_USER_ID_PARAM);
    // const sdk_key = params.get(SDK_KEY_PARAM);
    // const datafile_source = params.get(DATAFILE_SOURCE_PARAM);
    const flags_query_param = params.get(FLAGS_PARAM);
    const attributes_query_param = params.get(ATTRIBUTES_PARAM);
    if (override_user_id === "true") {
      [user_id_query_param, isNewUser] = getUserId(
        null,
        request,
        override_user_id
      );
    } else {
      user_id_query_param = params.get(USER_ID_PARAM);
      request.setVariable(userIdVariable, user_id_query_param);
    }

    flagParamFound = !!flags_query_param;
    if (flagParamFound) {
      IN_AGENT_MODE = true;
      const decisionAttributes = getAttributes(attributes_query_param);
      flagsToDecide = getFlagKeysFromString(flags_query_param);
      request.setVariable(flagsListVariable, (flagsToDecide || "").join());
      [allDecisions, reasons] = await getDecisionsForRequest(
        request,
        IN_AGENT_MODE,
        user_id_query_param,
        flagsToDecide,
        DISABLE_DECISION_EVENT,
        override_user_id,
        null,
        null,
        decisionAttributes
      );
    } else {
      //  Look for any previous decisions stored in a cookie
      IN_AGENT_MODE = false;
      DISABLE_DECISION_EVENT = true;
      let cookies = new Cookies(request.getHeader("Cookie") || "");
      [userId, isNewUser] = getUserId(cookies, request, override_user_id);

      //  Validates if we should get a decision for the current URL path
      const urlValidForTesting = verifyCurrentUrl(request.url);
      const rulesAreValid = evaluateAllRules(
        defaultConfig.experimentFlagRules,
        request,
        cookies
      );

      if (urlValidForTesting) { // will always return true as this functionality is not yet implemented        
        await initConfiguration();
        
        // Do not check for stored decisions on new users. If the user ID cookie is missing but the decisions cookie
        // exists, we need to treat this operation as if we are dealing with a brand new visitor
        if (!isNewUser) {
          storedCookieDecisions = deserializeDecisionsFromCookie(cookies); 
        }

        // get previously stored decision from the cookie
        if (storedCookieDecisions || override_user_id === "true") {
          flagsToDecide = storedCookieDecisions
            ? getActiveExperiments(storedCookieDecisions)
            : getActiveExperiments();
        } else {
          flagsToDecide = getActiveExperiments();
        }

        //  Save flags that require a new decision to a user variable. These flags will be retrieved in the response event handler
        //  where we will get decisions and dispatch them back to Optimizely via HTTP Post. We need to do this since onClientRequest
        //  does not support "POST" in sub-requests, but onClientResponse and responseProvider do suppport it.
        request.setVariable(flagsListVariable, (flagsToDecide || "").join());

        if (override_user_id !== "true" && storedCookieDecisions) {
          //  ToDo - where do we get this list of keys from? KV store?
          invalidStoredDecisions = getInvalidDecisions(storedCookieDecisions);
          validStoredDecisions = getValidStoredDecisions(storedCookieDecisions);
        }

        [allDecisions, reasons] = await getDecisionsForRequest(
          request,
          IN_AGENT_MODE,
          userId,
          flagsToDecide,
          DISABLE_DECISION_EVENT,
          override_user_id,
          storedCookieDecisions,
          validStoredDecisions
        );

        // setRequestHeaders(request, userId, allDecisions);
      }
    }

    return [allDecisions, reasons];
  } catch (err) {
    logger.log(
      "Failed to complete processing operations within onClientRequest: %s",
      err.message
    );
  }
}

async function onClientRequest(request) {
  // Get decisions for the current visitor and set the origin headers with all valid decisions
  // The decisions object will contain an array of objects with featureKey, variationKey and experimentKey
  let [decisions, reasons] = await getRequestOptlyDecisions(request);

  // Do something with the decisions here...
  /******************** Your code starts here *******************/

  /******************** Your code ends here ********************/
}

// Sets response headers with the assigned user ID and decisions
function setResponseHeaders(
  request,
  response,
  assignedUserId,
  experiments,
  attributes
) {
  let experimentsSerialized = serializeDecisions(experiments);
  request.setVariable(assignedDecisionsVariable, experimentsSerialized);
  if (IN_AGENT_MODE && AGENT_MODE_ENABLED) {
    request.setVariable(inAgentModeVariable, "true");
    request.setVariable(attributesListVariable_1, JSON.stringify(attributes));
  }

  let expDate = new Date();
  expDate.setDate(getValidTimeStamp(cookieExpirationInDays));

  if (experimentsSerialized) {
    let setDecisionsCookie = new SetCookie({
      name: decisionsCookieName,
      value: experimentsSerialized,
      expires: expDate,
    });
    response.addHeader("Set-Cookie", setDecisionsCookie.toHeader());
  }

  // Set the user ID in a cookie
  if (assignedUserId) {
    let setUserIdCookie = new SetCookie({
      name: userCookieName,
      value: assignedUserId,
      expires: expDate,
    });
    response.addHeader("Set-Cookie", setUserIdCookie.toHeader());
  }

  try {
    response.setHeader(
      optlyDecisionsHeaderName,
      JSON.stringify({
        key: decisionsKeyName,
        value: experimentsSerialized,
      })
    );

    response.setHeader(
      optlyUserIdsHeaderName,
      JSON.stringify({
        key: userIdentifierKeyName,
        value: assignedUserId,
      })
    );
  } catch (err) {
    logger.log("Error in onClientResponse: %s", err.message);
  }
}

//Math.floor((new Date()).getTime() / 1000)
function getValidTimeStamp(daysToAdd) {
  try {
    let expDate = new Date();
    if (daysToAdd) {
      return expDate.getDate() + daysToAdd;
    } else {
      return expDate.getDate();
    }
  } catch (error) {
    return undefined;
  }
}

/**
 * Builds event decision payload and dispatches them back to the Optimizely events endpoint.
 *
 * @param {*} request
 * @param {*} response
 * @returns
 */
async function dispatchDecisionEvent(request, response) {
  let config;
  let flagsToDecide;
  let attributes;
  let decision;
  let decisions;
  let allDecisions = [];
  let decisionsPayload;
  let assignedDecisions;
  let assignedUserId;
  let user;

  IN_AGENT_MODE = request.getVariable(inAgentModeVariable) === "true";
  if (IN_AGENT_MODE && AGENT_MODE_ENABLED) {
    let tempAttributes = request.getVariable(attributesListVariable_1);
    if (tempAttributes) {
      attributes = JSON.parse(tempAttributes);
    }
  }

  // Retrieve the user ID and decisions from PMUSER variables
  // These values are set on the onClientRequest
  assignedDecisions = request.getVariable(assignedDecisionsVariable);
  assignedUserId = request.getVariable(userIdVariable);

  // Set decisions in cookie with an experiration date for stickiness

  const isUrlValidForDecision = verifyCurrentUrl(request.url); // ToDo - evaluate rules?
  if (assignedUserId && isUrlValidForDecision) {
    let flagKeysToDecide = request.getVariable(flagsListVariable);
    flagsToDecide = trimArray((flagKeysToDecide || "").split(","));

    if (arrayIsValid(flagsToDecide)) {
      await initConfiguration();
      const optimizely = await optimizelyInit(defaultConfig.sdkKey, false);
      if (AGENT_MODE_ENABLED && IN_AGENT_MODE && attributes) {
        user = optimizely.createUserContext(assignedUserId, attributes);
      } else {
        user = optimizely.createUserContext(assignedUserId);
      }
      decisions = user.decideForKeys(flagsToDecide);
      //logger.log("DPEVFTD: %s", JSON.stringify(flagsToDecide));
      flagsToDecide.forEach(function(flagKey) {
        decision = decisions[flagKey];
        const assignedVariation = decision["variationKey"];
        const assignedExperiment = decision["ruleKey"];
        if (assignedVariation) {
          allDecisions.push({
            featureKey: flagKey,
            variationKey: assignedVariation,
            experimentKey: assignedExperiment,
          });
        }
      });

      try {
        config = optimizely.getOptimizelyConfig();
        decisionsPayload = getDefaultPayload(
          config,
          assignedUserId,
          JSON.stringify(allDecisions),
          attributes
        );
      } catch (error) {
        logger.log("GETDPAY: %s", error.message);
      }

      const responseStatus = await httpDispatcher(
        JSON.stringify(JSON.parse(decisionsPayload))
      );

      let jsonDecisions = JSON.stringify(allDecisions);
      // Set headers with the user ID and assigned decisions
      if (responseStatus === 204) {
        setResponseHeaders(
          request,
          response,
          assignedUserId,
          jsonDecisions,
          attributes
        );
      } else {
        logger.log(
          "Unable to dispatch decision event with status %s",
          responseStatus
        );
      }

      return [responseStatus, jsonDecisions];
    }
  }
}

async function onClientResponse(request, response) {
  try {
    // Dispatch all new decisions back to Optimizely
    // Returns the HTTP response status code and the decisions array
    let [httpResponse, allDecisions] = await dispatchDecisionEvent(
      request,
      response
    );

    logger.log("ResponseDec: %s", JSON.stringify(allDecisions));

    /******************** Your code starts here *******************/

    /******************** Your code ends here ********************/
  } catch (err) {
    // Catch any errors and return the appropriate response
    logger.log("Error in onClientResponse: %s", err.message);
    return request.respondWith(500, {}, err.message);
  }
}

// Used for testing in the browser. You should disable for production.
async function onOriginResponse(request, response) {
  let attributes = {};
  try {
    // let flagKeysToDecide = request.getVariable(flagsListVariable);
    let assignedDecisions = request.getVariable(assignedDecisionsVariable);
    let assignedUserId = request.getVariable(userIdVariable);

    // prettier-ignore
    const htmlResponse = '<html><body>'
            // + '<h1>HTTP Response: ' + httpResponse + '</h1>'        
            + '<h1>User: ' + assignedUserId + '</h1>'
            + '<h2>Decisions: ' + assignedDecisions + '</h2>'
            // + '<h2>Attributes: ' + JSON.stringify(attributes) + '</h2>'
            // + '<h2>Decisions Array: ' + JSON.stringify(decisionsPayload) + '</h2>'
            // + '<h2>Decisions Payload: ' + (JSON.stringify(decisionsPayload)).slice(0, 1800) + '</h2>'
            + '</body></html>';

    request.respondWith(
      200,
      {
        /* "Content-Type": "application/json" */
      },
      htmlResponse
    );
  } catch (err) {
    logger.log("Error in onOriginResponse: %s", err.message);
    return request.respondWith(500, {}, err.message);
  }
}

// async function responseProvider(request) {
// }

export default {
  onClientResponse,
  onClientRequest,
  onOriginResponse,
  // responseProvider,
};
