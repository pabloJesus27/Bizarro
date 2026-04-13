import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bizarro.app',
  appName: 'Bizarro',
  webDir: 'out',
  server: {
    url: 'https://bizarro-woad.vercel.app',
    cleartext: false
  }
};

export default config;
