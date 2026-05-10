import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { I18nProvider } from './src/i18n';

const fontAssets = {
  'PoolSans-Regular': require('./assets/fonts/PoolSans-Regular.ttf'),
  'PoolSans-Medium': require('./assets/fonts/PoolSans-Medium.ttf'),
  'PoolDisplay-Regular': require('./assets/fonts/PoolDisplay-Regular.ttf'),
  'PoolDisplay-Medium': require('./assets/fonts/PoolDisplay-Medium.ttf'),
  'PoolDisplayCondensed-Black': require('./assets/fonts/PoolDisplayCondensed-Black.ttf'),
  'PoolDisplayCondensed-Bold': require('./assets/fonts/PoolDisplayCondensed-Bold.ttf'),
};

if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

export default function App() {
  useFonts(fontAssets);

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StatusBar style="light" />
        <RootNavigator />
        <Toast />
      </I18nProvider>
    </SafeAreaProvider>
  );
}
