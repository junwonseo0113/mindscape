import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app is the same web app, built by Vite into dist/ and wrapped in a
// native shell by Capacitor. Build it with `npm run build:ios` (see
// APP-STORE.md), which also points the app at the deployed API.
const config: CapacitorConfig = {
  // The App Store identity. It can't be changed once the app is live, so
  // set it to your own reverse-domain ID before the first upload.
  appId: "com.junwonseo.mindscape",
  appName: "Mindscape",
  webDir: "dist",
  backgroundColor: "#EDEAE4",
  ios: {
    // The app lays itself out under the notch/home bar using
    // env(safe-area-inset-*), so the web view runs edge to edge.
    contentInset: "never",
    backgroundColor: "#EDEAE4",
    // No rubber-band bounce on the whole page; the app scrolls its own panes.
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#EDEAE4",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      overlaysWebView: true,
    },
  },
};

export default config;
