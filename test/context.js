const Assert = require('assert');
const createContext = require('../context');

describe(__filename, () => {
    it('should create a simple context', async () => {
        let ctx = createContext();
        ctx.foo = 'foov';
        ctx.bar = 'barv';

        Assert.equal('foov', ctx.foo);
        Assert.equal('barv', ctx.bar);

        ctx = createContext({
            functions: {
                actions: {
                    foo: 'foov',    // define value as a shortcut for function, used in unit tests
                    wsx: context => props => 'wsxv' // define standard function
                }
            }
        });
        Assert.equal('foov', ctx.actions.foo());

        ctx = createContext({
            properties: {
                props: {
                    qaz: 'qazv'
                }
            }
        });
        Assert.equal('qazv', ctx.props.qaz);

        ctx = createContext({
            properties: {
                props: {
                    foo: 'foov'
                }
            },
            functions: {
                actions: {
                    bar: 'barf',
                    qaz: context => {
                        Assert.ok(context);
                        Assert.equal('barf', context.actions.bar());
                        Assert.equal('foov', context.props.foo);
                        return () => 'qazf';
                    },
                    fail: new Error('BOOM')
                }
            }
        });
        Assert.equal('barf', ctx.actions.bar().toString());
        Assert.equal('qazf', ctx.actions.qaz());
        Assert.equal('barf', ctx.actions.bar());
        Assert.equal('qazf', ctx.actions.qaz());
        Assert.equal('barf', ctx.actions.bar());
        Assert.equal('foov', ctx.props.foo);

        Assert.throws(() => {
            ctx.actions.fail();
        }, /BOOM/);
    });

    it('should allow inspect context', async () => {
        const ctx = createContext({
            properties: {
                account: {
                    foo: 'foov',
                    bar: 'barv'
                }
            },
            functions: {
                actions: {
                    qaz: 'qazv',
                    wsx: 'wsxv'
                }
            }
        });
        Assert.deepEqual({ foo: 'foov', bar: 'barv' }, ctx.account.toJSON());
        Assert.equal('{"foo":"foov","bar":"barv"}', JSON.stringify(ctx.account));
        Assert.equal('{ foo: \'foov\', bar: \'barv\' }', require('util').inspect(ctx.account));

        Assert.deepEqual({}, ctx.actions.toJSON());
        Assert.equal('{}', require('util').inspect(ctx.actions));
        ctx.actions.qaz();
        ctx.actions.wsx();
        Assert.equal('{ qaz: [Function], wsx: [Function] }', require('util').inspect(ctx.actions));
    });

    it('should allow properties with their own ref', async () => {
        const domain = {
            foo() {
                return this.bar();
            },
            bar() {
                return 'barv';
            }
        };
        const ctx = createContext({
            properties: {
                domain
            }
        });
        Assert.equal('barv', ctx.domain.bar());
        Assert.equal('barv', ctx.domain.foo());
        Assert.equal('barv', domain.bar());
        // Assert.equal('', ctx.actions.foo());
    });

    it('should handle negative test cases', async () => {
        let ctx = createContext();

        Assert.equal(undefined, ctx.bad.foo);

        ctx = createContext({
            functions: {},
            properties: {}
        });

        Assert.ok(ctx.properties);
        Assert.equal(undefined, ctx.actions.bad);
    });

    it('should allow to form action chains', async () => {
        const ctx = createContext({
            functions: {
                actions: {
                    calc: context => param1 => {
                        return context.actions.mutate(param1);
                    },
                    mutate: context => async param1 => {
                        const val = await context.actions.three();
                        return param1 + val;
                    },
                    three: context => 3
                }
            }
        });

        Assert.equal(5, await ctx.actions.calc(2));
    });

    it('should allow to form action chains. mock one action', async () => {
        const ctx = createContext({
            functions: {
                actions: {
                    calc: context => param1 => {
                        return context.actions.mutate(param1);
                    },
                    mutate: context => async param1 => {
                        const val = await context.actions.three();
                        return param1 + val;
                    },
                    three: 3
                }
            }
        });

        Assert.equal(5, await ctx.actions.calc(2));
    });

    it('should define and consume topic in one of the actions', async () => {
        const ctx = createContext({
            functions: {
                actions: {
                    calc: context => async () => {
                        const param1 = await context.consume('param1');
                        context.actions.mutate(param1);
                        return context.consume('result');
                    },
                    mutate: context => async param1 => {
                        const val = await context.actions.three();
                        context.define('result', param1 + val);
                    },
                    three: context => 3
                }
            }
        });

        ctx.define('param1', 2);
        Assert.equal(5, await ctx.actions.calc());
    });
});