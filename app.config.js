// Build variant switch. Without APP_VARIANT (or with any value other than "preview") the config is app.json, untouched: production
// resolves byte-identical. APP_VARIANT=preview installs ALONGSIDE production: its own Android package and iOS bundle id (suffix .preview),
// its own name, and NO googleServicesFile (no Firebase client is registered for the preview id, so push tokens fail there by design;
// the App logs that and carries on, see src/services/pushRegistro.js). The EAS "preview" profile sets APP_VARIANT in eas.json.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'preview') return config;
  const { googleServicesFile, ...android } = config.android;
  return {
    ...config,
    name: config.name + ' Preview',
    android: { ...android, package: config.android.package + '.preview' },
    ios: { ...config.ios, bundleIdentifier: config.ios.bundleIdentifier + '.preview' },
  };
};
