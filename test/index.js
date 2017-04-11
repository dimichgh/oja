'use strict';

require('request-local');

const Assert = require('assert');
const EventEmitter = require('events').EventEmitter;

const Oja = require('..');
const Flow = Oja.Flow;
const EventContext = Oja.EventContext;
const ReadableStream = Oja.ReadableStream;
const Domain = require('domain');

describe(__filename, () => {
    describe('EventContext', () => {
        it('should create eventContext', next => {
            const eventContext = new EventContext();
            Assert.ok(!eventContext._deferred);
            const promise = eventContext.get('data');
            Assert.ok(promise instanceof Promise);
            Assert.equal(promise, eventContext.get('data'));
            next();
        });

        it('should emit data event', next => {
            const eventContext = new EventContext();
            eventContext.on('data', data => {
                Assert.equal('ok', data);
                next();
            });
            eventContext.emit('data', 'ok');
        });

        it('should emit data event and cache it', next => {
            const eventContext = new EventContext();
            eventContext.on('data', data => {
                Assert.equal('ok', data);

                eventContext.on('data', data => {
                    Assert.equal('ok', data);

                    next();
                });
            });
            eventContext.emit('data', 'ok');
        });

        it('should emit error event', next => {
            const eventContext = new EventContext();
            eventContext.on('data', data => {
                next(new Error('Should not happen'));
            });
            eventContext.on('error', err => {
                Assert.equal('Boom', err.message);
                next();
            });
            eventContext.emit('error', new Error('Boom'));
        });

        it('should emit error event and cache it', next => {
            const eventContext = new EventContext();
            eventContext.on('data', data => {
                next(new Error('Should not happen'));
            });
            eventContext.on('error', err => {
                Assert.equal('Boom', err.message);
                eventContext.on('error', err => {
                    Assert.equal('Boom', err.message);
                    next();
                });
            });
            eventContext.emit('error', new Error('Boom'));
        });

        it('should resolve promise', next => {
            const eventContext = new EventContext();
            eventContext.get('data').then(data => {
                Assert.equal('ok', data);
                eventContext.get('data').then(data => {
                    Assert.equal('ok', data);
                    next();
                });
            });
            eventContext.emit('data', 'ok');
        });

        it('should resolve promise from cached data', next => {
            const eventContext = new EventContext();
            eventContext.emit('data', 'ok');
            setImmediate(() => {
                eventContext.get('data').then(data => {
                    Assert.equal('ok', data);
                    next();
                });
            });
        });

        it('should reject promise', next => {
            const eventContext = new EventContext();
            eventContext.get('data')
            .then(data => {
                next(new Error('Should not happen'));
            })
            .catch(err => {
                Assert.equal('Boom', err.message);
                next();
            });
            eventContext.emit('error', new Error('Boom'));
        });

        it('should reject promise from cache', next => {
            const eventContext = new EventContext();
            Assert.throws(() => {
                eventContext.emit('error', new Error('Boom'));
            }, /Boom/);

            eventContext.get('data')
            .then(data => {
                next(new Error('Should not happen'));
            })
            .catch(err => {
                Assert.equal('Boom', err.message);
                eventContext.get('data').catch(err => {
                    Assert.equal('Boom', err.message);
                    next();
                });
            });
        });

        it('should resolve first event', next => {
            const eventContext = new EventContext();
            eventContext.get('data').then(data => {
                Assert.equal('ok', data);
                next();
            });
            eventContext.emit('data', 'ok');
            eventContext.emit('data', 'ok2');
        });

        it('should resolve first event from cache', next => {
            const eventContext = new EventContext();
            eventContext.emit('data', 'ok');
            eventContext.emit('data', 'ok2');

            eventContext.get('data').then(data => {
                Assert.equal('ok', data);
                next();
            });
        });

        it('should get two events', next => {
            const eventContext = new EventContext();
            let counter = 0;
            eventContext.on('data', data => {
                counter++;
                if (counter === 2) {
                    Assert.equal('ok2', data);
                    next();
                }
                Assert.equal('ok', data);
            });
            eventContext.emit('data', 'ok');
            eventContext.emit('data', 'ok2');
        });

        it('should get two events from cache', next => {
            const eventContext = new EventContext();
            let counter = 0;
            eventContext.emit('data', 'ok');

            eventContext.on('data', data => {
                counter++;
                if (counter === 2) {
                    Assert.equal('ok2', data);
                    next();
                }
                Assert.equal('ok', data);
            });

            eventContext.emit('data', 'ok2');
        });

        it('should reject first error and ignore the rest', next => {
            const eventContext = new EventContext();

            let promiseErr = 0;
            eventContext.get('data')
            .then(data => {
                next(new Error('Should not happen'));
            })
            .catch(err => {
                Assert.equal('Boom', err.message);
                promiseErr++;
            });

            let errCount = 0;
            eventContext.on('error', err => {
                setImmediate(() => {
                    errCount++;
                    if (errCount === 2) {
                        Assert.equal(1, promiseErr);
                        next();
                    }
                });
            });

            eventContext.emit('error', new Error('Boom'));
            eventContext.emit('error', new Error('Boom'));
        });

    });

    describe('StageContext', () => {
        it('should create stageContext from eventContext', next => {
            const eventContext = new EventContext({
                foo: 'bar',
                asd: 'fgt'
            });
            const stageCtx = eventContext.stageContext();
            Assert.equal('bar', stageCtx.get('foo'));
            Assert.equal('fgt', stageCtx.get('asd'));
            Assert.ok(stageCtx.get('unknown') instanceof Promise);
            next();
        });

        it('should stageContext and publish to default target', next => {
            const eventContext = new EventContext();
            const stageCtx = eventContext.stageContext();
            stageCtx.pub('ok');
            eventContext.get('data').then(data => {
                Assert.equal('ok', data);
                next();
            });
        });

        it('should stageContext and publish to topics', next => {
            const eventContext = new EventContext();
            const stageCtx = eventContext.stageContext('foo', 'bar');
            next = done(2, next);
            eventContext.get('foo').then(data => {
                Assert.equal('ok', data);
                next();
            });
            eventContext.get('bar').then(data => {
                Assert.equal('ok', data);
                next();
            });
            stageCtx.pub('ok');
        });

        it('should stageContext and publish to topics, array', next => {
            const eventContext = new EventContext();
            const stageCtx = eventContext.stageContext(['foo', 'bar']);
            next = done(2, next);
            eventContext.get('foo').then(data => {
                Assert.equal('ok', data);
                next();
            });
            eventContext.get('bar').then(data => {
                Assert.equal('ok', data);
                next();
            });
            stageCtx.pub('ok');
        });

        it('should stageContext and publish to topics, array, multiple publishes', next => {
            const eventContext = new EventContext();
            const stageCtx = eventContext.stageContext(['foo', 'bar']);
            next = done(2, next);
            eventContext.get('foo').then(data => {
                Assert.equal('ok', data);
                next();
            });
            eventContext.get('bar').then(data => {
                Assert.equal('ok', data);
                next();
            });
            stageCtx.pub('ok');
            stageCtx.pub('ok');
        });

        it('should stageContext and publish to topics, multiple publishes', next => {
            const eventContext = new EventContext();
            const stageCtx = eventContext.stageContext(['foo', 'bar']);
            next = done(4, next);
            eventContext.on('foo', data => {
                Assert.equal('ok', data);
                next();
            });
            eventContext.on('bar', data => {
                Assert.equal('ok', data);
                next();
            });
            stageCtx.pub('ok');
            stageCtx.pub('ok');
        });
    });

    describe('ReadableStream', () => {

        it('should create empty readable stream', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            stream.on('data', () => next(new Error('Should not happen')));
            setImmediate(next);
        });

        it('should create empty readable stream and close it', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            emitter.emit('topic');
            setImmediate(() => {
                stream.on('data', () => next(new Error('Should not happen')));
                stream.on('end', next);
            });
        });

        it('should create empty readable stream and close it after start listening', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            setImmediate(() => {
                stream.on('data', () => next(new Error('Should not happen')));
                stream.on('end', next);
                setImmediate(() => emitter.emit('topic'));
            });
        });

        it('should read from stream', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            const buffer = [];
            emitter.emit('topic', 'one');
            setImmediate(() => {
                stream.on('data', data => buffer.push(data));
                stream.on('end', () => {
                    Assert.deepEqual(['one', 'two'], buffer);
                    next();
                });
            });

            setImmediate(() => {
                emitter.emit('topic', 'two');
                setImmediate(() => {
                    // complete
                    emitter.emit('topic');
                });
            });
        });

        it('should close stream and ignore further events', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            const buffer = [];
            const expected = [];
            next = done(2, next);
            // now consume it
            stream.on('data', data => {
                buffer.push(data);
            });
            stream.on('end', () => {
                // Assert.deepEqual([], stream._buffer);
                Assert.deepEqual(expected, buffer);
                Assert.equal(19, buffer.length);
                next();
            });
            // first make it buffer
            for (var i = 1; i < 20; i++) {
                emitter.emit('topic', i);
                expected.push(i);
            }
            // check buffer is not mpety
            Assert.ok(stream._buffer.length > 0);
            setImmediate(() => {
                emitter.emit('topic');
                setImmediate(() => {
                    // now generate more events
                    for (var i = 1; i < 20; i++) {
                        emitter.emit('topic', i);
                    }
                    setImmediate(next);
                });
            });
        });

        it('should buffer before consuming starts', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            const buffer = [];
            const expected = [];
            for (var i = 1; i < 20; i++) {
                emitter.emit('topic', i);
                expected.push(i);
            }
            // native stream buffer will consume 16 object entries by default
            // the rest goes to oja stream buffer
            Assert.deepEqual([17, 18, 19], stream._buffer);
            emitter.emit('topic'); // mark the end

            setImmediate(() => {
                stream.on('data', data => {
                    buffer.push(data);
                });
                stream.on('end', () => {
                    Assert.deepEqual(expected, buffer);
                    next();
                });
            });
        });

        it('should not buffer when stream is closed', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            const buffer = [];
            const expected = [];
            for (var i = 1; i < 20; i++) {
                emitter.emit('topic', i);
                expected.push(i);
            }
            emitter.emit('topic');
            for (; i < 30; i++) {
                emitter.emit('topic', i);
            }

            setImmediate(() => {
                stream.on('data', data => {
                    buffer.push(data);
                });
                stream.on('end', () => {
                    Assert.deepEqual([], stream._buffer);
                    Assert.deepEqual(expected, buffer);
                    next();
                });
            });
        });

        it('should stop buffering once it is stopped, explicitly', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            const buffer = [];
            const expected = [];
            for (var i = 1; i < 5; i++) {
                emitter.emit('topic', i);
                expected.push(i);
            }
            stream.push(null);

            setImmediate(() => {
                stream.on('data', data => {
                    buffer.push(data);
                });
                stream.on('end', () => {
                    // Assert.deepEqual([], stream._buffer);
                    Assert.deepEqual(expected, buffer);
                    next();
                });
                for (; i < 10; i++) {
                    emitter.emit('topic', i);
                }
            });
        });

        it('should not close the stream when oja buffer becomes empty', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            const buffer = [];
            const expected = [];
            // now consume it
            stream.on('data', data => {
                buffer.push(data);
            });
            stream.on('end', () => {
                // Assert.deepEqual([], stream._buffer);
                Assert.deepEqual(expected, buffer);
                Assert.equal(40, buffer.length);
                next();
            });
            // first make it buffer
            for (var i = 1; i < 20; i++) {
                emitter.emit('topic', i);
                expected.push(i);
            }
            // check buffer is not mpety
            Assert.ok(stream._buffer.length > 0);

            setImmediate(() => {
                // buffer should be empty now
                Assert.equal(0, stream._buffer.length);
                for (var i = 20; i <= 40; i++) {
                    emitter.emit('topic', i);
                    expected.push(i);
                }
                emitter.emit('topic');
            });
        });

        it('should create filter other topics', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            const buffer = [];
            emitter.emit('topic', 'one');

            emitter.emit('foo', 'bar');
            emitter.emit('foo');
            setImmediate(() => {
                emitter.emit('topic', 'two');
                emitter.emit('topic');
            });
            // now consume it
            stream.on('data', data => {
                buffer.push(data);
            });
            stream.on('end', () => {
                Assert.deepEqual(['one', 'two'], buffer);
                next();
            });
        });

        it('should handle stream error', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            emitter.on('error', err => {
                Assert.equal('Boom', err.message);
                next();
            });
            stream.emit('error', new Error('Boom'));
        });

        it('should close stream when error happens', next => {
            const emitter = new EventEmitter();
            const stream = new ReadableStream('topic', emitter);
            stream.on('data', () => next('Should not happen'));
            emitter.on('error', err => {
                Assert.equal('Boom', err.message);
                emitter.emit('topic', 'one');
                setImmediate(next);
            });
            stream.emit('error', new Error('Boom'));
        });

    });

    describe('Flow', () => {
        it('should create empty flow', next => {
            const flow = new Flow();
            Assert.ok(flow.define);
            Assert.ok(flow.consume);
            next();
        });

        it('should define publisher with static data and consume via promise', next => {
            const flow = new Flow();
            flow.define('foo', 'bar');
            flow.consume('foo').then(val => {
                Assert.equal('bar', val);
                next();
            }).catch(next);
        });

        it('should define publisher', next => {
            const flow = new Flow();
            const pub = flow.define('foo');
            flow.consume('foo').then(val => {
                Assert.equal('bar', val);
                next();
            }).catch(next);
            pub.pub('bar');
        });

        it('should define publisher with promise and consume via promise', next => {
            const flow = new Flow();
            flow.define('foo', Promise.resolve('bar'));
            flow.consume('foo').then(val => {
                Assert.equal('bar', val);
                next();
            }).catch(next);
        });

        it('should define publisher with promise and consume via callback', next => {
            const flow = new Flow();
            flow
            .define('foo', Promise.resolve('bar'))
            .consume('foo', val => {
                Assert.equal('bar', val);
                next();
            })
            .consume('error', next);
        });

        it('should define publisher via callback and consume via promise', next => {
            const flow = new Flow();
            flow.define('foo', () => {
                return 'bar';
            });
            flow.consume('foo').then(val => {
                Assert.equal('bar', val);
                next();
            }).catch(next);
        });

        it('should define publisher via async callback and consume via promise', next => {
            const flow = new Flow();
            flow.define('foo', publisher => {
                setImmediate(() => publisher.pub('bar'));
            });
            flow.consume('foo').then(val => {
                Assert.equal('bar', val);
                next();
            }).catch(next);
        });

        it('should publish/consume multiple events', next => {
            const events = ['bar', 'qaz'];
            const flow = new Flow();
            flow.define('foo', publisher => {
                events.forEach(evt => publisher.pub(evt));
            });
            next = done(2, next);
            flow.consume('foo', val => {
                Assert.equal(events.shift(), val);
                next();
            })
            .consume('error', next);
        });

        it('should publish multiple events via define', next => {
            next = done(2, next);
            const events = ['bar', 'qaz'];
            const flow = new Flow();

            events.forEach(evt => flow.define('foo', evt));

            flow.consume('foo', val => {
                Assert.equal(events.shift(), val);
                next();
            })
            .consume('error', next);
        });

        it('should publish/consume different events', next => {
            const flow = new Flow();
            next = done(2, next);
            flow.define('foo', 'bar')
            .define('qaz', 'wsx')
            .consume('foo', val => {
                Assert.equal('bar', val);
                next();
            })
            .consume('qaz', val => {
                Assert.equal('wsx', val);
                next();
            })
            .consume('error', next);
        });

        it('should publish/consume different events, async', next => {
            const flow = new Flow();
            next = done(2, next);
            flow.define('foo', publisher => {
                setImmediate(() => publisher.pub('bar'));
            })
            .define('qaz', publisher => {
                setImmediate(() => publisher.pub('wsx'));
            })
            .define('qaz', 'wsx')
            .consume('foo', val => {
                Assert.equal('bar', val);
                next();
            })
            .consume('qaz', val => {
                Assert.equal('wsx', val);
                next();
            })
            .consume('error', next);
        });

        it('should consume any events', next => {
            const flow = new Flow();
            next = done(2, next);
            flow.define('foo', publisher => {
                setImmediate(() => publisher.pub('bar'));
            })
            .define('qaz', publisher => {
                setImmediate(() => publisher.pub('wsx'));
            })
            .consume('*', evt => {
                switch(evt.name) {
                    case 'foo':
                        Assert.equal('bar', evt.data);
                        next();
                        break;

                    case 'qaz':
                        Assert.equal('wsx', evt.data);
                        next();
                        break;
                }
            })
            .consume('error', next);
        });

        it('should define multi-topic publisher with static data and consume via promise', next => {
            const flow = new Flow();
            flow.define(['foo', 'qaz'], 'bar');

            next = done(2, next);

            const proms = flow
            .consume('error', next)
            .consume(['foo', 'qaz']);

            proms.foo.then(val => {
                Assert.equal('bar', val);
                next();
            });
            proms.qaz.then(val => {
                Assert.equal('bar', val);
                next();
            });
        });

        it('should consume error without failing', next => {
            const flow = new Flow();
            flow.consume('error', err => {
                Assert.equal('Boom', err.message);
                // wait a little to give emitter chance to throw
                setTimeout(() => next(), 20);
            })
            // emit error
            .define('foo', new Error('Boom'));
        });

        describe('should fail due to uncaught error', () => {
            before(() => {
                while(process.domain) {
                    process.domain.exit();
                }
            });

            after(() => {
                while(process.domain) {
                    process.domain.exit();
                }
            });

            it('test', next => {
                const flow = new Flow();
                const domain = Domain.create();
                domain.run(function () {
                    flow.define('foo', new Error('Boom'));
                });
                domain.on('error', err => {
                    Assert.equal('Boom', err.message);
                    next();
                });
            });
        });

        it('should import other flow with static data', next => {
            const nameSource = new Flow();
            nameSource.define('name', 'John');

            const greeting = new Flow(nameSource);
            greeting
            .define('greeting', (_, runtime) => {
                return runtime.consume('name').then(name => {
                    return `Hello ${name}`;
                });
            })
            .consume('greeting', data => {
                Assert.equal('Hello John', data);
                next();
            })
            .consume('error', next);
        });

        it('should import flow dynamic data', next => {
            class NameSource extends Flow {
                name() {
                    nameSource.define('name', 'John');
                }
            }
            const nameSource = new NameSource();

            const greeting = new Flow(nameSource);
            greeting
            .define('greeting', (_, runtime) => {
                return runtime.consume('name').then(name => {
                    return `Hello ${name}`;
                });
            })
            .consume('greeting', data => {
                Assert.equal('Hello John', data);
                next();
            })
            .consume('error', next);

            nameSource.name();
        });

        it('should import other flow with multiple topics', next => {
            const otherFlow = new Flow();
            otherFlow.define('name1', 'John1');
            otherFlow.define('name2', 'John2');
            otherFlow.define('name3', 'John3');

            new Flow(otherFlow)
            .consume(['name1', 'name3'], data => {
                Assert.equal('John1', data.name1);
                Assert.equal('John3', data.name3);
                next();
            })
            .consume('error', next);
        });

        it('should consume already consumed on * topic', next => {
            const flow = new Flow();
            flow.define('foo', 'bar');

            // let static settle
            setImmediate(() => {
                flow.consume('*', data => {
                    Assert.equal('foo', data.name);
                    Assert.equal('bar', data.data);
                    next();
                });
            });
        });

        it('should import static events for *', next => {
            const otherFlow = new Flow();
            otherFlow.define('foo', 'bar');

            // let otherFlow.emit execute
            setImmediate(() => {
                new Flow(otherFlow)
                .define('qaz', 'wsx')
                .consume(['qaz', 'foo'], data => {
                    Assert.equal('wsx', data.qaz);
                    Assert.equal('bar', data.foo);
                    next();
                })
                .catch(next);
            });
        });

        it('should import other flow with mutual topic', next => {
            const otherFlow = new Flow();
            otherFlow.consume('shared', shared => {
                Assert.equal('foo', shared);
                otherFlow.define('name1', 'John1');
            });

            new Flow(otherFlow)
            .define('shared', 'foo')    // define in master flow
            .consume('name1', data => {
                Assert.equal('John1', data);
                next();
            })
            .consume('error', next);
        });

        it('should import other flow with mutual topic', next => {
            const otherFlow = new Flow();
            otherFlow.consume('shared', shared => {
                Assert.equal('foo', shared);
                otherFlow.define('name1', 'John1');
            });

            // async mode
            setImmediate(() => {
                new Flow(otherFlow)
                .define('shared', 'foo')    // define in master flow
                .consume('name1', data => {
                    Assert.equal('John1', data);
                    next();
                })
                .consume('error', next);
            });
        });

        it('should import error', next => {
            next = done(2, next);

            const otherFlow = new Flow();
            otherFlow.define('name1', 'John1');
            otherFlow.define('error', new Error('Boom'));

            new Flow(otherFlow)
            .consume('name1', data => {
                Assert.equal('John1', data);
                next();
            })
            .catch(err => {
                Assert.equal('Boom', err.message);
                next();
            });
        });

        it('import flow, multiple sources', next => {
            const nameSource = new Flow();
            nameSource.define('name1', 'John');
            nameSource.define('name2', 'Bob');

            const greeting = new Flow(nameSource);
            greeting
            .consume(['name1', 'name2'], (input, runtime) => {
                runtime.define('greeting', `Hello ${input.name1} and ${input.name2}`);
            })
            .consume('greeting', data => {
                Assert.equal('Hello John and Bob', data);
                next();
            })
            .consume('error', next);

        });

        it('should throw sync error', next => {
            class Foo extends Flow {
                throwError() {
                    this.define('data', new Error('Boom'));
                    return this;
                }
            }

            const flow = new Foo();
            flow.throwError()
            .consume('error', err => {
                Assert.equal('Boom', err.message);
                next();
            });
        });

        it('should throw async error', next => {
            class Foo extends Flow {
                throwError() {
                    this.define('data', publisher => {
                        setImmediate(() => {
                            publisher.pub(new Error('Boom'));
                        });
                    });
                    return this;
                }
            }

            const flow = new Foo();
            flow.throwError()
            .consume('error', err => {
                Assert.equal('Boom', err.message);
                next();
            });
        });

        describe('should throw error in cb when consuming multiple topics', () => {
            before(() => {
                while(process.domain) {
                    process.domain.exit();
                }
            });

            after(() => {
                while(process.domain) {
                    process.domain.exit();
                }
            });

            it('test', next => {
                const domain = Domain.create();

                domain.run(function () {
                    // throw new Error('Boom')
                    setTimeout(() => {
                        new Flow()
                        .define('mess', {})
                        .consume(['mess', 'mess'], () => {
                            throw new Error('Boom');
                        });
                    }, 1);
                });

                domain.on('error', err => {
                    Assert.equal('Boom', err.message);
                    next();
                });
            });
        });

        it('should capture error in cb when consuming multiple topics, catch', next => {
            new Flow()
            .define('mess', {})
            .consume(['mess', 'mess'], (_, runtime) => {
                runtime.define('error', new Error('Boom'));
            })
            .catch(err => {
                Assert.equal('Boom', err.message);
                next();
            });
        });

        it('should throw error when catch arguments are invalid', next => {
            Assert.throws(() => {
                new Flow().catch('error', err => {});
            }, /Invalid arguments/);
            next();
        });

        it('should publish one event and fail with error', next => {
            let dataReceived;
            new Flow()
            .define('data', 'ok')
            .define('data', new Error('Boom'))
            .consume('data', data => {
                dataReceived = data;
            })
            .consume('error', err => {
                Assert.equal('ok', dataReceived);
                Assert.equal('Boom', err.message);
                next();
            });
        });

        it('should resolve promise', next => {
            new Flow()
            .define('foo', Promise.resolve('bar'))
            .consume('foo', foo => {
                Assert.equal('bar', foo);
                next();
            });
        });

        it('should reject promise', next => {
            new Flow()
            .define('foo', Promise.reject(new Error('Boom')))
            .catch(err => {
                Assert.equal('Boom', err.message);
                next();
            });
        });

        it('should chain events', next => {
            new Flow()
            .define('A', 'a')
            .consume('A', (val, runtime) => {
                Assert.equal('a', val);
                runtime.define('B', 'b');
            })
            .consume('B', (val, runtime) => {
                Assert.equal('b', val);
                runtime.define('C', 'c');
            })
            .consume('C', val => {
                Assert.equal('c', val);
                next();
            })
            .consume('error', next);
        });

        it('should chain events, consuming multi-topics', next => {
            new Flow()
            .define('A', 'a')
            .consume('A', (val, runtime) => {
                Assert.equal('a', val);
                runtime.define('B', 'b');
            })
            .consume('B', (val, runtime) => {
                Assert.equal('b', val);
                runtime.define('C', 'c');
            })
            .consume(['C', 'B'], (val, runtime) => {
                Assert.equal('c', val.C);
                Assert.equal('b', val.B);
                runtime.define('E', 'e');
            })
            .consume('C', (val, runtime) => {
                Assert.equal('c', val);
                next();
            })
            .consume('error', next);
        });

        it('should return pending topic', next => {
            const state = new Flow()
            .consume('foo', () => {})
            .state();

            Assert.deepEqual(['foo'], state.pending);
            Assert.deepEqual({}, state.queue);
            next();
        });

        it('should timeout for one topic', next => {
            new Flow()
            .consume('foo', () => {})
            .timeout('foo', 1)
            .catch(err => {
                Assert.equal('Topic/s (foo) timed out, pending topics (none), queue state {}', err.message);
                next();
            });
        });

        it('should timeout and show pending end of stream and main topic', next => {
            new Flow()
            .consume('foo', () => {})
            .consumeStream('bar', stream => {})
            .timeout('foo', 1)
            .catch(err => {
                Assert.equal('Topic/s (foo) timed out, pending topics (bar:end,bar), queue state {}', err.message);
                next();
            });
        });

        it('should timeout and show pending end of stream and main topic', next => {
            new Flow()
            .consume('foo', () => {})
            .define('bar', 'boo')
            .consumeStream('bar', stream => {})
            .timeout('foo', 1)
            .catch(err => {
                Assert.equal('Topic/s (foo) timed out, pending topics (bar:end), queue state {"bar":1}', err.message);
                next();
            });
        });

        it('should timeout for 2 topics, one resolved', next => {
            const flow = new Flow()
            .consume('foo', () => {})
            .consume('bar', () => {})
            .timeout(['foo', 'bar'], 20)
            .catch(err => {
                Assert.equal('Topic/s (bar) timed out, pending topics (none), queue state {"foo":1}', err.message);
                next();
            });
            setTimeout(() => {
                flow.define('foo', '');
            }, 10);
        });

        it('should timeout for 2 topics, one resolved, one pending', next => {
            const flow = new Flow()
            .consume('foo', () => {})
            .consume('bar', () => {})
            .consume('qaz', () => {})
            .timeout(['foo', 'bar'], 20)
            .catch(err => {
                Assert.equal('Topic/s (bar) timed out, pending topics (qaz), queue state {"foo":1}', err.message);
                next();
            });
            setTimeout(() => {
                flow.define('foo', '');
            }, 5);
        });

        it('should not timeout for 2 topics, one pending', next => {
            const flow = new Flow()
            .consume('foo', () => {})
            .consume('bar', () => {})
            .consume('qaz', () => {})
            .timeout(['foo', 'bar'], 20)
            .catch(next);

            setTimeout(() => {
                flow.define('foo', '');
            }, 5);
            setTimeout(() => {
                flow.define('bar', '');
            }, 6);
            setTimeout(next, 15);
        });

        it('should continue cascading style, after catch', next => {
            const state = new Flow()
            .consume('foo', () => {})
            .catch(next)
            .state();

            Assert.deepEqual(['foo'], state.pending);
            next();
        });

        it('should return pending topics', next => {
            const state = new Flow()
            .consume(['foo', 'bar'], () => {})
            .state();

            Assert.deepEqual(['foo', 'bar'], state.pending);
            next();
        });

        it('should return pending topics, duplicated', next => {
            const state = new Flow()
            .consume(['foo', 'bar', 'bar'], () => {})
            .consume(['foo', 'qaz'], () => {})
            .state();

            Assert.deepEqual(['foo', 'bar', 'qaz'], state.pending);
            next();
        });

        it('should return pending topics, some resolved', next => {
            const state = new Flow()
            .consume(['foo', 'bar', 'bar'], () => {})
            .consume(['foo', 'qaz'], () => {})
            .define('foo', '')
            .state();

            Assert.deepEqual(['bar', 'qaz'], state.pending);
            Assert.deepEqual({foo:1}, state.queue);
            next();
        });

        it('should return state', next => {
            const state = new Flow()
            .define('qaz', '')
            .define('wsx', '')
            .define('foo', '')
            .define('foo', '')
            .define('foo', '')
            .define('foo', '')
            .state();

            Assert.deepEqual({foo:4, qaz:1, wsx:1}, state.queue);
            next();
        });

        it('should stop after the error, sync', next => {
            next = done(3, next);
            const flow = new Flow();

            flow
            .define('foo', 'faa')
            .define('boo', 'baa')
            .define('error', new Error('Boom'))
            .define('too', 'taa')
            .consume('foo', foo => {
                next();
            })
            .consume('boo', foo => {
                next();
            })
            .consume('too', too => {
                // will never happen
                next(new Error('Should never happen'));
            })
            .catch(err => { // catch error
                Assert.equal('Boom', err.message);
                next();
            });
        });

        it('should stop after the error, async', next => {
            next = done(3, next);
            const flow = new Flow();

            flow
            .define('foo', 'faa')
            .define('boo', 'baa')
            .define('error', new Error('Boom'))
            .consume('foo', foo => {
                setTimeout(() => {
                    flow.define('too', 'taa');
                }, 10);
                next();
            })
            .consume('boo', foo => {
                next();
            })
            .consume('too', too => {
                // will never happen
                next(new Error('Should never happen'));
            })
            .catch(err => { // catch error
                Assert.equal('Boom', err.message);
                next();
            });
        });

        describe('Consume Stream', () => {

            it('should create empty readable stream', next => {
                const flow = new Flow();
                const stream = flow.consumeStream('topic');
                stream.on('data', () => next(new Error('Should not happen')));
                stream.on('end', () => {
                    next();
                });
                flow.define('topic', null);
            });

            it('should handle topic and end of stream', next => {
                const flow = new Flow();
                const stream = flow.consumeStream('topic');
                const buffer = [];
                next = done(2, next);
                stream.on('data', data => {
                    buffer.push(data);
                });
                stream.on('end', () => {
                    Assert.deepEqual(['one', 'two'], buffer);
                    flow.define('topic', 'tree');
                    setImmediate(() => {
                        Assert.deepEqual(['one', 'two'], buffer);
                        next();
                    });
                });
                flow.consume('topic:end', () => next());

                flow.define('topic', 'one');
                flow.define('topic', 'two');
                flow.define('topic', null);
            });

            it('should handle topic and end of stream, different setup', next => {
                const flow = new Flow();
                flow.define('topic', 'one');
                flow.define('foo', 'bar');
                const stream = flow.consumeStream('topic');
                const buffer = [];
                next = done(2, next);
                stream.on('data', data => {
                    buffer.push(data);
                });
                stream.on('end', () => {
                    Assert.deepEqual(['one', 'two'], buffer);
                    flow.define('topic', 'tree');
                    setImmediate(() => {
                        Assert.deepEqual(['one', 'two'], buffer);
                        next();
                    });
                });
                flow.consume('topic:end', () => next());
                setImmediate(() => {
                    flow.define('topic', 'two');
                    flow.define('topic', null);
                    setImmediate(() => {
                        flow.define('topic', 'four');
                    });
                });
            });

            it('should buffer till it is read', next => {
                const flow = new Flow();
                const stream = flow.consumeStream('topic');
                const expected = [];
                for (var i = 0; i < 20; i++) {
                    flow.define('topic', i);
                    expected.push(i);
                }
                flow.define('topic', null); // mark the end

                Assert.ok(stream._buffer.length > 0);

                setImmediate(() => {
                    const buffer = [];
                    stream.on('data', data => {
                        buffer.push(data);
                    });
                    stream.on('end', () => {
                        Assert.equal(0, stream._buffer.length);
                        Assert.deepEqual(expected, buffer);
                        next();
                    });
                });
            });

            it('should emit topic:end to signal end of stream when stream error happens', next => {
                const flow = new Flow();
                const stream = flow.consumeStream('topic');
                const buffer = [];

                stream.on('data', data => {
                    buffer.push(data);
                });
                stream.on('end', () => {
                    next(new Error('Should never happen'));
                });
                flow.consume('topic:end', () => {
                    Assert.deepEqual(['one', 'two'], buffer);
                    next();
                });
                setImmediate(() => stream.emit('error', new Error('Boom')));

                flow.define('topic', 'one');
                flow.define('topic', 'two');
            });
        });
    });
});

function done(count, next) {
    return function (err) {
        if (err) {
            return next(err);
        }
        count--;
        if (count === 0) {
            next();
        }
    };
}
