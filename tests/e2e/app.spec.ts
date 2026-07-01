import { expect, test } from "@playwright/test";

test("runs the map editor simulator path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AGV Map Simulator")).toBeVisible();
  await expect(page.getByRole("button", { name: "Map", exact: true })).toBeVisible();
  await expect(page.getByText("Map Tools")).toBeVisible();
  await expect(page.getByText("Fleet Tracking")).toBeHidden();

  const initialNodes = await page.locator("circle.node").count();
  await page.getByTitle("Add node").click();
  await clickWorld(page, 2, 2);
  await expect(page.locator("circle.node")).toHaveCount(initialNodes + 1);
  await page.keyboard.press("Backspace");
  await expect(page.locator("circle.node")).toHaveCount(initialNodes);

  // Uploading a 2:1 image reshapes the finite floor to match the image's aspect ratio.
  const floorWidthBefore = await page.locator("rect.canvas-floor").getAttribute("width");
  const floorHeightBefore = await page.locator("rect.canvas-floor").getAttribute("height");
  expect(floorWidthBefore).toBe(floorHeightBefore);
  await page.locator('input[type="file"][accept*="image/svg+xml"]').setInputFiles({
    name: "plant.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="#eee"/><path d="M 1 5 H 19" stroke="#777"/></svg>`),
  });
  const backgroundImageEl = page.locator("image.background-image");
  await expect(backgroundImageEl).toHaveCount(1);
  await expect(backgroundImageEl).toHaveAttribute("x", "0");
  await expect(backgroundImageEl).toHaveAttribute("y", "0");
  await expect(backgroundImageEl).toHaveAttribute("width", String(floorWidthBefore));
  await expect(page.locator("rect.canvas-floor")).toHaveAttribute("width", String(floorWidthBefore));
  await expect(page.locator("rect.canvas-floor")).toHaveAttribute("height", String(Number(floorWidthBefore) / 2));
  await expect(page.locator(".background-scale-handle")).toHaveCount(0);
  await expect(page.getByTitle("Move and scale background")).toHaveCount(0);
  await page.locator(".range-field input").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "35";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(backgroundImageEl).toHaveAttribute("opacity", "0.35");

  await page.getByRole("button", { name: /Remove background/i }).click();
  await expect(backgroundImageEl).toHaveCount(0);
  await expect(page.locator("rect.canvas-floor")).toHaveAttribute("width", String(floorWidthBefore));
  await expect(page.locator("rect.canvas-floor")).toHaveAttribute("height", String(Number(floorWidthBefore) / 2));

  await page.getByTitle("Select and move nodes").click();
  await expect(page.locator(".floating-card")).toBeHidden();
  const viewBoxBeforeSelect = await page.locator("svg.map-svg").getAttribute("viewBox");
  await clickWorld(page, 2.5, 0.16);
  await expect(page.locator(".floating-card")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("Direction")).toBeVisible();
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeSelect);
  const edgeDirection = page.locator(".property-row").filter({ hasText: "Direction" }).locator("strong");
  expect(normalizeText(await edgeDirection.textContent())).toBe("dock-a -> corr-1");
  await page.getByRole("button", { name: "Make curve" }).click();
  await expect(page.locator("path.edge")).toHaveCount(1);
  await expect(page.locator("path.edge").first()).toHaveAttribute("d", / Q /);
  const curveHandle = page.locator(".curve-handle");
  await expect(curveHandle).toHaveCount(1);
  const curveHandleBox = await curveHandle.boundingBox();
  if (!curveHandleBox) throw new Error("Curve handle is not visible.");
  await page.mouse.move(curveHandleBox.x + curveHandleBox.width / 2, curveHandleBox.y + curveHandleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(curveHandleBox.x + curveHandleBox.width / 2, curveHandleBox.y + curveHandleBox.height / 2 - 32);
  await page.mouse.up();

  const viewBoxBeforeDeselect = await page.locator("svg.map-svg").getAttribute("viewBox");
  await clickWorld(page, 12, 9);
  await expect(page.locator(".floating-card")).toBeHidden();
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeDeselect);

  const beforeZoom = await page.locator("svg.map-svg").getAttribute("viewBox");
  await page.getByTitle("Zoom in").click();
  const afterZoom = await page.locator("svg.map-svg").getAttribute("viewBox");
  expect(afterZoom).not.toBe(beforeZoom);

  await page.getByRole("button", { name: "Routes", exact: true }).click();
  await expect(page.locator(".route-library-panel").getByRole("heading", { name: "Routes" })).toBeVisible();
  await expect(page.getByText("Map Tools")).toBeHidden();
  await expect(page.locator(".floating-card")).toBeHidden();

  const viewBoxBeforeCard = await page.locator("svg.map-svg").getAttribute("viewBox");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.locator(".floating-card")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("Route Editor")).toBeVisible();
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeCard);
  await expect(page.locator(".route-library-panel").locator(".agv-row").filter({ hasText: "SIM-001" })).toBeVisible({
    timeout: 15_000,
  });
  await clickWorld(page, 0, 0);
  await clickWorld(page, 5, 0);

  await expect(page.locator(".floating-card").getByText("dock-a -> corr-1")).toBeVisible();
  await page.getByRole("button", { name: /Save route/i }).click();
  const savedRow = page.locator(".route-row").filter({ hasText: "New Route" });
  await expect(savedRow).toBeVisible();
  // Saving keeps the route selected.
  await expect(page.locator(".floating-card")).toBeVisible();

  await savedRow.click();
  await expect(page.locator(".floating-card")).toBeHidden();
  await expect(page.locator(".route-row.selected")).toHaveCount(0);
  await savedRow.click();
  await expect(page.locator(".floating-card")).toBeVisible();

  const sendOrder = page.locator(".route-library-panel").getByRole("button", { name: /Send Route/i });
  await expect(sendOrder).toBeEnabled();
  const saveBeforeOrder = page.waitForResponse((response) =>
    response.url().endsWith("/api/maps") && response.request().method() === "POST"
  );
  const orderResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/orders") && response.request().method() === "POST"
  );
  await sendOrder.click();
  await saveBeforeOrder;
  const orderPayload = await (await orderResponse).json();
  expect(orderPayload.order.edges[0].trajectory.degree).toBe(2);

  // Closing the editor (X) also deselects the route.
  await page.locator(".floating-card").getByRole("button", { name: "Close editor" }).click();
  await expect(page.locator(".floating-card")).toBeHidden();
  await expect(page.locator(".route-row.selected")).toHaveCount(0);
  await expect(page.locator(".route-library-panel").getByRole("button", { name: /Send Route/i })).toBeHidden();

  await page.getByRole("button", { name: "Tracking", exact: true }).click();
  await expect(page.locator(".tracking-panel").getByRole("heading", { name: "Fleet Tracking" })).toBeVisible();
  await expect(page.getByText("Map Tools")).toBeHidden();
  await expect(page.locator(".floating-card")).toBeHidden();
  const trackingRow = page.locator(".tracking-panel").locator(".agv-row").filter({ hasText: "SIM-001" });
  await expect(trackingRow).toBeVisible({ timeout: 15_000 });

  const viewBoxBeforeTrack = await page.locator("svg.map-svg").getAttribute("viewBox");
  await trackingRow.click();
  await expect(page.locator(".floating-card")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("AGV Detail")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("Order status")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("New Route")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("completed")).toBeVisible({ timeout: 12_000 });
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeTrack);

  await page.locator(".floating-card").getByRole("button", { name: "Close editor" }).click();
  await expect(page.locator(".floating-card")).toBeHidden();
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeTrack);

  await trackingRow.click();
  await expect(page.locator(".floating-card")).toBeVisible();
  await trackingRow.click();
  await expect(page.locator(".floating-card")).toBeHidden();

  await page.reload();
  await expect(page.locator("path.edge").first()).toHaveAttribute("d", / Q /);
});

async function clickWorld(page: import("@playwright/test").Page, x: number, y: number) {
  const svg = page.locator("svg.map-svg");
  const point = await svg.evaluate((element, world) => {
    const svgElement = element as SVGSVGElement;
    const svgPoint = svgElement.createSVGPoint();
    svgPoint.x = world.x;
    svgPoint.y = world.y;
    const matrix = svgElement.getScreenCTM();
    if (!matrix) throw new Error("Map SVG has no screen transform.");
    const screenPoint = svgPoint.matrixTransform(matrix);
    return { x: screenPoint.x, y: screenPoint.y };
  }, { x, y });
  await page.mouse.click(point.x, point.y);
}

function normalizeText(value: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}
