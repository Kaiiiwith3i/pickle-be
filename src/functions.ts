/** Cloud Functions entry: the same Express app `npm run dev` serves, deployed as one HTTPS function. */
import { onRequest } from 'firebase-functions/v2/https';

import { createApp } from './app';

export const api = onRequest({ region: 'asia-southeast1' }, createApp());
