await page.locator("#email").fill("anand@example.com");
await page.getByRole("button", { name: "Login" }).click();
