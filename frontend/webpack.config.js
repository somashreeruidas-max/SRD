const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const { InjectManifest } = require('workbox-webpack-plugin');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    // Enable PWA mode
    mode: env.mode || 'production',
    pwa: true,
  }, argv);
  
  // Add PWA manifest link to HTML
  if (config.mode === 'production' || config.mode === 'development') {
    config.plugins.push(
      new InjectManifest({
        swSrc: './service-worker.js',
        swDest: 'service-worker.js',
        // Don't precache the manifest file
        exclude: [/\.map$/, /manifest\.json$/],
      })
    );
  }
  
  return config;
};
