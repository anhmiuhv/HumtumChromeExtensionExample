export default class ActionCable {

    static debugging;

    static INTERNAL = {
        "message_types": {
            "welcome": "welcome",
            "ping": "ping",
            "confirmation": "confirm_subscription",
            "rejection": "reject_subscription"
        },
        "default_mount_path": "/cable",
        "protocols": ["actioncable-v1-json", "actioncable-unsupported"]
    }
    static createConsumer = (url, jwt) => {
        var ref;
        if (url == null) {
            url = (ref = ActionCable.getConfig("url")) != null ? ref : ActionCable.INTERNAL.default_mount_path;
        }
        return new Consumer(ActionCable.createWebSocketURL(url), jwt);
    }
    static getConfig = (name) => {
        if (!document.head) return null;
        var element;
        element = document.head.querySelector("meta[name='action-cable-" + name + "']");
        return element != null ? element.getAttribute("content") : void 0;
    }
    static createWebSocketURL = (url) => {
        var a;
        if (url && !/^wss?:/i.test(url) &&
            Object.getOwnPropertyNames(document).includes("createElement")) {
            a = document.createElement("a");
            a.href = url;
            a.href = a.href;
            a.protocol = a.protocol.replace("http", "ws");
            return a.href;
        } else {
            return url.replace(/^http/, 'ws');
        }
    }
    static startDebugging = () => {
        return ActionCable.debugging = true;
    }
    static stopDebugging = () => {
        return ActionCable.debugging = null;
    }
    static log = function(message) {
 
        if (this.debugging) {
            messages.push(Date.now());
            return console.log.apply(console, ["[ActionCable]"].concat(this.slice.call(messages)));
        }
    }
};



class ConnectionMonitor {

    pollInterval = {
        min: 3,
        max: 30
    };

    staleThreshold = 6;

    constructor(connection) {
        this.connection = connection;
        this.reconnectAttempts = 0;
    }

    start = () => {
        if (!this.isRunning()) {
            this.startedAt = this.now();
            delete this.stoppedAt;
            this.startPolling();
            document.addEventListener("visibilitychange", this.visibilityDidChange);
            return ActionCable.log("ConnectionMonitor started. pollInterval = " + (this.getPollInterval()) + " ms");
        }
    };

    stop = () => {
        if (this.isRunning()) {
            this.stoppedAt = this.now();
            this.stopPolling();
            document.removeEventListener("visibilitychange", this.visibilityDidChange);
            return ActionCable.log("ConnectionMonitor stopped");
        }
    };

    isRunning = () => {
        return (this.startedAt != null) && (this.stoppedAt == null);
    };

    recordPing = () => {
        return this.pingedAt = this.now();
    };

    recordConnect = () => {
        this.reconnectAttempts = 0;
        this.recordPing();
        delete this.disconnectedAt;
        return ActionCable.log("ConnectionMonitor recorded connect");
    };

    recordDisconnect = () => {
        this.disconnectedAt = this.now();
        return ActionCable.log("ConnectionMonitor recorded disconnect");
    };

    startPolling = () => {
        this.stopPolling();
        return this.poll();
    };

    stopPolling = () => {
        return clearTimeout(this.pollTimeout);
    };

    poll = () => {
        return this.pollTimeout = setTimeout((function (_this) {
            return () => {
                _this.reconnectIfStale();
                return _this.poll();
            };
        })(this), this.getPollInterval());
    };

    getPollInterval = () => {
        var interval, max, min, ref;
        ref = this.pollInterval, min = ref.min, max = ref.max;
        interval = 5 * Math.log(this.reconnectAttempts + 1);
        return Math.round(this.clamp(interval, min, max) * 1000);
    };

    reconnectIfStale = () => {
        if (this.connectionIsStale()) {
            ActionCable.log("ConnectionMonitor detected stale connection. reconnectAttempts = " + this.reconnectAttempts + ", pollInterval = " + (this.getPollInterval()) + " ms, time disconnected = " + (this.secondsSince(this.disconnectedAt)) + " s, stale threshold = " + this.staleThreshold + " s");
            this.reconnectAttempts++;
            if (this.disconnectedRecently()) {
                return ActionCable.log("ConnectionMonitor skipping reopening recent disconnect");
            } else {
                ActionCable.log("ConnectionMonitor reopening");
                return this.connection.reopen();
            }
        }
    };

    connectionIsStale = () => {
        var ref;
        return this.secondsSince((ref = this.pingedAt) != null ? ref : this.startedAt) > this.staleThreshold;
    };

    disconnectedRecently = () => {
        return this.disconnectedAt && this.secondsSince(this.disconnectedAt) < this.staleThreshold;
    };

