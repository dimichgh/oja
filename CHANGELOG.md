# Changelog

## v1.2.1
* Made context action enumerable

## v1.2.0
* Added context based approach.

## v1.1.3
* Fixed: should not emit Unhandled promise rejection when the error is actually handled

## v1.1.2
* Increased a limit of listeners to 100 for big action networks

## v1.1.1
* Fixed: should correctly detect end of stream when reader is used.

## v1.1.0
* Added reader to support async/await syntax.

## v1.0.1
* Fix: should allow registration of child actions in execute method of a main action and activate them afterwards

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
