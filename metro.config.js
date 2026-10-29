const { getDefaultConfig } = require('expo/metro-config');

// Use the standard Expo Metro config.
// The previous custom watcher.additionalExclusions option is not supported by EAS
// and triggered validation warnings during Android builds.
const config = getDefaultConfig(__dirname);

module.exports = config;
