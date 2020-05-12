# Gate addon for HTTP protocol

This addon extends [Instathings Gate](https://github.com/Instathings/gate) for supporting HTTP protocol.

### Get started

This addon is meant to be used inside the gate Docker container and will be installed automatically once the device pairing procedure is launched from the [Editor](https://editor.instathings.io).

For hardware specific documentation refer to [our documentation](https://docs.instathings.io/docs/guides/working-http.html).

### Events

This addon extends the EventEmitter class, you can listen to the following events: 

- `data`: emitted when a device sends information (e.g.: a temperature sensor sends new data)

### License
gate-addon-http is [fair-code](http://faircode.io/) licensed under [Apache 2.0 with Commons Clause](./LICENSE.md)

