import type { Wire } from "../wire.ts";
import type { Cable } from "../cable.ts";
import { map, tap, unwrap, unwrapLazily, wrap } from "../cable.ts";

/**
 * A chainable interface over a {@linkcode Cable}.
 *
 * Create one using {@linkcode chain} on a {@linkcode Cable}
 * or directly, using {@linkcode wrapIntoChain}.
 *
 * Callbacks are skipped once the {@linkcode Wire} is cut.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface CableChain<T, R> {
  /**
   * The underlying {@linkcode Cable}.
   */
  readonly cable: Cable<T, R>;

  /**
   * Get the carried value, or `fallback` if the {@linkcode Cable} is dead.
   */
  readonly unwrap: (fallback: T) => T;

  /**
   * Get the carried value, or the result of `fallback` if the
   * {@linkcode Cable} is dead.
   *
   * `fallback` is only called if the {@linkcode Cable} is dead.
   */
  readonly unwrapLazily: (fallback: () => T) => T;

  /**
   * Transform the carried value.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   */
  readonly map: <U>(fn: (value: T, wire: Wire<R>) => U) => CableChain<U, R>;

  /**
   * Run a side effect with the carried value.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   */
  readonly tap: (fn: (value: T, wire: Wire<R>) => void) => CableChain<T, R>;

  /**
   * Transform the carried value using a callback that may be async.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   *
   * Continues as an {@linkcode AsyncCableChain}.
   */
  readonly mapAsync: <U>(
    fn: (value: T, wire: Wire<R>) => U | Promise<U>,
  ) => AsyncCableChain<U, R>;

  /**
   * Run a side effect that may be async with the carried value.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   *
   * Continues as an {@linkcode AsyncCableChain}.
   */
  readonly tapAsync: (
    fn: (value: T, wire: Wire<R>) => void | Promise<void>,
  ) => AsyncCableChain<T, R>;
}

/**
 * Wrap a {@linkcode Cable} in a {@linkcode CableChain}.
 *
 * @param cable The {@linkcode Cable} to wrap.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns A {@linkcode CableChain} over `cable`.
 */
export function chain<T, R>(cable: Cable<T, R>): CableChain<T, R> {
  return {
    cable: cable,
    unwrap: (fallback) => unwrap(cable, fallback),
    unwrapLazily: (fallback) => unwrapLazily(cable, fallback),
    map: (fn) => chain(map(cable, fn)),
    tap: (fn) => chain(tap(cable, fn)),
    mapAsync: (fn) => chainAsync(mapAsyncCable(toAsyncCable(cable), fn)),
    tapAsync: (fn) => chainAsync(tapAsyncCable(toAsyncCable(cable), fn)),
  };
}

/**
 * Bind a value to a {@linkcode Wire} and wrap it in a {@linkcode CableChain}.
 *
 * Equivalent to `chain(wrap(wire, value))`.
 *
 * @param wire The {@linkcode Wire} to bind the value to.
 * @param value The value to carry.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns A {@linkcode CableChain} carrying `value`.
 */
export function wrapIntoChain<T, R>(wire: Wire<R>, value: T): CableChain<T, R> {
  return chain(wrap(wire, value));
}

/**
 * The Live variant of the {@linkcode AwaitedAsyncCable}.
 *
 * @template T The type of the carried value.
 */
export interface LiveAwaitedAsyncCable<T> {
  /**
   * The state of the {@linkcode AwaitedAsyncCable}.
   */
  live: true;
  /**
   * The carried value.
   */
  value: T;
}

/**
 * The Dead variant of the {@linkcode AwaitedAsyncCable}.
 */
export interface DeadAwaitedAsyncCable {
  /**
   * The state of the {@linkcode AwaitedAsyncCable}.
   */
  live: false;
  /**
   * Always `undefined`.
   */
  value: undefined;
}

/**
 * The resolved value of a {@linkcode LiveAsyncCable}.
 *
 * A union of {@linkcode LiveAwaitedAsyncCable} and {@linkcode DeadAwaitedAsyncCable}
 * discriminated using the property `live`.
 *
 * Is dead if the {@linkcode Wire} is cut before pending callbacks finish.
 *
 * @template T The type of the carried value.
 */
