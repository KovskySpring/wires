/**
 * # Typescript Wires
 *
 * [![JSR](https://jsr.io/badges/@tinymirror/wires)](https://jsr.io/@tinymirror/wires)
 *
 * Declaratively manage asynchronous logic or timed animation.
 *
 * - Check if the wire is live using {@linkcode Wire.isLive} before running logic.
 * - Skip logic if the wire is dead using {@linkcode Wire.isDead}.
 * - React to wire cuts using {@linkcode Wire.once}.
 * - Connect and propagate cuts using {@linkcode Wire.connect}.
 *
 * ## Wires
 *
 * As a design pattern, wires are an extended form of
 * [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
 * and [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
 *
 * ```ts
 * import { breaker, Breaker } from "@tinymirror/wires";
 *
 * const controller = breaker(); // or new Breaker()
 * const wire = controller.wire;
 *
 * if (wire.isDead()) {
 *   // early return
 *   // break
 *   // continue
 * }
 *
 * if (wire.isLive()) {
 *   // run some logic
 * }
 *
 * const unsubscribe = wire.once((reason) => {
 *   // handle cleanup
 * })
 *
 * // Prefer cutting from the controller, not the wire itself.
 *
 * // Cut the wire and abort any running logic
 * // propagate events to all listeners.
 *
 * // Call controller.reset() to cut the wire and
 * // prepare a new wire for the next run (returned).
 *
 * controller.cut()
 *
 * // declarative logic handling
 * function refresh() {
 *   // abort the last run and prepare the next one
 *   const wire = controller.reset()
 *
 *   // run some async logic or animations
 *   // checks if the wire is running after async
 *
 *   const unsubscribe = wire.once(() => {
 *     // handle cancellations
 *     // stop animations
 *     // cleanup values
 *   })
 *
 *   unsubscribe()
 * }
 * ```
 *
 * ## Cables
 *
 * Reduce the boilerplate of checking if a wire is live or dead by using a {@linkcode Cable}.
 *
 * Bind values to a {@linkcode Wire} and transform them while the
 * {@linkcode Wire} is live.
 *
 * - Bind a value using {@linkcode wrap}, or bind `undefined` using
 *   {@linkcode empty}.
 * - Transform it using {@linkcode map}, {@linkcode tap}, {@linkcode mapAsync}, or
 *   {@linkcode tapAsync}.
 * - Read it back using {@linkcode unwrap} or {@linkcode unwrapLazily}.
 *
 * Once the {@linkcode Wire} is cut, callbacks are skipped.
 *
 * ### Direct usage (recommended)
 *
 * Each utility function returns a {@linkcode Cable} for the next step. Async
 * steps return a promise of a {@linkcode Cable}, which you `await` yourself.
 *
 * This is currently the optimized way to use cables.
 *
 * ```ts
 * import {
 *   breaker,
 *   map,
 *   mapAsync,
 *   tapAsync,
 *   unwrap,
 *   wrap,
 * } from "@tinymirror/wires";
 *
 * const getCount = (): number => {
 *   // get some count from a server or database
 *   return Math.floor(Math.random() * 10);
 * }
 *
 * const doWork = (n: number) => new Promise<string>((resolve) => {
 *   setTimeout(() => resolve(`${n}`), 100);
 * });
 *
 * const sendAnalytics = (text: string) => new Promise<void>((resolve) => {
 *   console.log("analytics sent", text);
 *   setTimeout(() => resolve(), 100);
 * });
 *
 * const controller = breaker();
 *
 * const count = wrap(controller.wire, getCount());
 * const doubled = map(count, (n) => n * 2);
 *
 * // await async steps yourself, then continue with the returned cable
 * const label = await mapAsync(doubled, doWork);
 *
 * // skipped if the wire was cut
 * const sent = await tapAsync(label, sendAnalytics);
 *
 * // the doubled count as a string, or "cancelled"
 * const result = unwrap(sent, "cancelled");
 * ```
 *
 * ### Chains
 *
 * For a chainable interface over cables, import `wrapIntoChain` or `chain`
 * from `@tinymirror/wires/chain`.
 *
 * ## Anti Patterns
 *
 * Wires and breakers mirror the web's abort APIs:
 *
 * - A {@linkcode Wire} is similar to an
 *   [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
 * - A {@linkcode Breaker} is similar to an
 *   [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
 *
 * It's possible to use wires and breakers imperatively or in an
 * object-oriented style. The rules below keep their usage declarative, which
 * is the recommended way to use them.
 *
 * ### 1. Keep control at the top-most level
 *
 * You can dispatch an abort event on an `AbortSignal`, but aborting through
 * its `AbortController` is recommended. The same applies here, cutting
 * should go through the {@linkcode Breaker}. Control then sits at the
 * highest level, the controller, which keeps usage declarative.
 *
 * Recommended flow:
 *
 * 1. Create a {@linkcode Breaker} to manage a specific logic flow.
 * 2. Call {@linkcode Breaker.reset} per run to cut the previous run (if any)
 *    and reserve a new {@linkcode Wire}.
 * 3. Use the {@linkcode Wire} the {@linkcode Breaker} provides for the
 *    current run.
 *
 * Avoid:
 *
 * - Calling {@linkcode Wire.cut} on a wire created by a {@linkcode Breaker}.
 * - Calling {@linkcode Wire.cut} on a wire passed as a function argument.
 *
 * You should generally treat wires passed as arguments as read-only.
 *
 * ```ts
 * import { breaker, type Wire } from "@tinymirror/wires";
 *
 * const search = breaker();
 *
 * async function showResults(wire: Wire, query: string) {
 *   const response = await fetch(`/search?q=${query}`);
 *   if (wire.isDead()) return; // a newer search has started
 *   console.log(await response.text());
 * }
 *
 * function onInput(query: string) {
 *   // cut the previous run and reserve a wire for this one
 *   const wire = search.reset();
 *   showResults(wire, query);
 * }
 * ```
 *
 * ### 2. Exception to rule 1: rolling your own wire management
 *
 * When your code manages wires itself, serving the role a {@linkcode Breaker}
 * would, create, cut, and manage wires as you see fit.
 *
 * ### 3. Keep wires action-specific
 *
 * Each wire should represent one action, such as a button press, an animation
 * behaviour, or one animation chain - flows that make you think cancelling at
 * any step invalidate the entire flow.
 *
 * When one action needs more than one wire, connect the child wires to the
 * parent using {@linkcode Wire.connect} so they cut together. The flow then
 * behaves as one action.
 *
 * ```ts
 * import { breaker, wire } from "@tinymirror/wires";
 *
 * const press = breaker();
 *
 * function onPress() {
 *   const parent = press.reset();
 *   // use `parent` for actions this module is responsible for
 *
 *   const child = wire();
 *   child.connect(parent); // cutting `parent` also cuts `child`
 *
 *   // use `child` for actions this module is not responsible for
 * }
 * ```
 *
 * ### 4. Listen to cut events sparingly
 *
 * It is tempting to treat {@linkcode Wire.once} like the `abort` event on an
 * `AbortSignal`. You ought to only listen to it when you explicitly need
 * cleanup or disconnects.
 *
 * It is usually more ergonomic to ignore the values produced by a cut run and
 * keep the latest run. The most common usage, `const wire = breaker.reset()`,
 * already cancels previous runs and makes the current one the latest.
 *
 * ### 5. Exception to rule 4: animations
 *
 * Animations benefit from being stopped immediately.
 *
 * Listen to cut events when applying wires to animations. For declarative
 * animations, stop a running animation as soon as its wire is cut, then let
 * the next animation take control of the target's properties.
 *
 * ### 6. Avoid excessive cleanup on animations
 *
 * It feels natural to clean up animated properties on cut, resetting them to
 * a default or neutral state so the next animation doesn't have to. Leave
 * that to the next animation instead: each animation takes full control of
 * its targets, as if transitioning or snapping from any state.
 *
 * Context-aware transitions belong in the data. If a transition should behave
 * differently based on the previous state, the input state must carry that
 * previous state. This eliminates stale states and complex interactions.
 *
 * When applying wires to animations, stop the animation on cut and do nothing
 * more.
 *
 * ### 7. Prefer simple cut reasons over errors
 *
 * An `AbortSignal` carries an untyped `reason` once aborted. A cut reason is
 * similar, typed as `R`, and can be anything. Using an `Error` is tempting but
 * usually unnecessarily complex. Errors are meant for exceptions and
 * unexpected logic flows, and capture more than a message, such as the call
 * stack.
 *
 * Cutting and skipping is often the intended behaviour for wires, so primitives or
 * discriminated unions are descriptive enough for logging and branching. Only
 * use errors when you intend on doing more with them.
 *
 * ```ts
 * import { breaker } from "@tinymirror/wires";
 *
 * type ViewCutReason = "superseded" | "unmounted";
 * const load = breaker<ViewCutReason>();
 * const wire = load.reset("superseded");
 *
 * // later, when the view unmounts
 * load.cut("unmounted");
 *
 * if (wire.isDead()) {
 *   console.log(`load skipped: ${wire.reason}`); // "load skipped: unmounted"
 * }
 * ```
 *
 * @module
 */
export * from "./wire.ts";
export * from "./cable.ts";
