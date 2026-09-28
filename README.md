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
  const wire = controller.reset();

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

## Cables

Bind values to a wire and transform them only while the wire is live. Cables are
opt-in and imported from `@tinymirror/wires/cable`.

- Bind a value using `wrap` or `wrapIntoChain`.
- Transform it using `map`, `tap`, `mapAsync`, or `tapAsync`.
- Read it back using `unwrap` or `unwrapLazily`.

Once the wire is cut, callbacks are skipped and the cable turns dead. This
includes cuts that happen while an async callback is running.

### Direct usage (recommended)

Wrap a value using `wrap`, then pass the cable through the utility functions.
Each one returns a cable for the next step. Async steps return a promise of a
cable, which you `await` yourself.

This is currently the optimized way to use cables.

```ts
import { breaker } from "@tinymirror/wires";
import { map, mapAsync, tap, unwrap, wrap } from "@tinymirror/wires/cable";

const controller = breaker();

const count = wrap(controller.wire, 1);
const doubled = map(count, (n) => n * 2);

// await async steps yourself, then continue with the returned cable
const label = await mapAsync(doubled, async (n) => {
  // cutting the wire here turns `label` dead
  await new Promise((resolve) => setTimeout(resolve, 100));
  return `${n}`;
});

tap(label, (text) => console.log(text)); // skipped if the wire was cut

const result = unwrap(label, "cancelled"); // "2", or "cancelled"
```

### Chains

Chains pipe the same steps together and handle the async unwrapping and
rewrapping for you. They are not optimized yet, so prefer direct usage.

```ts
import { breaker } from "@tinymirror/wires";
import { wrapIntoChain } from "@tinymirror/wires/cable";

const controller = breaker();

// unwrap gives you the promise of the final value,
// or the default value if the wire was cut.
// await the promise to get the value.
const label = await wrapIntoChain(controller.wire, 1)
  .map((n) => n * 2)
  .mapAsync((n) => {
    // do something asynchronously
    return Promise.resolve(`${n}`);
  })
  .unwrap("cancelled"); // "2", or "cancelled" if the wire was cut
```

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
