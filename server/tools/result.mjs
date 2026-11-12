export const text = (t) => ({ content: [{ type: "text", text: t }], isError: false });
export const json = (v) => text(JSON.stringify(v, null, 2));
export const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true });
export const invalid = (key, why) => fail(`Invalid argument '${key}': ${why}`);
export const image = (data, mimeType, caption) => ({
  content: [
    { type: "image", data, mimeType },
    { type: "text", text: caption },
  ],
  isError: false,
});
