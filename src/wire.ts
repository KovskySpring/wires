/**
 * The Live variant of the {@link WireState}.
 */
export interface LiveWireState {
  /**
   * The state of the {@link Wire}.
   */
  live: true;
}

/**
 * The Dead variant of the {@link WireState}.
 *
 * Includes the reason the {@link Wire} is dead.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface DeadWireState<R = undefined> {
  /**
   * The state of the {@link Wire}.
   */
  live: false;
  /**
   * The reason the {@link Wire} is dead.
   */
  reason: R;
}

/**
 * The state of a {@link Wire}.
 *
 * A union of {@link LiveWireState} and {@link DeadWireState}
 * discriminated using the property `live`.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export type WireState<R = undefined> = LiveWireState | DeadWireState<R>;

/**
 * The read-only interface for a {@link LiveWireState}.
 *
 * The Live variant of the {@link WireState}.
 */
export interface ReadonlyLiveWireState extends LiveWireState {
  /**
   * The state of the {@link Wire}.
   */
  readonly live: true;
}

/**
 * The read-only interface for a {@link DeadWireState}.
 *
 * The Dead variant of the {@link WireState}.
 *
 * Includes the reason the {@link Wire} is dead.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export interface ReadonlyDeadWireState<R = undefined> extends DeadWireState<R> {
  /**
   * The state of the {@link Wire}.
   */
  readonly live: false;
  /**
   * The reason the {@link Wire} is dead.
   */
  readonly reason: R;
}

/**
 * The read-only interface for a {@link WireState}.
 *
 * The state of a {@link Wire}.
 *
 * A union of {@link LiveWireState} and {@link DeadWireState}
 * discriminated using the property `live`.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export type ReadonlyWireState<R = undefined> =
  | ReadonlyLiveWireState
  | ReadonlyDeadWireState<R>;

function createLiveWireState(): LiveWireState {
  return { live: true };
}

function createDeadWireState<R = undefined>(reason: R): DeadWireState<R> {
  return { live: false, reason };
}

const NOOP = () => {};

/**
 * The callback invoked when a {@link Wire} is cut.
 *
 * @param reason The reason the {@link Wire} is cut.
 */
export type WireCutCallback<R = undefined> = (reason: R) => void;

/**
 * Declaratively manage asynchronous logic or timed animation.
 *
 * - Check if the wire is live using {@link Wire.isLive} before running logic.
 * - Skip logic if the wire is dead using {@link Wire.isDead}.
 * - React to wire cuts using {@link Wire.once}.
 *
 * **Note**: It is recommended that you create and control wires through the
 * {@link Breaker} rather than on the {@link Wire} directly.
 * See "Anti Patterns" in module documentations. You can still use {@link Wire}
 * directly should you wish to.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export class Wire<R = undefined> {
  /**
   * The current state of the {@link Wire}.
   */
  protected current: WireState<R> = createLiveWireState();

  /**
   * The next callback index used as the key
   * for the next callback in {@link Wire.callbacks}.
   */
  protected nextCallbackIndex = 0;

  /**
   * The callback map emitted when {@link Wire.cut}
   * is called.
   */
  protected callbacks: Map<number, WireCutCallback<R>> = new Map();

  /**
   * The current state of the {@link Wire}
   */
  public get state(): ReadonlyWireState<R> {
    return this.current;
  }

  /**
   * Whether the {@link Wire} is live.
   */
  public isLive(): this is typeof this & { state: ReadonlyLiveWireState } {
    return this.current.live;
  }

  /**
   * Whether the {@link Wire} is dead.
   */
  public isDead(): this is typeof this & { state: ReadonlyDeadWireState<R> } {
    return !this.current.live;
  }

  /**
   * The reason the {@link Wire} is dead.
   *
   * Is `undefined` if the {@link Wire} is live.
   */
  public get reason(): R | undefined {
    return this.current.live ? undefined : this.current.reason;
  }

  /**
   * Listen to when the {@link Wire} is cut.
   *
   * The callback is automatically unsubscribed after the first
   * invocation.
   *
   * Use the returned function to unsubscribe early.
   *
   * @param fun The callback invoked when a {@link Wire} is cut.
   * @returns A function to unsubscribe from the {@link Wire}'s cut
   * event.
   */
  public once(fun: WireCutCallback<R>): () => void {
    if (!this.current.live) {
      fun(this.current.reason);
      return NOOP;
    }

    const id = this.nextCallbackIndex++;
    this.callbacks.set(id, fun);
    return () => {
      this.callbacks.delete(id);
    };
  }

  /**
   * Cut a {@link Wire} and invoke all callbacks.
   *
   * The {@link Wire} will be set to dead before the callbacks
   * are invoked.
   *
   * If the reason type is `undefined` you can leave the param
   * `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Wire<T>` is not assignable
   * to method's `this` of type `Wire<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Wire} is cut.
   * @template R The type of the reason the {@link Wire} is dead.
   */
  public cut(this: Wire<undefined>, reason?: R): void;
  /**
   * Cut a {@link Wire} and invoke all callbacks.
   *
   * The {@link Wire} will be set to dead before the callbacks
   * are invoked.
   *
   * If the reason type is `undefined` you can leave the param
   * `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Wire<T>` is not assignable
   * to method's `this` of type `Wire<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Wire} is cut.
   * @template R The type of the reason the {@link Wire} is dead.
   */
  public cut<R>(this: Wire<R>, reason: R): void;
  /**
   * Cut a {@link Wire} and invoke all callbacks.
   *
   * The {@link Wire} will be set to dead before the callbacks
   * are invoked.
   *
   * If the reason type is `undefined` you can leave the param
   * `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Wire<T>` is not assignable
   * to method's `this` of type `Wire<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Wire} is cut.
   * @template R The type of the reason the {@link Wire} is dead.
   */
  public cut(reason: R): void {
    this.current = createDeadWireState(reason);
    const funs = [...this.callbacks.values()];
    for (const fun of funs) fun(reason);
    this.callbacks.clear();
    return;
  }
}

