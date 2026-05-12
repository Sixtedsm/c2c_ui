/* eslint-disable no-console */
import { register } from 'register-service-worker';

if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    updated() {
      console.log('New version of the app is available. Refresh to apply.');
    },
    error(error) {
      console.error('Service worker registration failed:', error);
    },
  });
}
