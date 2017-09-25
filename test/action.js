'use strict';

const Assert = require('assert');
const Action = require('..').Action;

describe(__filename, () => {
    it('should define action', () => {
        new Action();
    });

    it('should execute action', () => {
        const action = new Action();
        action.execute();
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
        myaction.execute();
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
        base.execute();
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
            .execute()
            .consume('foo')
            .then(data => {
                Assert.equal('bar', data);
                next();
            });
    });
});