export type AwaitedAsyncCable<T> =
  | LiveAwaitedAsyncCable<T>
  | DeadAwaitedAsyncCable;

function liveAwaitedAsyncCable<T>(value: T): LiveAwaitedAsyncCable<T> {
  return { live: true, value };
}

function deadAwaitedAsyncCable(): DeadAwaitedAsyncCable {
  return { live: false, value: undefined };
}

/**
 * The Live variant of the {@linkcode AsyncCable}.
 *
 * Holds a promise of the carried value.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface LiveAsyncCable<T, R> {
  /**
   * The state of the {@linkcode AsyncCable}.
   */
  live: true;
  /**
   * A promise of the carried value.
   */
  value: Promise<AwaitedAsyncCable<T>>;
  /**
   * The {@linkcode Wire} the {@linkcode AsyncCable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * The Dead variant of the {@linkcode AsyncCable}.
 *
 * Holds no value.
 *
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface DeadAsyncCable<R> {
  /**
   * The state of the {@linkcode AsyncCable}.
   */
  live: false;
  /**
   * Always `undefined`.
   */
  value: undefined;
  /**
   * The {@linkcode Wire} the {@linkcode AsyncCable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * A pending value bound to a {@linkcode Wire}.
 *
 * A union of {@linkcode LiveAsyncCable} and {@linkcode DeadAsyncCable}
 * discriminated using the property `live`.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export type AsyncCable<T, R> =
  | LiveAsyncCable<T, R>
  | DeadAsyncCable<R>;

function liveAsyncCable<T, R>(
  value: Promise<AwaitedAsyncCable<T>>,
  wire: Wire<R>,
): LiveAsyncCable<T, R> {
  return { live: true, value, wire };
}

function deadAsyncCable<R>(wire: Wire<R>): DeadAsyncCable<R> {
  return { live: false, value: undefined, wire };
}

/**
 * A chainable interface over an {@linkcode AsyncCable}.
 *
 * Create one using {@linkcode toAsyncCableChain}, or by calling `mapAsync`
 * or `tapAsync` on a {@linkcode CableChain}.
 *
 * Callbacks are skipped once the {@linkcode Wire} is cut.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 */
export interface AsyncCableChain<T, R> {
  /**
   * The underlying {@linkcode AsyncCable}.
   */
  readonly cable: AsyncCable<T, R>;

  /**
   * Resolve the carried value, or `fallback` if the {@linkcode AsyncCable}
   * is dead.
   */
  readonly unwrap: (fallback: T | Promise<T>) => Promise<T>;

  /**
   * Resolve the carried value, or the result of `fallback` if the
   * {@linkcode AsyncCable} is dead.
   *
   * `fallback` is only called if the {@linkcode AsyncCable} is dead.
   */
  readonly unwrapLazily: (fallback: () => T | Promise<T>) => Promise<T>;

  /**
   * Transform the carried value.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   */
  readonly map: <U>(
    fn: (value: T, wire: Wire<R>) => U,
  ) => AsyncCableChain<U, R>;

  /**
   * Run a side effect with the carried value.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   */
  readonly tap: (
    fn: (value: T, wire: Wire<R>) => void,
  ) => AsyncCableChain<T, R>;

  /**
   * Transform the carried value using a callback that may be async.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   */
  readonly mapAsync: <U>(
    fn: (value: T, wire: Wire<R>) => U | Promise<U>,
  ) => AsyncCableChain<U, R>;

  /**
   * Run a side effect that may be async with the carried value.
   *
   * `fn` also receives the bound {@linkcode Wire}.
   */
  readonly tapAsync: (
    fn: (value: T, wire: Wire<R>) => void | Promise<void>,
  ) => AsyncCableChain<T, R>;
}

async function unwrapAsyncCable<T, R>(
  cable: AsyncCable<T, R>,
  fallback: T | Promise<T>,
): Promise<T> {
  if (!cable.live || !cable.wire.state.live) return fallback;
  const awaited = await cable.value;
  return awaited.live ? awaited.value : fallback;
}

