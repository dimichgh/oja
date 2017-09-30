# Changelog

## v1.0.0
* Added support to add array of actions to a base action
```js
const baseAction = new Action();
baseAction.add([
    new Action(),
    new Action(),
    new Action()
]) // or
.add(new Action(), new Action(), new Action());
```
* Breaking change: action.consume(array of topics) will now return promise that will resolve to a map of resolved values instead of returning a map of promises that are not yet resolved.
