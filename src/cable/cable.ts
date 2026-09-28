import type { Wire } from "../wire.ts";

/**
 * The Live variant of the {@link Cable}.
 *
 * Holds the carried value.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface LiveCable<T, R> {
  /**
   * The state of the {@link Cable}.
   */
  live: true;
  /**
   * The carried value.
   */
  value: T;
  /**
   * The {@link Wire} the {@link Cable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * The Dead variant of the {@link Cable}.
 *
 * Holds no value.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface DeadCable<R> {
  /**
   * The state of the {@link Cable}.
   */
  live: false;
  /**
   * The {@link Wire} the {@link Cable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * A value bound to a {@link Wire}.
 *
 * A union of {@link LiveCable} and {@link DeadCable}
 * discriminated using the property `live`.
 *
 * A {@link LiveCable} is treated as dead once its {@link Wire} is cut.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 */
export type Cable<T, R> = LiveCable<T, R> | DeadCable<R>;

/**
 * A chainable interface over a {@link Cable}.
 *
 * Create one using {@link chain} or {@link wrapIntoChain}.
 *
 * Callbacks are skipped once the {@link Wire} is cut.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface CableChain<T, R> {
  /**
   * The underlying {@link Cable}.
   */
  readonly cable: Cable<T, R>;
  /**
   * Get the carried value, or `fallback` if the {@link Cable} is dead.
   */
  readonly unwrap: (fallback: T) => T;
  /**
   * Get the carried value, or the result of `fallback` if the
   * {@link Cable} is dead.
   *
   * `fallback` is only called if the {@link Cable} is dead.
   */
  readonly unwrapLazily: (fallback: () => T) => T;
  /**
   * Transform the carried value.
   */
  readonly map: <U>(fn: (value: T) => U) => CableChain<U, R>;
  /**
   * Run a side effect with the carried value.
   */
  readonly tap: (fn: (value: T) => void) => CableChain<T, R>;
  /**
   * Transform the carried value using a callback that may be async.
   *
   * Continues as an {@link AsyncCableChain}.
   */
  readonly mapAsync: <U>(
    fn: (value: T) => U | Promise<U>,
  ) => AsyncCableChain<U, R>;
  /**
   * Run a side effect that may be async with the carried value.
   *
   * Continues as an {@link AsyncCableChain}.
   */
  readonly tapAsync: (
    fn: (value: T) => void | Promise<void>,
  ) => AsyncCableChain<T, R>;
}

/**
 * Bind a value to a {@link Wire}.
 *
 * Returns a {@link DeadCable} if the {@link Wire} is already dead.
 *
 * @param wire The {@link Wire} to bind the value to.
 * @param value The value to carry.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns A {@link Cable} carrying `value`.
 */
export function wrap<T, R>(wire: Wire<R>, value: T): Cable<T, R> {
  return wire.state.live ? { live: true, value, wire } : { live: false, wire };
}

/**
 * Get the value carried by a {@link Cable}.
 *
 * @param cable The {@link Cable} to read.
 * @param fallback The value returned if the {@link Cable} or its
 * {@link Wire} is dead.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns The carried value, or `fallback`.
 */
export function unwrap<T, R>(cable: Cable<T, R>, fallback: T): T {
  return cable.live && cable.wire.state.live ? cable.value : fallback;
}

/**
 * Get the value carried by a {@link Cable}.
 *
 * Use over {@link unwrap} when the fallback is expensive to compute.
 *
 * @param cable The {@link Cable} to read.
 * @param fallback Computes the value returned if the {@link Cable} or its
 * {@link Wire} is dead. Only called in that case.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns The carried value, or the result of `fallback`.
 */
export function unwrapLazily<T, R>(
  cable: Cable<T, R>,
  fallback: () => T,
): T {
  return cable.live && cable.wire.state.live ? cable.value : fallback();
}

/**
 * Transform the value carried by a {@link Cable}.
 *
 * `fn` is skipped if the {@link Cable} or its {@link Wire} is dead.
 *
 * @param cable The {@link Cable} to transform.
 * @param fn Transforms the carried value.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @template U The type of the transformed value.
 * @returns A {@link Cable} carrying the transformed value, or a
 * {@link DeadCable}.
 */
