Oceanic Collectors
====

Fully typed collectors for Oceanic.

Installing
----------

You will need NodeJS 16.16.0+.
```
npm install Nuckyz/oceanic-collectors
```

Message Collector Example
-----------------

```js
const { MessageCollector } = require('oceanic-collectors');

const filter = (message) => message.author.id === 'ANY USER ID';
const collector = new MessageCollector(client, channel, { filter, time: 60_000 });

collector.on('collect', (message) => {
    console.log(message);
})

collector.on('end', (collectedMessages) => {
    console.log(collectedMessages.length);
})
```

awaitMessages Example
------------

```js
const { awaitMessages } = require('oceanic-collectors');

const filter = (message) => message.author.id === 'ANY USER ID';
const messages = await awaitMessages(client, channel, { filter, max: 2, time: 60_000 });

console.log(messages.length);
```

License
-------

Refer to the [LICENSE](LICENSE) file.
