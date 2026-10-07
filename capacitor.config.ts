import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.besika40k.novelreader',
  appName: 'Novel Reader',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // index.html draws edge to edge (viewport-fit=cover); saying so up front avoids a layout jump.
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
