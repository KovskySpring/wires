import type { Wire } from "./wire.ts";

export interface LiveCableState<T, R> {
  live: true;
  value: T;
  wire: Wire<R>;
}

export interface DeadCableState<R> {
  live: false;
  wire: Wire<R>;
}

export type CableState<T, R> = LiveCableState<T, R> | DeadCableState<R>;

export interface Cable<T, R> {
  readonly cable: CableState<T, R>;
  readonly unwrap: (fallback: T) => T;
  readonly unwrapLazily: (fallback: () => T) => T;
  readonly map: <U>(fn: (value: T) => U) => Cable<U, R>;
  readonly tap: (fn: (value: T) => void) => Cable<T, R>;
  readonly asyncify: () => AsyncCable<T, R>;
}

function wrapCable<T, R>(
  cable: CableState<T, R>,
): Cable<T, R> {
  return {
    cable: cable,
    unwrap: (fallback: T): T => {
      return cable.live && cable.wire.state.live ? cable.value : fallback;
    },
    unwrapLazily: (fallback: () => T): T => {
      return cable.live && cable.wire.state.live ? cable.value : fallback();
    },
    map: <U>(fn: (value: T) => U): Cable<U, R> => {
      if (!cable.live) {
        return wrapCable(cable);
      }

      if (!cable.wire.state.live) {
        return wrapCable({ live: false, wire: cable.wire });
      }

      return wrapCable({
        live: true,
        wire: cable.wire,
        value: fn(cable.value),
      });
    },
    tap: (fn: (value: T) => void): Cable<T, R> => {
      if (!cable.live) {
        return wrapCable(cable);
      }

      if (!cable.wire.state.live) {
        return wrapCable({ live: false, wire: cable.wire });
      }

      fn(cable.value);

      return wrapCable(cable);
    },
    asyncify: (): AsyncCable<T, R> => toAsyncCable<T, R>(cable),
  };
}

export function wrap<T, R>(wire: Wire<R>, value: T): Cable<T, R> {
  const cb: CableState<T, R> = wire.state.live
    ? { live: true, value, wire }
    : { live: false, wire };
  return wrapCable(cb);
}

export interface AwaitedLiveAsyncCableValue<T> {
  live: true;
  value: T;
}

export interface AwaitedDeadAsyncCableValue {
  live: false;
}

export type AwaitedAsyncCableValue<T> =
  | AwaitedLiveAsyncCableValue<T>
  | AwaitedDeadAsyncCableValue;

export interface LiveAsyncCableState<T, R> {
  live: true;
  value: Promise<AwaitedAsyncCableValue<T>>;
  wire: Wire<R>;
}

export interface DeadAsyncCableState<R> {
  live: false;
  wire: Wire<R>;
}

export type AsyncCableState<T, R> =
  | LiveAsyncCableState<T, R>
  | DeadAsyncCableState<R>;

export interface AsyncCable<T, R> {
  readonly cable: AsyncCableState<T, R>;
  readonly unwrap: (fallback: T | Promise<T>) => Promise<T>;
  readonly unwrapLazily: (fallback: () => T | Promise<T>) => Promise<T>;
  readonly map: <U>(fn: (value: T) => U | Promise<U>) => AsyncCable<U, R>;
  readonly tap: (
    fn: (value: T) => void | Promise<void>,
  ) => AsyncCable<T, R>;
}

function wrapCableAsync<T, R>(
  cable: AsyncCableState<T, R>,
): AsyncCable<T, R> {
  return {
    cable,
    unwrap: async (fallback: T | Promise<T>): Promise<T> => {
      if (!cable.live || !cable.wire.state.live) {
        return fallback;
      }
      const awaited = await cable.value;
      return awaited.live ? awaited.value : fallback;
    },
    unwrapLazily: async (fallback: () => T | Promise<T>): Promise<T> => {
      if (!cable.live || !cable.wire.state.live) {
        return fallback();
      }
      const awaited = await cable.value;
      return awaited.live ? awaited.value : fallback();
    },
    map: <U>(fn: (value: T) => U | Promise<U>): AsyncCable<U, R> => {
      if (!cable.live) {
        return wrapCableAsync(cable);
      }

      if (!cable.wire.state.live) {
        return wrapCableAsync({ live: false, wire: cable.wire });
      }

      const value = cable.value.then(async (awaited) => {
        if (!awaited.live) {
          return { live: false };
        }
        const newValue = await fn(awaited.value);
        return { live: true, value: newValue };
      });

      return wrapCableAsync({
        live: true,
        wire: cable.wire,
        value: cable.value.then(async (awaited) => {
          if (!awaited.live) {
            return { live: false };
          }
          const newValue = await fn(awaited.value);
          return { live: true, value: newValue };
        }),
      });
    },

    tap: (fn: (value: T) => void | Promise<void>): AsyncCable<T, R> =>
      wrapCableAsync(
        !cable.live ? cable : {
          ...cable,
          value: cable.value.then(async (value) => {
            await fn(value);
            return value;
          }),
        },
      ),
  };
}

export function toAsyncCable<T, R>(
  cable: CableState<T, R>,
): AsyncCable<T, R> {
  const asyncCable: AsyncCableState<T, R> = cable.live
    ? { live: true, value: Promise.resolve(cable.value), wire: cable.wire }
    : { live: false, wire: cable.wire };
  return wrapCableAsync(asyncCable);
}

export function wrapAsync<T, R>(
  wire: Wire<R>,
  value: T | Promise<T>,
): AsyncCable<T, R> {
  const cable: AsyncCableState<T, R> = wire.state.live
    ? { live: true, value: Promise.resolve(value), wire }
    : { live: false, wire };
  return wrapCableAsync(cable);
}
