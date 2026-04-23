export const getToken = (_key: string) => Promise.resolve(localStorage.getItem(_key));
export const setToken = (_key: string, value: string) => Promise.resolve(localStorage.setItem(_key, value));
export const deleteToken = (_key: string) => Promise.resolve(localStorage.removeItem(_key));
