const cmd = new Deno.Command("deno", {
  args: ["doc", "--html", "--name=wires", "src/mod.ts", "src/cable/mod.ts"],
  stdout: "inherit",
  stderr: "inherit",
});

await cmd.output();