export function map<T, R, U>(
  cable: Cable<T, R>,
  fn: (value: T) => U,
): Cable<U, R> {
  if (!cable.live) {
    return cable;
  }

  if (!cable.wire.state.live) {
    return { live: false, wire: cable.wire };
  }

  return {
    live: true,
    value: fn(cable.value),
    wire: cable.wire,
  };
}

/**
 * Run a side effect with the value carried by a {@link Cable}.
 *
 * `fn` is skipped if the {@link Cable} or its {@link Wire} is dead.
 *
 * @param cable The {@link Cable} to read.
 * @param fn The side effect invoked with the carried value.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns The same {@link Cable}, or a {@link DeadCable} if the
 * {@link Wire} is dead.
 */
export function tap<T, R>(
  cable: Cable<T, R>,
  fn: (value: T) => void,
): Cable<T, R> {
  if (!cable.live) {
    return cable;
  }

  if (!cable.wire.state.live) {
    return { live: false, wire: cable.wire };
  }

  fn(cable.value);

  return cable;
}

/**
 * Transform the value carried by a {@link Cable} using a callback that
 * may be async.
 *
 * `fn` is skipped if the {@link Cable} or its {@link Wire} is dead.
 * The result is a {@link DeadCable} if the {@link Wire} is cut while
 * `fn` runs.
 *
 * @param cable The {@link Cable}, or a promise of one, to transform.
 * @param fn Transforms the carried value.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @template U The type of the transformed value.
 * @returns A promise of a {@link Cable} carrying the transformed value,
 * or a {@link DeadCable}.
 */
export async function mapAsync<T, R, U>(
  cable: Cable<T, R> | Promise<Cable<T, R>>,
  fn: (value: T) => U | Promise<U>,
): Promise<Cable<U, R>> {
  const awaited = await Promise.resolve(cable);
  const wire = awaited.wire;

  if (!awaited.live) {
    return awaited;
  }

  if (!wire.state.live) {
    return { live: false, wire };
  }

  const converted = await fn(awaited.value);

  if (!wire.state.live) {
    return { live: false, wire };
  }

  return {
    live: true,
    value: converted,
    wire: awaited.wire,
  };
}

/**
 * Run a side effect that may be async with the value carried by a
 * {@link Cable}.
 *
 * `fn` is skipped if the {@link Cable} or its {@link Wire} is dead.
 * The result is a {@link DeadCable} if the {@link Wire} is cut while
 * `fn` runs.
 *
 * @param cable The {@link Cable}, or a promise of one, to read.
 * @param fn The side effect invoked with the carried value.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns A promise of the same {@link Cable}, or a {@link DeadCable}.
 */
export async function tapAsync<T, R>(
  cable: Cable<T, R> | Promise<Cable<T, R>>,
  fn: (value: T) => void | Promise<void>,
): Promise<Cable<T, R>> {
  const awaited = await Promise.resolve(cable);
  const wire = awaited.wire;

  if (!awaited.live) {
    return awaited;
  }

  if (!wire.state.live) {
    return { live: false, wire };
  }

  await fn(awaited.value);

  if (!wire.state.live) {
    return { live: false, wire };
  }

  return awaited;
}

/**
 * Wrap a {@link Cable} in a {@link CableChain}.
 *
 * @param cable The {@link Cable} to wrap.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns A {@link CableChain} over `cable`.
 */
export function chain<T, R>(cable: Cable<T, R>): CableChain<T, R> {
  return {
    cable: cable,
    unwrap: (fallback: T): T => unwrap<T, R>(cable, fallback),
    unwrapLazily: (fallback: () => T): T => unwrapLazily<T, R>(cable, fallback),
    map: <U>(fn: (value: T) => U): CableChain<U, R> =>
      chain(map<T, R, U>(cable, fn)),
    tap: (fn: (value: T) => void): CableChain<T, R> =>
      chain(tap<T, R>(cable, fn)),
    mapAsync: <U>(
      fn: (value: T) => U | Promise<U>,
    ): AsyncCableChain<U, R> =>
      chainAsync(mapAsyncCable<T, R, U>(toAsyncCable(cable), fn)),
    tapAsync: (
      fn: (value: T) => void | Promise<void>,
    ): AsyncCableChain<T, R> =>
      chainAsync(tapAsyncCable<T, R>(toAsyncCable(cable), fn)),
  };
}

