const assert = require("node:assert/strict");

// Focus only once. Locator.press()/fill() can refocus a broken input and hide
// the user's one-character failure. Send subsequent keys to the active page.
exports.typeAndCheck = async (page, frame, selector, value, delay = 100) => {
  const input = frame.locator(selector);
  await input.click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+A" : "Control+A",
  );
  await page.keyboard.press("Backspace");
  // VS Code forwards native Select All asynchronously to its nested webview.
  // Let that command settle before the first typed character.
  await new Promise((resolve) => setTimeout(resolve, 250));
  let expected = "";
  for (const character of value) {
    await page.keyboard.type(character);
    expected += character;
    await new Promise((resolve) => setTimeout(resolve, delay));
    assert.equal(
      await input.evaluate((e) => document.activeElement === e),
      true,
      selector + " lost focus after " + expected.length + " characters",
    );
    assert.equal(
      await input.inputValue(),
      expected,
      selector + " dropped a keystroke",
    );
  }
};
