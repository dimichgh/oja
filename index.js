'use strict';

const Assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const Readable = require('stream').Readable;

class Flow {
    constructor(baseFlow) {
        if (baseFlow) {
            this.eventContext = baseFlow.eventContext;
            return;
        }
        this.eventContext = new EventContext();
    }

    /*
       Define a publisher with the given topic.
       define(topics[, callback])
       It supports the following calling styles
       - define('topic') defines publisher with the given topic.
            * If define return non-empty value (promise, eventemitter, object, etc.), it is assumed to be a result that gets published to the flow under the topic name.
       - define(['A', 'B']) defines publisher with the given topics.
       - define('topic', callback) defines a publisher for in-line functions.
            * If callback is provided, it makes calls callback(publisher, runtime), where runtime is the reference to the flow object to allow further access to the flow inside arrow function
            * If callback return data, it is assumes to be the result and it gets published under topic.
       - define('topic', data) defines static data that gets published under the given topic immediately.
            * Notable side-effect: if one calls flow.define('foo', data) multiple time it is eqivaalent to emitting events

       Publisher API:
       - pub(data) publishes data under the assigned topic or publisher topic.
         It handles promises, events, plain data
    */
    define(topics, cb) {
        const publisher = this.eventContext.stageContext(topics);
        if (typeof cb === 'function') {
            const ret = cb(publisher, this);
            // keep cb returns something, treat is as a response
            if (ret !== undefined) {
                publisher.pub(ret);
            }
            return this; // to allow cascading style
        }
        if (cb instanceof Promise) {
            cb.then(data => publisher.pub(data))
                .catch(err => publisher.pub(err));
            return this;
        }
        if (cb !== undefined) {
            // assume it is a response
            publisher.pub(cb);
            return this;
        }
        // otherwise, it is sync mode, hence return publisher
        return publisher;
    }

    catch(callback) {
        if (arguments.length !== 1) {
            throw new Error('Invalid arguments');
        }
        this.consume('error', callback);
        return this;
    }

    timeout(topics, ms) {
        topics = Array.isArray(topics) ? topics : [topics];
        const timer = setTimeout(() => {
            const state = this.state();
            const pendingTopics = state.pending;

            const unresolved = [];
            const pending = [];
            pendingTopics.forEach(tp => {
                topics.indexOf(tp) !== -1 ?
                    unresolved.push(tp) :
                    pending.push(tp);
            });

            const queueState = `queue state ${JSON.stringify(state.queue)}`;
            const msg = `Topic/s (${unresolved.join(',')}) timed out, pending topics (${pending.join(',') || 'none'}), ${queueState}`;

            this.define('error',
                new Error(msg));
        }, ms);

        this.consume(topics, () => {
            clearTimeout(timer);
        });

        return this;
    }

    /*
        Returns a list of topics that have not been resolved yet
    */
    state() {
        return this.eventContext.state();
    }

    /*
        Consumes given topics:
        consume(topics[, callback])
        API:
        - consume(topics) returns a map of promises mapped to each topic
        - consume(topic) returns a promise for the given topic
        - consume(topics, callback(input, runtime)) returns a map of resolved values for the given topics, where runtime is a reference to the flow instance
        - consume(topic, callback(data, runtime)) returns resolved value for the given topic, where runtime is a reference to the flow instance
    */
    consume(topics, cb) {
        if (Array.isArray(topics)) {
            if (cb) {
                Promise.all(topics.map(topic => this.eventContext.get(topic)))
                .then(values => {
                    const ret = {};
                    values.map((val, index) => {
                        ret[topics[index]] = val;
                    });
                    // unlink any error in cb from promise flow to let it fail
                    setImmediate(() => cb(ret, this));
                });
                return this; // for cascading style
            }

            return topics.reduce((memo, topic) => {
                memo[topic] = this.eventContext.get(topic);
                return memo;
            }, {});
        }

        // handle single topics
        if (cb) {
            this.eventContext.on(topics, data => {
                if (data instanceof Promise) {
                    data.then(cb);
                    return;
                }

                cb(data, this);
            });
            return this;
        }
        return this.eventContext.get(topics);
    }

    /*
        Consumes stream for the given topic.
        Returns as readable stream
        The end of stream should be marked as undefined data
    */
    consumeStream(topic, callback) {
        // let's monitor end of stream to show in pending list if timeout happens
        this.consume(topic + ':end');
        const stream = new ReadableStream(topic, this.eventContext);
        if (callback) {
            callback(stream);
            return this;
        }
        return stream;
    }
}

class EventContext {
    constructor(context) {
        if (context instanceof EventContext) {
            // share the same context
            this._resolved = context._resolved;
            this._context = context._context;
            this._emitter = context._emitter;
            this._queue = context._queue;
            return;
        }
        // new context
        this._resolved = {};
        this._context = {};
        this._queue = {};
        Object.assign(this._context, context);
        this._emitter = new EventEmitter();
    }

