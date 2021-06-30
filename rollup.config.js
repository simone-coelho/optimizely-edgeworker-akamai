import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy-assets';
import json from 'rollup-plugin-json';

export default {
  // Specify main file for EdgeWorker
  input: 'index.js',
  // Define external modules, which will be provided by the EdgeWorker platform
  external: ['cookies', 'http-request', 'log', 'create-response'],
  // Define output format as an ES module and specify the output directory
  output: {
    format: 'es',
    file: 'dist/main.js',
    outro: "var window = commonjsGlobal; var setTimeout = function(){}; var clearTimeout = new function(){};"
  },
  // Bundle all modules into a single output module
  preserveModules: false,

  plugins: [
    // Convert CommonJS modules to ES6
    commonjs(
      {
        namedExports: {
          '@optimizely/js-sdk-logging': [
            'ConsoleLogHandler',
            'getLogger',
            'setLogLevel',
            'LogLevel',
            'setLogHandler',
            'setErrorHandler',
            'getErrorHandler',
          ],
          //'@optimizely/js-sdk-event-processor': ['LogTierV1EventProcessor', 'LocalStoragePendingEventsDispatcher'],
        },
      }
    ),
    // Resolve modules from node_modules
    resolve({browser: true}),
    // Copy bundle.json to the output directory
    copy({
      assets: [
        './bundle.json',
        // './edgekv.js',
        // './edgekv_tokens.js'
      ]
    }),
    // Package json data as an ES6 module
    json()
  ]
};