async function unwrapAsyncCableLazily<T, R>(
  cable: AsyncCable<T, R>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!cable.live || !cable.wire.state.live) return fallback();
  const awaited = await cable.value;
  return awaited.live ? awaited.value : fallback();
}

async function wrapCableTransformPromise<T, R, U>(
  cable: LiveAsyncCable<T, R>,
  fn: (value: T, wire: Wire<R>) => U | Promise<U>,
): Promise<AwaitedAsyncCable<U>> {
  const output = await cable.value;
  const wire = cable.wire;
  if (!output.live || !cable.wire.state.live) return deadAwaitedAsyncCable();
  const newValue = await fn(output.value, wire);
  if (!cable.wire.state.live) return deadAwaitedAsyncCable();
  return liveAwaitedAsyncCable(newValue);
}

async function wrapCableTapPromise<T, R>(
  cable: LiveAsyncCable<T, R>,
  fn: (value: T, wire: Wire<R>) => void | Promise<void>,
): Promise<AwaitedAsyncCable<T>> {
  const output = await cable.value;
  const wire = cable.wire;
  if (!output.live || !wire.state.live) return deadAwaitedAsyncCable();
  await fn(output.value, wire);
  if (!cable.wire.state.live) return deadAwaitedAsyncCable();
  return liveAwaitedAsyncCable(output.value);
}

function mapAsyncCable<T, R, U>(
  cable: AsyncCable<T, R>,
  fn: (value: T, wire: Wire<R>) => U | Promise<U>,
): AsyncCable<U, R> {
  if (!cable.live) return cable;
  if (!cable.wire.state.live) return deadAsyncCable(cable.wire);
  return liveAsyncCable(wrapCableTransformPromise(cable, fn), cable.wire);
}

function tapAsyncCable<T, R>(
  cable: AsyncCable<T, R>,
  fn: (value: T, wire: Wire<R>) => void | Promise<void>,
): AsyncCable<T, R> {
  if (!cable.live) return cable;
  if (!cable.wire.state.live) return deadAsyncCable(cable.wire);
  const value = wrapCableTapPromise(cable, fn);
  return liveAsyncCable(value, cable.wire);
}

function chainAsync<T, R>(
  cable: AsyncCable<T, R>,
): AsyncCableChain<T, R> {
  return {
    cable,
    unwrap: (fallback) => unwrapAsyncCable(cable, fallback),
    unwrapLazily: (fallback) => unwrapAsyncCableLazily(cable, fallback),
    map: (fn) => chainAsync(mapAsyncCable(cable, fn)),
    tap: (fn) => chainAsync(tapAsyncCable(cable, fn)),
    mapAsync: (fn) => chainAsync(mapAsyncCable(cable, fn)),
    tapAsync: (fn) => chainAsync(tapAsyncCable(cable, fn)),
  };
}

/**
 * Convert a {@linkcode Cable} into an {@linkcode AsyncCable}.
 *
 * @param cable The {@linkcode Cable} to convert.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns An {@linkcode AsyncCable} carrying the same value, or a
 * {@linkcode DeadAsyncCable} if `cable` is dead.
 */
export function toAsyncCable<T, R>(cable: Cable<T, R>): AsyncCable<T, R> {
  if (!cable.live) return deadAsyncCable(cable.wire);
  return liveAsyncCable(
    Promise.resolve(liveAwaitedAsyncCable(cable.value)),
    cable.wire,
  );
}

/**
 * Convert a {@linkcode Cable} into an {@linkcode AsyncCableChain}.
 *
 * @param cable The {@linkcode Cable} to convert.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@linkcode Wire} is dead.
 * @returns An {@linkcode AsyncCableChain} over the converted {@linkcode Cable}.
 */
export function toAsyncCableChain<T, R>(
  cable: Cable<T, R>,
): AsyncCableChain<T, R> {
  return chainAsync(toAsyncCable<T, R>(cable));
}