    visibilityDidChange = () => {
        if (document.visibilityState === "visible") {
            return setTimeout((function (_this) {
                return () => {
                    if (_this.connectionIsStale() || !_this.connection.isOpen()) {
                        ActionCable.log("ConnectionMonitor reopening stale connection on visibilitychange. visbilityState = " + document.visibilityState);
                        return _this.connection.reopen();
                    }
                };
            })(this), 200);
        }
    };

    now = () => {
        return new Date().getTime();
    };

    secondsSince = (time) => {
        return (this.now() - time) / 1000;
    };

    clamp = (number, min, max) => {
        return Math.max(min, Math.min(max, number));
    };


};

class Connection {

    reopenDelay = 500;

    constructor(consumer) {
        this.consumer = consumer;
        this.subscriptions = this.consumer.subscriptions;
        this.monitor = new ConnectionMonitor(this);
        this.disconnected = true;
        const ref = ActionCable.INTERNAL
        this.message_types = ref.message_types
        this.protocols = ref.protocols;

        this.supportedProtocols = 2 <= this.protocols.length ? this.protocols.slice(0, this.protocols.length - 1) : []
        this.unsupportedProtocol = this.protocols[this.protocols.length - 1];
    }

    send = (data) => {
        if (this.isOpen()) {
            this.webSocket.send(JSON.stringify(data));
            return true;
        } else {
            return false;
        }
    };

    open = () => {
        if (this.isActive()) {
            ActionCable.log("Attempted to open WebSocket, but existing socket is " + (this.getState()));
            throw new Error("Existing connection must be closed before opening");
        } else {
            ActionCable.log("Opening WebSocket, current state is " + (this.getState()) + ", subprotocols: " + this.protocols);
            if (this.webSocket != null) {
                this.uninstallEventHandlers();
            }
            this.webSocket = new WebSocket(this.consumer.url, this.protocols.concat(this.consumer.jwt), {
                origin: this.consumer.origin
            });
            this.installEventHandlers();
            this.monitor.start();
            return true;
        }
    };

    close = (arg) => {
        var allowReconnect, ref1;
        allowReconnect = (arg != null ? arg : {
            allowReconnect: true
        }).allowReconnect;
        if (!allowReconnect) {
            this.monitor.stop();
        }
        if (this.isActive()) {
            return (ref1 = this.webSocket) != null ? ref1.close() : void 0;
        }
    };

    reopen = () => {
        var error, error1;
        ActionCable.log("Reopening WebSocket, current state is " + (this.getState()));
        if (this.isActive()) {
            try {
                return this.close();
            } catch (error1) {
                error = error1;
                return ActionCable.log("Failed to reopen WebSocket", error);
            } finally {
                ActionCable.log("Reopening WebSocket in " + this.reopenDelay + "ms");
                setTimeout(this.open, this.reopenDelay);
            }
        } else {
            return this.open();
        }
    };

    getProtocol = () => {
        var ref1;
        return (ref1 = this.webSocket) != null ? ref1.protocol : void 0;
    };

    isOpen = () => {
        return this.isState("open");
    };

    isActive = () => {
        return this.isState("open", "connecting");
    };

    isProtocolSupported = () => {
        var ref1;
        return ref1 = this.getProtocol(), this.supportedProtocols.indexOf(ref1) >= 0;
    };

    isState = (states) => {
        var ref1;
        return ref1 = this.getState(), states.indexOf(ref1) >= 0;
    };

    getState = () => {
        var ref1, state, value;
        for (state in WebSocket) {
            value = WebSocket[state];
            if (value === ((ref1 = this.webSocket) != null ? ref1.readyState : void 0)) {
                return state.toLowerCase();
            }
        }
        return null;
    };

    installEventHandlers = () => {
        var eventName, handler;
        for (eventName in this.events) {
            handler = this.events[eventName].bind(this);
            this.webSocket["on" + eventName] = handler;
        }
    };

    uninstallEventHandlers = () => {
        var eventName;
        for (eventName in this.events) {
            this.webSocket["on" + eventName] = () => {};
        }
    };

    events = {
        message: function (event) {
            var identifier, message, ref1, type;
            if (!this.isProtocolSupported()) {
                return;
            }
            ref1 = JSON.parse(event.data), identifier = ref1.identifier, message = ref1.message, type = ref1.type;
            switch (type) {
                case this.message_types.welcome:
                    this.monitor.recordConnect();
                    return this.subscriptions.reload();
                case this.message_types.ping:
                    return this.monitor.recordPing();
                case this.message_types.confirmation:
                    return this.subscriptions.notify(identifier, "connected");
                case this.message_types.rejection:
                    return this.subscriptions.reject(identifier);
                default:
                    return this.subscriptions.notify(identifier, "received", message);
            }
        },
        open: function () {
            ActionCable.log("WebSocket onopen event, using '" + (this.getProtocol()) + "' subprotocol");
            this.disconnected = false;
            if (!this.isProtocolSupported()) {
                ActionCable.log("Protocol is unsupported. Stopping monitor and disconnecting.");
                return this.close({
                    allowReconnect: false
                });
            }
        },
        close: function (event) {
            ActionCable.log("WebSocket onclose event");
            if (this.disconnected) {
                return;
            }
            this.disconnected = true;
            this.monitor.recordDisconnect();
            return this.subscriptions.notifyAll("disconnected", {
                willAttemptReconnect: this.monitor.isRunning()
            });
        },
        error: function () {
            return ActionCable.log("WebSocket onerror event");
        }
    };


}
class Subscriptions {
    slice = [].slice;