/**
 * Create a new {@link Wire}. Equivalent to `new Wire<R>()`.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 * @returns A new {@link Wire}.
 */
export function wire<R = undefined>(): Wire<R> {
  return new Wire<R>();
}

/**
 * Declaratively manage asynchronous logic or timed animation.
 *
 * - Check if the wire is live using {@link Breaker.isLive} before running logic.
 * - Skip logic if the wire is dead using {@link Breaker.isDead}.
 * - React to wire cuts using {@link Breaker.wire.once}.
 *
 * **Note**: It is recommended that you create and control wires through the
 * {@link Breaker} rather than on the {@link Wire} directly.
 * See "Anti Patterns" in module documentations. You can still use {@link Wire}
 * directly should you wish to.
 *
 * @template R The type of the reason the {@link Wire} is dead.
 */
export class Breaker<R = undefined> {
  /**
   * The current {@link Wire} instance.
   *
   * Rotated out when {@link Breaker.reset} is called.
   */
  protected current: Wire<R> = new Wire();

  /**
   * The current {@link Wire} instance.
   *
   * Rotated out when {@link Breaker.reset} is called.
   */
  public get wire(): Wire<R> {
    return this.current;
  }

  /**
   * The reason the {@link Breaker} is dead.
   *
   * Is `undefined` if the {@link Breaker} is live.
   */
  public get reason(): R | undefined {
    return this.current.reason;
  }

  /**
   * Whether the {@link Breaker} is live.
   */
  public isLive(): this is typeof this & {
    wire: Wire<R> & { state: ReadonlyLiveWireState };
  } {
    return this.current.isLive();
  }

  /**
   * Whether the {@link Breaker} is dead.
   */
  public isDead(): this is typeof this & {
    wire: Wire<R> & { state: ReadonlyDeadWireState<R> };
  } {
    return this.current.isDead();
  }

  /**
   * Cut the {@link Breaker}'s current {@link Wire} and invoke all callbacks.
   *
   * The {@link Breaker} will be set to dead before the callbacks
   * are invoked.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Breaker} is cut.
   * @template R The type of the reason the {@link Breaker} is dead.
   */
  public cut(this: Breaker<undefined>, reason?: R): void;
  /**
   * Cut the {@link Breaker}'s current {@link Wire} and invoke all callbacks.
   *
   * The {@link Breaker} will be set to dead before the callbacks
   * are invoked.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Breaker} is cut.
   * @template R The type of the reason the {@link Breaker} is dead.
   */
  public cut<R>(this: Breaker<R>, reason: R): void;
  /**
   * Cut the {@link Breaker}'s current {@link Wire} and invoke all callbacks.
   *
   * The {@link Breaker} will be set to dead before the callbacks
   * are invoked.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your cut. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Breaker} is cut.
   * @template R The type of the reason the {@link Breaker} is dead.
   */
  public cut(reason: R): void {
    this.current.cut(reason);
  }

  /**
   * Reset the {@link Breaker}'s current {@link Wire} to a new live {@link Wire}.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your reset. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Breaker} is reset.
   * @template R The type of the reason the {@link Breaker} is dead.
   */
  public reset(this: Breaker<undefined>, reason?: R): Wire<R>;
  /**
   * Reset the {@link Breaker}'s current {@link Wire} to a new live {@link Wire}.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your reset. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Breaker} is reset.
   * @template R The type of the reason the {@link Breaker} is dead.
   */
  public reset<R>(this: Breaker<R>, reason: R): Wire<R>;
  /**
   * Reset the {@link Breaker}'s current {@link Wire} to a new live {@link Wire}.
   *
   * If the reason type is `undefined` you can leave the param `reason` empty. Otherwise, a `reason` is required.
   *
   * This is done through class method this type overloading.
   * Both overloadings will show up but Typescript will strictly
   * enforce just one of them upon usage.
   *
   * Note: You might get some strange interface error where Typescript
   * says that the `this` context of type `Breaker<T>` is not assignable
   * to method's `this` of type `Breaker<undefined>`. This means
   * you defined the type `R` but forgot to include a reason
   * in your reset. `reason` is required in this scenario.
   *
   * @param reason The reason the {@link Breaker} is reset.
   * @template R The type of the reason the {@link Breaker} is dead.
   */
  public reset(reason: R): Wire<R> {
    this.cut(reason);
    this.current = new Wire<R>();
    return this.current;
  }
}

/**
 * Create a new {@link Breaker}. Equivalent to `new Breaker<R>()`.
 *
 * @template R The type of the reason the {@link Breaker} is dead.
 * @returns A new {@link Breaker}.
 */
export function breaker<R = undefined>(): Breaker<R> {
  return new Breaker<R>();
}
