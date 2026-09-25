# Typescript Wires

Declaratively manage asynchronous logic or timed animation.

- Check if the wire is live using `Wire.isLive` before running logic.
- Skip logic if the wire is dead using `Wire.isDead`.
- React to wire cuts using `Wire.once`.

```ts
import { Breaker, breaker } from "@tinymirror/wires";

const controller = breaker(); // or new Breaker()
const wire = controller.wire;

if (wire.isDead()) {
  // early return
  // break
  // continue
}

if (wire.isLive()) {
  // run some logic
}

const unsubscribe = wire.once((reason) => {
  // handle cleanup
});

// cut the wire and abort any running logic
// propogate events to all listeners
controller.cut();

// declarative logic handling
function refresh() {
  // abort the last run and prepare the next one
  const wire = controller.renew();

  // run some async logic or animations
  // checks if the wire is running after async

  const unsubscribe = wire.once(() => {
    // handle cancellations
    // stop animations
    // cleanup values
  });

  unsubscribe();
}
```

Wires are extended forms of
[AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)

---

## Installation

This package is published to [JSR](https://jsr.io) as
[`@tinymirror/wires`](https://jsr.io/@tinymirror/wires).

```bash
# deno
deno add jsr:@tinymirror/wires

# pnpm 10.9+ and yarn 4.9+
pnpm add jsr:@tinymirror/wires
yarn add jsr:@tinymirror/wires

# npm, bun, and older versions of yarn or pnpm
npx jsr add @tinymirror/wires
bunx jsr add @tinymirror/wires
yarn dlx jsr add @tinymirror/wires
pnpm dlx jsr add @tinymirror/wires
```

---

## Documentation

Check out the documentations on
[jsr.io/@tinymirror/wires](https://jsr.io/@tinymirror/wires)

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

I use [Mise](https://mise.jdx.dev/) to manage tooling for the project. The
project uses [Deno](https://deno.com) for development and building. If you use
`mise`, just clone the repo and you're ready to go. Otherwise, please install
Deno and keep track of it yourself.