/**
 * Bind a value to a {@link Wire} and wrap it in a {@link CableChain}.
 *
 * Equivalent to `chain(wrap(wire, value))`.
 *
 * @param wire The {@link Wire} to bind the value to.
 * @param value The value to carry.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns A {@link CableChain} carrying `value`.
 */
export function wrapIntoChain<T, R>(wire: Wire<R>, value: T): CableChain<T, R> {
  return chain(wrap(wire, value));
}

/**
 * The Live variant of the {@link AwaitedAsyncCable}.
 *
 * @template T The type of the carried value.
 */
export interface LiveAwaitedAsyncCable<T> {
  /**
   * The state of the {@link AwaitedAsyncCable}.
   */
  live: true;
  /**
   * The carried value.
   */
  value: T;
}

/**
 * The Dead variant of the {@link AwaitedAsyncCable}.
 */
export interface DeadAwaitedAsyncCable {
  /**
   * The state of the {@link AwaitedAsyncCable}.
   */
  live: false;
}

/**
 * The resolved value of a {@link LiveAsyncCable}.
 *
 * A union of {@link LiveAwaitedAsyncCable} and {@link DeadAwaitedAsyncCable}
 * discriminated using the property `live`.
 *
 * Is dead if the {@link Wire} is cut before pending callbacks finish.
 *
 * @template T The type of the carried value.
 */
export type AwaitedAsyncCable<T> =
  | LiveAwaitedAsyncCable<T>
  | DeadAwaitedAsyncCable;

/**
 * The Live variant of the {@link AsyncCable}.
 *
 * Holds a promise of the carried value.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface LiveAsyncCable<T, R> {
  /**
   * The state of the {@link AsyncCable}.
   */
  live: true;
  /**
   * A promise of the carried value.
   */
  value: Promise<AwaitedAsyncCable<T>>;
  /**
   * The {@link Wire} the {@link AsyncCable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * The Dead variant of the {@link AsyncCable}.
 *
 * Holds no value.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface DeadAsyncCable<R> {
  /**
   * The state of the {@link AsyncCable}.
   */
  live: false;
  /**
   * The {@link Wire} the {@link AsyncCable} is bound to.
   */
  wire: Wire<R>;
}

/**
 * A pending value bound to a {@link Wire}.
 *
 * A union of {@link LiveAsyncCable} and {@link DeadAsyncCable}
 * discriminated using the property `live`.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 */
export type AsyncCable<T, R> =
  | LiveAsyncCable<T, R>
  | DeadAsyncCable<R>;

/**
 * A chainable interface over an {@link AsyncCable}.
 *
 * Create one using {@link toAsyncCableChain}, or by calling `mapAsync`
 * or `tapAsync` on a {@link CableChain}.
 *
 * Callbacks are skipped once the {@link Wire} is cut.
 *
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface AsyncCableChain<T, R> {
  /**
   * The underlying {@link AsyncCable}.
   */
  readonly cable: AsyncCable<T, R>;
  /**
   * Resolve the carried value, or `fallback` if the {@link AsyncCable}
   * is dead.
   */
  readonly unwrap: (fallback: T | Promise<T>) => Promise<T>;
  /**
   * Resolve the carried value, or the result of `fallback` if the
   * {@link AsyncCable} is dead.
   *
   * `fallback` is only called if the {@link AsyncCable} is dead.
   */
  readonly unwrapLazily: (fallback: () => T | Promise<T>) => Promise<T>;
  /**
   * Transform the carried value.
   */
  readonly map: <U>(fn: (value: T) => U) => AsyncCableChain<U, R>;
  /**
   * Run a side effect with the carried value.
   */
  readonly tap: (fn: (value: T) => void) => AsyncCableChain<T, R>;
  /**
   * Transform the carried value using a callback that may be async.
   */
  readonly mapAsync: <U>(
    fn: (value: T) => U | Promise<U>,
  ) => AsyncCableChain<U, R>;
  /**
   * Run a side effect that may be async with the carried value.
   */
  readonly tapAsync: (
    fn: (value: T) => void | Promise<void>,
  ) => AsyncCableChain<T, R>;
}

async function unwrapAsyncCable<T, R>(
  cable: AsyncCable<T, R>,
  fallback: T | Promise<T>,
): Promise<T> {
  if (!cable.live || !cable.wire.state.live) {
    return fallback;
  }
  const awaited = await cable.value;
  return awaited.live ? awaited.value : fallback;
}

