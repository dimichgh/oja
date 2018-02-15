'use strict';

const Assert = require('assert');
const Action = require('..').Action;

describe(__filename, () => {
    it('should define action', () => {
        new Action();
    });

    it('should execute action', () => {
        const action = new Action();
        action.activate();
        Assert.ok(action.executed);
    });

    it('should execute custom action', next => {
        class MyAction extends Action {
            execute() {
                this.define('foo', 'bar');
            }
        }

        const myaction = new MyAction();
        myaction.consume('foo').then(data => {
            Assert.equal('bar', data);
            next();
        });
        myaction.activate();
    });

    it('should propagate context from child action', next => {
        class BaseAction extends Action {}

        class MyAction extends Action {
            execute() {
                this.define('foo', 'bar');
            }
        }

        const base = new BaseAction();
        base.add(new MyAction());
        base.consume('foo').then(data => {
            Assert.equal('bar', data);
            next();
        });
        base.activate();
    });

    it('should propagate context from base action to child', next => {
        class BaseAction extends Action {}

        class MyAction extends Action {
            execute() {
                this.define('foo', 'bar');
            }
        }

        const base = new BaseAction();
        // show all waterfall style
        base.add(new MyAction())
            .activate()
            .consume('foo')
            .then(data => {
                Assert.equal('bar', data);
                next();
            });
    });

    it('should throw error when adding action that is already started', () => {
        Assert.throws(() => {
            new Action().add(new Action().activate());
        }, /The action should not be in progress when it is added to the other action/);
    });

    it('should not re-execute the action', next => {
        let executed;

        class MyAction extends Action {
            execute() {
                Assert.ok(!executed);
                executed = true;
                next();
                return this;
            }
        }

        new MyAction()
            .activate()
            .activate();
    });

    it('should add child action as a generic function', next => {
        class BaseAction extends Action {}

        const base = new BaseAction();
        base.add(function (flow) {
            flow.define('foo', 'bar');
        });
        base.consume('foo').then(data => {
            Assert.equal('bar', data);
            next();
        });
        base.activate();
    });

    it('should add array of actions', next => {
        class BaseAction extends Action {}

        class MyFooAction extends Action {
            execute() {
                this.define('foo', 'bar');
            }
        }

        class MyQazAction extends Action {
            execute() {
                this.define('qax', 'wsx');
            }
        }

        const base = new BaseAction();
        base.add([
            function (flow) {
                flow.define('edc', 'rfv');
            },
            new MyQazAction(),
            new MyFooAction()
        ]);

        base
        .activate()
        .consume(['foo', 'qax', 'edc'])
        .then(data => {
            Assert.equal('bar', data.foo);
            Assert.equal('wsx', data.qax);
            Assert.equal('rfv', data.edc);
            next();
        });
    });

    it('should add array of actions as parameters', next => {
        class BaseAction extends Action {}

        class MyFooAction extends Action {
            execute() {
                this.define('foo', 'bar');
            }
        }

        class MyQazAction extends Action {
            execute() {
                this.define('qax', 'wsx');
            }
        }

        const base = new BaseAction();
        base.add(
            function (flow) {
                flow.define('edc', 'rfv');
            },
            new MyQazAction(),
            new MyFooAction()
        );

        base
        .activate()
        .consume(['foo', 'qax', 'edc'])
        .then(data => {
            Assert.equal('bar', data.foo);
            Assert.equal('wsx', data.qax);
            Assert.equal('rfv', data.edc);
            next();
        });
    });

    it('should add action during execution of base and still execute them successfully', next => {
        class MyFooAction extends Action {
            execute() {
                this.define('foo', 'bar');
            }
        }

        class MyQazAction extends Action {
            execute() {
                this.define('qax', 'wsx');
            }
        }

        class BaseAction extends Action {
            execute() {
                base.add(
                    function (flow) {
                        flow.define('edc', 'rfv');
                    },
                    new MyQazAction(),
                    new MyFooAction()
                );
            }
        }

        const base = new BaseAction();

        base
        .activate()
        .consume(['foo', 'qax', 'edc'])
        .then(data => {
            Assert.equal('bar', data.foo);
            Assert.equal('wsx', data.qax);
            Assert.equal('rfv', data.edc);
            next();
        });
    });

    describe('emitter warning', () => {
        let _error = console.error;
        after(() => {
            console.error = _error;
        });

        it('should not trigget too many listeners warning', next => {
            console.error = function (msg) {
                if (/Possible EventEmitter memory leak detected/.test(msg)) {
                    setImmediate(() => next(new Error('Should not happen')));
                }
                _error.apply(console, arguments);
            };
            const action = new Action();
            for (var i = 0; i < 15; i++) {
                action.consume('topic', () => {});
            }
            setImmediate(next);
        });

        it('should not trigget too many listeners warning, using setMaxListeners explicitly', next => {
            console.error = function (msg) {
                if (/Possible EventEmitter memory leak detected/.test(msg)) {
                    setImmediate(() => next(new Error('Should not happen')));
                }
                _error.apply(console, arguments);
            };
            const action = new Action();
            action.setMaxListeners(30);
            for (var i = 0; i < 25; i++) {
                action.consume('topic', () => {});
            }
            setImmediate(next);
        });
    });
});
