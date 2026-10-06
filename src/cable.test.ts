import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  empty,
  map,
  mapAsync,
  tap,
  tapAsync,
  unwrap,
  unwrapLazily,
  wrap,
} from "./cable.ts";
import { wire } from "./wire.ts";

Deno.test("wrap carries the value while the wire is live", () => {
  const w = wire();
  const cable = wrap(w, 1);

  assert(cable.live);
  assertEquals(cable.value, 1);
  assert(cable.wire === w);
});

Deno.test("wrap returns a dead cable when the wire is already dead", () => {
  const w = wire();
  w.cut();

  const cable = wrap(w, 1);

  assert(!cable.live);
  assertEquals(cable.value, undefined);
});

Deno.test("empty carries undefined and respects a dead wire", () => {
  const live = empty(wire());
  const w = wire();
  w.cut();

  assert(live.live);
  assertEquals(live.value, undefined);
  assert(!empty(w).live);
});

Deno.test("unwrap returns the value while live and the fallback once the wire is cut", () => {
  const w = wire();
  const cable = wrap(w, 1);

  assertEquals(unwrap(cable, 0), 1);
  w.cut();
  assertEquals(unwrap(cable, 0), 0);
});

Deno.test("unwrapLazily only calls the fallback when dead", () => {
  const w = wire();
  const cable = wrap(w, 1);
  let calls = 0;
  const fallback = () => {
    calls++;
    return 0;
  };

  assertEquals(unwrapLazily(cable, fallback), 1);
  assertEquals(calls, 0);
  w.cut();
  assertEquals(unwrapLazily(cable, fallback), 0);
  assertEquals(calls, 1);
});

Deno.test("map transforms the value and passes the wire", () => {
  const w = wire();
  const mapped = map(wrap(w, 2), (n, given) => {
    assert(given === w);
    return n * 2;
  });

  assertEquals(unwrap(mapped, 0), 4);
});

Deno.test("map skips fn when the cable or wire is dead", () => {
  const w = wire();
  const cable = wrap(w, 1);
  let calls = 0;
  const fn = (n: number) => {
    calls++;
    return n;
  };

  w.cut();
  const afterCut = map(cable, fn);
  const fromDead = map(afterCut, fn);

  assert(!afterCut.live);
  assert(!fromDead.live);
  assertEquals(calls, 0);
});

Deno.test("tap runs the side effect and returns the same cable", () => {
  const cable = wrap(wire(), 1);
  const seen: number[] = [];

  const result = tap(cable, (n) => seen.push(n));

  assert(result === cable);
  assertEquals(seen, [1]);
});

Deno.test("tap skips fn when the wire is dead", () => {
  const w = wire();
  const cable = wrap(w, 1);
  let calls = 0;
  w.cut();

  const result = tap(cable, () => calls++);

  assert(!result.live);
  assertEquals(calls, 0);
});

Deno.test("mapAsync transforms values and accepts a promise of a cable", async () => {
  const w = wire();
  const first = await mapAsync(wrap(w, 1), (n) => Promise.resolve(n + 1));
  const second = await mapAsync(
    Promise.resolve(first),
    (n) => `${n}`,
  );

  assertEquals(unwrap(second, ""), "2");
});

Deno.test("mapAsync returns a dead cable when the wire is cut while fn runs", async () => {
  const w = wire();

  const result = await mapAsync(wrap(w, 1), async (n) => {
    await Promise.resolve();
    w.cut();
    return n;
  });

  assert(!result.live);
});

Deno.test("mapAsync skips fn when the wire is already dead", async () => {
  const w = wire();
  const cable = wrap(w, 1);
  let calls = 0;
  w.cut();

  const result = await mapAsync(cable, () => calls++);

  assert(!result.live);
  assertEquals(calls, 0);
});

Deno.test("mapAsync rejects when fn rejects, even after a cut", async () => {
  const w = wire();

  await assertRejects(
    () =>
      mapAsync(wrap(w, 1), () => {
        w.cut();
        return Promise.reject(new Error("boom"));
      }),
    Error,
    "boom",
  );
});

Deno.test("tapAsync runs the side effect and keeps the value", async () => {
  const seen: number[] = [];

  const result = await tapAsync(wrap(wire(), 1), async (n) => {
    await Promise.resolve();
    seen.push(n);
  });

  assertEquals(unwrap(result, 0), 1);
  assertEquals(seen, [1]);
});

Deno.test("tapAsync returns a dead cable when the wire is cut while fn runs", async () => {
  const w = wire();

  const result = await tapAsync(wrap(w, 1), async () => {
    await Promise.resolve();
    w.cut();
  });

  assert(!result.live);
});

Deno.test("tapAsync skips fn when the wire is already dead", async () => {
  const w = wire();
  const cable = wrap(w, 1);
  let calls = 0;
  w.cut();

  const result = await tapAsync(cable, () => {
    calls++;
  });

  assert(!result.live);
  assertEquals(calls, 0);
});

Deno.test("tapAsync rejects when fn rejects", async () => {
  await assertRejects(
    () => tapAsync(wrap(wire(), 1), () => Promise.reject(new Error("boom"))),
    Error,
    "boom",
  );
});
