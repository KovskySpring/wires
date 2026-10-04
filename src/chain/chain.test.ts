import { assertEquals, assertRejects } from "@std/assert";
import { breaker } from "../wire.ts";
import { wrap } from "../cable.ts";
import { toAsyncCableChain, wrapIntoChain } from "./chain.ts";

Deno.test("unwrap resolves the final value while the wire is live", async () => {
  const controller = breaker();
  const label = await wrapIntoChain(controller.wire, 1)
    .map((n) => n * 2)
    .mapAsync((n) => Promise.resolve(`${n}`))
    .unwrap("cancelled");

  assertEquals(label, "2");
});

Deno.test("unwrap returns the fallback when the wire is cut", async () => {
  const controller = breaker();
  const started = Promise.withResolvers<void>();
  const step = Promise.withResolvers<number>();
  const pending = wrapIntoChain(controller.wire, 1).mapAsync(() => {
    started.resolve();
    return step.promise;
  });
  const converted = toAsyncCableChain(wrap(controller.wire, 1));

  await started.promise;
  controller.cut();
  step.resolve(2);

  assertEquals(await pending.unwrap(0), 0);
  assertEquals(await pending.unwrapLazily(() => 0), 0);
  assertEquals(await converted.unwrap(0), 0);
});

Deno.test("unwrap rejects when a step rejects after the wire is cut", async () => {
  const controller = breaker();
  const started = Promise.withResolvers<void>();
  const step = Promise.withResolvers<number>();
  const chain = wrapIntoChain(controller.wire, 1).mapAsync(() => {
    started.resolve();
    return step.promise;
  });

  await started.promise;
  controller.cut();
  step.reject(new Error("step failed"));

  await assertRejects(() => chain.unwrap(0), Error, "step failed");
});

Deno.test("steps added after a cut forward a pending rejection", async () => {
  const controller = breaker();
  const started = Promise.withResolvers<void>();
  const step = Promise.withResolvers<number>();
  const first = wrapIntoChain(controller.wire, 1).mapAsync(() => {
    started.resolve();
    return step.promise;
  });

  await started.promise;
  controller.cut();

  let called = false;
  const next = first
    .mapAsync((n) => n)
    .tapAsync(() => {
      called = true;
    });
  step.reject(new Error("step failed"));

  await assertRejects(() => next.unwrap(0), Error, "step failed");
  assertEquals(called, false);
});