    constructor(consumer) {
        this.consumer = consumer;
        this.subscriptions = [];
    }

    create = (channelName, mixin) => {
        var channel, params, subscription;
        channel = channelName;
        params = typeof channel === "object" ? channel : {
            channel: channel
        };
        subscription = new Subscription(this.consumer, params, mixin);
        return this.add(subscription);
    };

    add = (subscription) => {
        this.subscriptions.push(subscription);
        this.consumer.ensureActiveConnection();
        this.notify(subscription, "initialized");
        this.sendCommand(subscription, "subscribe");
        return subscription;
    };

    remove = (subscription) => {
        this.forget(subscription);
        if (!this.findAll(subscription.identifier).length) {
            this.sendCommand(subscription, "unsubscribe");
        }
        return subscription;
    };

    reject = (identifier) => {
        var i, len, ref, results, subscription;
        ref = this.findAll(identifier);
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
            subscription = ref[i];
            this.forget(subscription);
            this.notify(subscription, "rejected");
            results.push(subscription);
        }
        return results;
    };

    forget = (subscription) => {
        var s;
        this.subscriptions = (function () {
            var i, len, ref, results;
            ref = this.subscriptions;
            results = [];
            for (i = 0, len = ref.length; i < len; i++) {
                s = ref[i];
                if (s !== subscription) {
                    results.push(s);
                }
            }
            return results;
        }).call(this);
        return subscription;
    };

    findAll = (identifier) => {
        var i, len, ref, results, s;
        ref = this.subscriptions;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
            s = ref[i];
            if (s.identifier === identifier) {
                results.push(s);
            }
        }
        return results;
    };

    reload = () => {
        var i, len, ref, results, subscription;
        ref = this.subscriptions;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
            subscription = ref[i];
            results.push(this.sendCommand(subscription, "subscribe"));
        }
        return results;
    };

    notifyAll = (...args) => {
        var args, callbackName, i, len, ref, results, subscription;
        callbackName = args[0], args = 2 <= args.length ? this.slice.call(args, 1) : [];
        ref = this.subscriptions;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
            subscription = ref[i];
            results.push(this.notify.apply(this, [subscription, callbackName].concat(this.slice.call(args))));
        }
        return results;
    };

    notify = (...args) => {
        var args, callbackName, i, len, results, subscription, subscriptions;
        subscription = args[0], callbackName = args[1], args = 3 <= args.length ? this.slice.call(args, 2) : [];
        if (typeof subscription === "string") {
            subscriptions = this.findAll(subscription);
        } else {
            subscriptions = [subscription];
        }
        results = [];
        for (i = 0, len = subscriptions.length; i < len; i++) {
            subscription = subscriptions[i];
            results.push(typeof subscription[callbackName] === "function" ? subscription[callbackName].apply(subscription, args) : void 0);
        }
        return results;
    };

    sendCommand = (subscription, command) => {
        var identifier;
        identifier = subscription.identifier;
        return this.consumer.send({
            command: command,
            identifier: identifier
        });
    };


}

class Subscription {

    constructor(consumer, params, mixin) {
        this.consumer = consumer;
        if (params == null) {
            params = {};
        }
        this.identifier = JSON.stringify(params);
        this.extend(this, mixin);
    }

    perform = function (action, data) {
        if (data == null) {
            data = {};
        }
        data.action = action;
        return this.send(data);
    };

    send = function (data) {
        return this.consumer.send({
            command: "message",
            identifier: this.identifier,
            data: JSON.stringify(data)
        });
    };

    unsubscribe = function () {
        return this.consumer.subscriptions.remove(this);
    };

    extend = function (object, properties) {
        var key, value;
        if (properties != null) {
            for (key in properties) {
                value = properties[key];
                object[key] = value;
            }
        }
        return object;
    };


}

class Consumer {
    constructor(url, jwt) {
        this.url = url;
        const {
            token,
            origin
        } = jwt;
        this.jwt = token;
        this.origin = origin
        this.subscriptions = new Subscriptions(this);
        this.connection = new Connection(this);
    }

    send = function (data) {
        return this.connection.send(data);
    };

    connect = function () {
        return this.connection.open();
    };

    disconnect = function () {
        return this.connection.close({
            allowReconnect: false
        });
    };

    ensureActiveConnection = function () {
        if (!this.connection.isActive()) {
            return this.connection.open();
        }
    };

}