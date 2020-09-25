import {promiseCallback} from './promise_callback.js';
import {encodeBase64andURI} from './encode';

const isNodeEnv = typeof window === 'undefined' || !window.document;

