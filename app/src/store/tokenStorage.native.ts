import * as SecureStore from 'expo-secure-store';

export const getToken = (key: string) => SecureStore.getItemAsync(key);
export const setToken = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const deleteToken = (key: string) => SecureStore.deleteItemAsync(key);