    stageContext(topics) {
        if (topics && !Array.isArray(topics)) {
            topics = [].slice.call(arguments);
        }

        return new StageContext(this, topics);
    }

    /*
        Returns a list of topics that have not been resolved yet
    */
    state() {
        const queueState = Object.keys(this._queue).reduce((memo, topic) => {
            const queue = this._queue[topic];
            if (queue && queue.length) {
                memo[topic] = queue.length;
            }
            return memo;
        }, {});
        const pending = Object.keys(this._resolved).reduce((memo, name) => {
            if (!this._resolved[name]) {
                memo.push(name);
            }
            return memo;
        }, []);

        return {
            queue: queueState,
            pending: pending
        };
    }

    repub(type, handler) {
        // mark if any new topics have been added and marko them as non-resolved
        if (type !== 'error' && this._resolved[type] === undefined) {
            this._resolved[type] = false;
        }
        if (type === '*') {
            // re-publish all events
            Object.keys(this._queue).forEach(name => {
                const evts = this._queue[name];
                evts.forEach(evt => {
                    handler({
                        name: name,
                        data: evt
                    });
                });
            });
            return;
        }
        const queue = this._queue[type];
        if (queue) {
            queue.forEach(evt => handler(evt));
        }
    }

    /*
      Add a listener for a stream parameter.
    */
    on(type, handler) {
        this.repub(type, handler);
        this._emitter.on(type, handler);

        return this;
    }

    once(type, handler) {
        this.repub(type, handler);
        this._emitter.once(type, handler);

        return this;
    }

    emit(name, value) {
        this._queue[name] = this._queue[name] || [];
        this._queue[name].push(value);

        const doEmit = () => {
            this._emitter.emit(name, value);
        };

        if (name === 'error') {
            this._context._lastError = value;
            doEmit();
        }
        else {
            // mark as resolved
            this._resolved[name] = true;
        }

        if (!this._context._lastError) {
            doEmit();
        }

        setImmediate(() => {
            this._emitter.emit('*', {
                name: name,
                data: value
            });
        });
        return this;
    }

    /*
      Returns value from the context.
      If value is not yet published, it will return a promise
    */
    get(name) {
        var value = this._context[name] = this._context[name] || new Promise((resolve, reject) => {
            // this.once(name, resolve);
            this.once(name, data => {
                resolve(data);
            });

            this.once('error', reject);
        });
        return value;
    }
}

class StageContext extends EventContext {
    constructor(eventContext, topics) {
        super(eventContext);
        this.topics = topics;
    }

    pub(data) {
        if (this._context._lastError) {
            // flow is already broken
            return;
        }
        if (data instanceof Error) {
            this._context._lastError = data;
            return setImmediate(() => super.emit('error', data));
        }
        // otherwise publish normally
        (this.topics || ['data']).forEach(topic => {
            super.emit(topic, data);
        });
    }
}

class ReadableStream extends Readable {
    constructor(topic, emitter) {
        super({objectMode: true});
        this.topic = topic;
        this.emitter = emitter;
        // then init, this is a first time
        emitter.on(topic, data => {
            if (this._stopped) {
                return;
            }
            if (data === undefined || data === null) {
                this._stopped = true;
            }
            if (this._paused) {
                this._buffer.push(data);
                return;
            }
            this._continue(data);
        });

        this.once('error', err => {
            this._stopped = true;
            emitter.emit(topic + ':end');
            emitter.emit('error', err);
        });
        this._buffer = [];
    }

    push(data) {
        if (data === null) {
            this._stopped = true;
        }

        return super.push(data);
    }

    _read() {
        this._paused = false;
        while(!this._paused && this._buffer.length) {
            this._continue(this._buffer.shift());
        }
    }

    _continue(data) {
        if (data === undefined || data === null) {
            data = null; // mark stop down the stream
            this._stopped = true;
            this.emitter.emit(this.topic + ':end');
        }
        this._paused = !this.push(data);
    }
}

class Action extends Flow {
    constructor() {
        super();

        this.actions = [];
        this.executed = false;
    }

    execute() {
        // starts the action
        if (this.executed) {
            return;
        }
        this.executed = true;
        this.actions.forEach(action => action.execute());

        return this;
    }

    add(action) {
        Assert.ok(action instanceof Action, 'The action beeing added does not of Action type');
        if (action.executed) {
            throw new Error('The action should not be in progress when it is added to the other action');
        }
        // remap to basec context
        action.eventContext = this.eventContext;
        this.actions.push(action);
        return this;
    }
}

module.exports.Flow = Flow;
module.exports.Action = Action;
module.exports.EventContext = EventContext;
module.exports.StageContext = StageContext;
module.exports.ReadableStream = ReadableStream;
