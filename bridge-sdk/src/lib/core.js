import {promiseCallback} from './promise_callback.js';
import {encodeBase64andURI} from './encode';

const isNodeEnv = typeof window === 'undefined' || !window.document;

class FallBackJSB {
    constructor() {
        this.dispatchMsgPath = 'dispatch_message/';
        this.setResultPath = 'private/setresult/';
        this.fetchQueue = 'SCENE_FETCHQUEUE';
        this.handleMsgScene = 'SCENE_HANDLEMSGFROMTT';
        this.readyMessageIframeId = '__NativeJSBridgeIframe';
        this.setResultIframeId = '__NativeJSBridgeIframe_SetResult';
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
        this._dispatchUrlMsg(this.setResultIframeId, `${this.bridgeScheme}${this.setResultPath}${scene}&${encodeBase64andURI(result)}`);
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

        /* 注意
        1. 如果新建iframe，需要先append到dom中再赋值，否则<4.4的安卓机器会出现在web页面上盖一层
 native的"网络不给力，点击重试"页面
        2。不要改成每次都新建iframe，插入iframe会触发ios的webViewDidStartLoad，导致客户端清空之前设置的分享有关信息
         */

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
        switch (msgType) {
            case 'callback': {
                const callbackId = message['__callback_id'];
                ret = {
                    __err_code: 'cb404',
                };
                params = this._resolveCallBackData(this.callBackDataMap[callbackId], params);
                if (typeof callbackId === 'string' && typeof this.callbackMap[callbackId] === 'function') {
                    ret = this.callbackMap[callbackId](params);
                    delete this.callbackMap[callbackId]; // why delete?
                }
                break;
            }
            case 'event': {
                const eventId = message['__event_id'];
                ret = {
                    __err_code: 'ev404',
                };
                params = this._resolveCallBackData(this.callBackDataMap[eventId], params);
                if (typeof eventId === 'string' && Array.isArray(this.eventHookMap[eventId])) {
                    this.eventHookMap[eventId].forEach((handler) => {
                        if (typeof handler === 'function') {
                            ret = handler(params);
                        }
                    });
                }
                break;
            }
            default:
                break;
        }
        return JSON.stringify(ret);
    }

    _resolveCallBackData (eventName, data) {
        let realData = data;
        if (this.actionMap[eventName] && this.actionMap[eventName]['callback']) {
            realData = this.actionMap[eventName]['callback'](data);
        }
        return realData;
    }

    _call (func, params = {}, callback = null, sdkVersion = 1) {
        if (!func || typeof func !== 'string') {
            return;
        }
        if (this.actionMap[func] && this.actionMap[func].fallbackcall) {
            var fallbackcallResult = this.actionMap[func].fallbackcall(params);
            if (fallbackcallResult) {
                params = fallbackcallResult;
            } else {
                // this.actionMap[func].fallbackcall(params);
                return;
            }
        }

        let callbackID;
        this.callbackId += 1;
        callbackID = this.callbackId.toString();

        let fn = callback;
        if (typeof fn === 'function') {
            // this.callbackMap[callbackID] = this._resolveCallBackData(fn, func);
            this.callbackMap[callbackID] = fn;
        } else {
            fn = promiseCallback();
            this.callbackMap[callbackID] = fn;
        }
        this.callBackDataMap[callbackID] = func;

        const msgJSON = {
            JSSDK: sdkVersion,
            func: this.actionMap[func] ? this.actionMap[func]['native'] : func,
            params,
            __msg_type: 'call',
            __callback_id: callbackID,
        };

        this.sendMessageQueue.push(msgJSON);
        this._dispatchUrlMsg(this.readyMessageIframeId, `${this.bridgeScheme}${this.dispatchMsgPath}`);
        return fn.promise;
    }

    /**
     * web: 自定义事件和回调
     * @param {string} event Event name.
     * @param {Function} callback
     */
    _on(event, callback, sdkVersion = 1) {
        if (!event || typeof event !== 'string' || typeof callback !== 'function') {
            return;
        }
        if (this.actionMap[event] && this.actionMap[event]['native']) {
            event = this.actionMap[event] ? this.actionMap[event]['native'] : event;
        }

        if (this.eventHookMap[event]) {
            this.eventHookMap[event].push(callback);
        } else {
            this.eventHookMap[event] = [callback];
        }

        if (this.actionMap[event] && this.actionMap[event].fallbackcall) {
            this.actionMap[event].fallbackcall({}, callback);
            return;
        }

        this._call('addEventListener', {name: event}, null, sdkVersion);
    }

    /**
     * web: 和on相对，解除注册
     * @param {string} event Event name.
     * @param {Function} callback
     */
    _off(event, callback) {
        if (!event || typeof event !== 'string' || typeof callback !== 'function') {
            return;
        }
        if (this.actionMap[event] && this.actionMap[event]['native']) {
            event = this.actionMap[event] ? this.actionMap[event]['native'] : event;
        }

        if (this.eventHookMap[event]) {
            this.eventHookMap[event] = this.eventHookMap[event].filter(_callback => _callback !== callback);
        }
    }

    /**
     * Trigger event.
     * @param {string} event
     * @param {Object} msgParams
     * @returns {boolean} Has handled.
     */
    _trigger(event, msgParams) {
        if (this.eventHookMap[event]) {
            this.eventHookMap[event].forEach((handler) => {
                if (typeof handler === 'function') {
                    handler(msgParams);
                }
            });
        }
    }

    init (options, APILIST) {
        let bridge = {
            call: (...args) => this._call(...args),
            on: (...args) => this._on(...args),
            off: (...args) => this._off(...args),
            trigger: (...args) => this._trigger(...args),
        };
        // 原bridge中可能暴露的关于头条的信息，作为配置项传入，方便兼容保密项目
        this.jsBridgeKey = options.jsBridgeKey;
        this.bridgeScheme = options.bridgeScheme;
        // 注册API
        for (let key in APILIST) {
            this.actionMap[key] = APILIST[key];
        }

        if (!isNodeEnv) {
            if (!window[this.jsBridgeKey]) { // 判断 jsBridgeKey 是否是第一次初始化
                this._createQueueReadyIframe(); // 初始化iframe
                window[this.jsBridgeKey] = {}; // 对客户端暴露
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
