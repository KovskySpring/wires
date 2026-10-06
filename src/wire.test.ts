import {
  assert,
  assertEquals,
  assertNotStrictEquals,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { breaker, type ReadonlyWire, wire } from "./wire.ts";

Deno.test("unsubscribing during a cut stops a listener that has not run", () => {
  const cut = wire();
  const calls: string[] = [];
  cut.once(() => {
    calls.push("first");
    unsubscribe();
  });
  const unsubscribe = cut.once(() => calls.push("second"));

  cut.cut();

  assertEquals(calls, ["first"]);
});

Deno.test("connect accepts a ReadonlyWire parent", () => {
  const controller = breaker();
  const parent: ReadonlyWire = controller.wire;
  const child = wire();
  child.connect(parent);

  controller.cut();

  assert(child.isDead());
});

Deno.test("ReadonlyWire hides cut from the type only", () => {
  const readonly: ReadonlyWire = wire();

  // @ts-expect-error `cut` is not part of `ReadonlyWire`
  assertEquals(typeof readonly.cut, "function");
});

Deno.test("once calls the listener with the reason when cut", () => {
  const w = wire<string>();
  const reasons: string[] = [];
  w.once((reason) => reasons.push(reason));

  w.cut("done");
  w.cut("ignored");

  assertEquals(reasons, ["done"]);
  assertEquals(w.reason, "done");
});

Deno.test("once on a dead wire calls immediately and throws into the caller", () => {
  const w = wire<string>();
  w.cut("done");
  const reasons: string[] = [];

  w.once((reason) => reasons.push(reason));

  assertEquals(reasons, ["done"]);
  assertThrows(
    () =>
      w.once(() => {
        throw new Error("listener threw");
      }),
    Error,
    "listener threw",
  );
});

Deno.test("cut throws listener errors into the caller", () => {
  const w = wire();
  w.once(() => {
    throw new Error("listener threw");
  });

  assertThrows(() => w.cut(), Error, "listener threw");
  assert(w.isDead());
});

Deno.test("the wire is dead before listeners run", () => {
  const w = wire();
  let liveInListener: boolean | undefined;
  w.once(() => {
    liveInListener = w.isLive();
  });

  w.cut();

  assertEquals(liveInListener, false);
});

Deno.test("connect cuts the child with the parent's reason", () => {
  const parent = wire<string>();
  const child = wire<string>();
  child.connect(parent);

  parent.cut("parent");

  assert(child.isDead());
  assertEquals(child.reason, "parent");
});

Deno.test("connect cuts the child immediately when the parent is already dead", () => {
  const parent = wire<string>();
  parent.cut("parent");
  const child = wire<string>();

  child.connect(parent);

  assertEquals(child.reason, "parent");
});

Deno.test("cutting the child does not cut the parent", () => {
  const parent = wire();
  const child = wire();
  child.connect(parent);

  child.cut();

  assert(parent.isLive());
});

Deno.test("disconnect stops propagation", () => {
  const parent = wire();
  const child = wire();
  const disconnect = child.connect(parent);

  disconnect();
  parent.cut();

  assert(child.isLive());
});

Deno.test("connect propagates through a chain of wires", () => {
  const root = wire<number>();
  const middle = wire<number>();
  const leaf = wire<number>();
  middle.connect(root);
  leaf.connect(middle);

  root.cut(1);

  assertEquals(leaf.reason, 1);
});

Deno.test("breaker starts live and exposes its wire", () => {
  const controller = breaker();

  assert(controller.isLive());
  assert(!controller.isDead());
  assert(controller.wire.isLive());
  assertEquals(controller.reason, undefined);
});

Deno.test("breaker cut kills the current wire with the reason", () => {
  const controller = breaker<string>();
  const w = controller.wire;

  controller.cut("stop");

  assert(controller.isDead());
  assert(w.isDead());
  assertEquals(controller.reason, "stop");
  assertEquals(w.reason, "stop");
});

Deno.test("breaker reset cuts the previous wire and returns a fresh live one", () => {
  const controller = breaker<string>();
  const first = controller.wire;

  const next = controller.reset("superseded");

  assertEquals(first.reason, "superseded");
  assert(next.isLive());
  assertStrictEquals(controller.wire, next);
  assert(controller.isLive());
});

Deno.test("breaker reset keeps the original reason of an already cut wire", () => {
  const controller = breaker<string>();
  const first = controller.wire;
  controller.cut("first");

  controller.reset("second");

  assertEquals(first.reason, "first");
});

Deno.test("breaker reset runs the previous wire's listeners", () => {
  const controller = breaker();
  let calls = 0;
  controller.wire.once(() => calls++);

  controller.reset();

  assertEquals(calls, 1);
});

Deno.test("breaker cut and reset need no argument when the reason is undefined", () => {
  const controller = breaker();

  controller.cut();
  controller.reset();

  assert(controller.isLive());
});

Deno.test("breaker reset creates a new wire and rethrows when a listener throws", () => {
  const controller = breaker();
  const first = controller.wire;
  first.once(() => {
    throw new Error("listener threw");
  });

  assertThrows(() => controller.reset(), Error, "listener threw");

  const next: ReadonlyWire = controller.wire;
  assertNotStrictEquals(next, first);
  assert(first.isDead());
  assert(next.isLive());
});

Deno.test("cut requires a reason unless undefined is a valid reason", () => {
  const required = wire<string>();
  const optional = wire<string | undefined>();

  // @ts-expect-error a reason is required
  required.cut();
  optional.cut();

  assert(optional.isDead());
});
