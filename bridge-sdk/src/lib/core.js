import {promiseCallback} from './promise_callback.js';
import {encodeBase64andURI} from './encode';

const isNodeEnv = typeof window === 'undefined' || !window.document;

class FallBackJSB {
  constructor() {
    this.dispatchMsgPath = 'dispatch_message/';
    this.setResultPath = 'private/setresult/';
    this.fetchQueue = 'SCENE_FETCHQUEUE';
    this.handleMsgScene = 'SCENE_HANDLEMSGFROMTT';
    this.readyMessageIframedId = '__NativeJSBridgeIframe';
    this.setResultIframedId = '__NativeJSBridgeIframe_SetResult';
    this.callbackId = 1000;
    this.callbackMap = {};
    this.callBackDataMap = {};
    this.eventHookMap = {};
    this.sendMessageQueue = [];
    this.actionMap = {};
    this.readyMessageIframe = null;
    this.setResultIframe = null;
  }
  
  _createQueueReadyIframe() {
    this.setResultIframe = document.createElement('iframe');
    this.setResultIframe.id = this.setResultIframeId;
    this.setResultIframe.style.display = 'none';
    document.documentElement.appendChild(this.setResultIframe);

    this.readyMessageIframe = document.createElement('iframe');
    this.readyMessageIframe.id = this.readyMessageIframeId;
    this.readyMessageIframe.style.display = 'none';
    document.documentElement.appendChild(this.readyMessageIframe);

  }
  
  _setResultValue(scene, result) {
    this._dispatchUrlMsg(this.setResultIframeId, `${this.bridgeSchema}${this.setResultPath}${scene}&${encodeBase64andURI(result)}`);
  }
  
  _fetchQueue() {
    const messageQueueString = JSON.stringify(this.sendMessageQueue);
    if (this.sendMessageQueue.length > 0) {
      this._setResultValue(this.fetchQueue, messageQueueString);
    }
    this.sendMessageQueue = [];
    return messageQueueString;
  }
  
  _dispatchUrlMsg(frameId, url) {
    if (!isNodeEnv) {
      let _frame = document.getElementById(frameId);
      
      if (_frame && _frame.tagName === 'IFRAME' && _frame.parentNode) {
        _frame.src = url;
      } else {
        _frame = document.createElement('iframe');
        _frame.id = frameId;
        _frame.style.display = 'none';
        document.documentElement.appendChild(_frame);
        _frame.src = url;
      }
    }
  }
  
  _handleMessageFromApp(message) {
    let ret;
    const msgType = message['__msg_type'];
    let params = message['__params'];
    
    switch(msgType) {
      case 'callback': {
        const 'callback': {
          const callbackId = message['__callback_id'];
          ret = {
            __err_code: 'cb404',
          };
        }
      }
      case 'event': {}
      default: break;
    }
    return JSON.stringify(ret);
  }
  
  _resolveCallBackData (eventName, data) {
  
  }
  
  _call (func, params = {}, callback = null, skdVersion = 1) {
    
  }
  
  _on (event, callback, sdkVersion = 1) {
  
  }
  
  _off (event, callback) {
  
  }
  
  _trigger(event, msgParams) {
  
  }
  
  init (options, APILIST) {
    let bridge = {
      call: (...args) => this._call(...args),
      on: (...args) => this._on(...args),
      off: (...args) => this._off(...args),
      trigger: (...args) => this._trigger(...args)
    }
    
    this.jsBridgeKey = options.jsBridgeKey;
    this.bridfeSchema = options.bridgeSchema;
    
    for (let key in APILIST) {
      this.actionMap[key] = APILIST[key];
    }
    
    if (!isNodeEnv) {
      if (!window[this.jsBridgeKey]) {
        this._createQueueReadyIframe();
        window[this.jsBridgeKey] = {};
        window[this.jsBridgeKey]['_fetchQueue'] = (...args) => this._fetchQueue(...args);
        window[this.jsBridgeKey][options.handleMessageKey] = (...args) => this._handleMessageFromApp(...args);
      } else {
        bridge = window[this.jsBridgeKey];
      }
    }
    
    return bridge;
  }
}

export default FallBackJSB;
