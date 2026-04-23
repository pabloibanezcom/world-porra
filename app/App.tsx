import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';

const fontAssets = {
  'FIFASans-Regular': require('./assets/fonts/FIFASans-Regular.ttf'),
  'FIFASans-Medium': require('./assets/fonts/FIFASans-Medium.ttf'),
  'FWC26-NormalRegular': require('./assets/fonts/FWC26-NormalRegular.ttf'),
  'FWC26-NormalMedium': require('./assets/fonts/FWC26-NormalMedium.ttf'),
  'FWC26-UltraCondensedBlack': require('./assets/fonts/FWC26-UltraCondensedBlack.ttf'),
  'FWC26-UltraCondensedBold': require('./assets/fonts/FWC26-UltraCondensedBold.ttf'),
};

if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

export default function App() {
  useFonts(fontAssets);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RootNavigator />
      <Toast />
    </SafeAreaProvider>
  );
}