async function unwrapAsyncCableLazily<T, R>(
  cable: AsyncCable<T, R>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!cable.live || !cable.wire.state.live) {
    return fallback();
  }
  const awaited = await cable.value;
  return awaited.live ? awaited.value : fallback();
}

async function wrapCableTransformPromise<T, R, U>(
  cable: LiveAsyncCable<T, R>,
  fn: (value: T) => U | Promise<U>,
): Promise<AwaitedAsyncCable<U>> {
  const output = await cable.value;
  if (!output.live || !cable.wire.state.live) {
    return { live: false };
  }

  const newValue = await fn(output.value);

  if (!cable.wire.state.live) {
    return { live: false };
  }

  return {
    live: true,
    value: newValue,
  };
}

async function wrapCableTapPromise<T, R>(
  cable: LiveAsyncCable<T, R>,
  fn: (value: T) => void | Promise<void>,
): Promise<AwaitedAsyncCable<T>> {
  const output = await cable.value;
  if (!output.live || !cable.wire.state.live) {
    return { live: false };
  }

  await fn(output.value);

  if (!cable.wire.state.live) {
    return { live: false };
  }

  return {
    live: true,
    value: output.value,
  };
}

function mapAsyncCable<T, R, U>(
  cable: AsyncCable<T, R>,
  fn: (value: T) => U | Promise<U>,
): AsyncCable<U, R> {
  if (!cable.live) {
    return cable;
  }

  if (!cable.wire.state.live) {
    return { live: false, wire: cable.wire };
  }

  const value = wrapCableTransformPromise(cable, fn);

  return {
    live: true,
    wire: cable.wire,
    value,
  };
}

function tapAsyncCable<T, R>(
  cable: AsyncCable<T, R>,
  fn: (value: T) => void | Promise<void>,
): AsyncCable<T, R> {
  if (!cable.live) {
    return cable;
  }

  if (!cable.wire.state.live) {
    return { live: false, wire: cable.wire };
  }

  const value = wrapCableTapPromise(cable, fn);

  return {
    live: true,
    wire: cable.wire,
    value,
  };
}

function chainAsync<T, R>(
  cable: AsyncCable<T, R>,
): AsyncCableChain<T, R> {
  return {
    cable,
    unwrap: (fallback: T | Promise<T>): Promise<T> =>
      unwrapAsyncCable<T, R>(cable, fallback),

    unwrapLazily: (fallback: () => T | Promise<T>): Promise<T> =>
      unwrapAsyncCableLazily<T, R>(cable, fallback),

    map: <U>(fn: (value: T) => U): AsyncCableChain<U, R> =>
      chainAsync(mapAsyncCable<T, R, U>(cable, fn)),

    tap: (fn: (value: T) => void): AsyncCableChain<T, R> =>
      chainAsync(tapAsyncCable<T, R>(cable, fn)),

    mapAsync: <U>(fn: (value: T) => U | Promise<U>): AsyncCableChain<U, R> =>
      chainAsync(mapAsyncCable<T, R, U>(cable, fn)),

    tapAsync: (fn: (value: T) => void | Promise<void>): AsyncCableChain<T, R> =>
      chainAsync(tapAsyncCable<T, R>(cable, fn)),
  };
}

/**
 * Convert a {@link Cable} into an {@link AsyncCable}.
 *
 * @param cable The {@link Cable} to convert.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns An {@link AsyncCable} carrying the same value, or a
 * {@link DeadAsyncCable} if `cable` is dead.
 */
export function toAsyncCable<T, R>(cable: Cable<T, R>): AsyncCable<T, R> {
  if (!cable.live) {
    return { live: false, wire: cable.wire };
  }

  return {
    live: true,
    value: Promise.resolve({
      live: true,
      value: cable.value,
    }),
    wire: cable.wire,
  };
}

/**
 * Convert a {@link Cable} into an {@link AsyncCableChain}.
 *
 * @param cable The {@link Cable} to convert.
 * @template T The type of the carried value.
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns An {@link AsyncCableChain} over the converted {@link Cable}.
 */
export function toAsyncCableChain<T, R>(
  cable: Cable<T, R>,
): AsyncCableChain<T, R> {
  return chainAsync(toAsyncCable<T, R>(cable));
}
