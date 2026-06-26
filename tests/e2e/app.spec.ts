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

  await page.locator('input[type="file"][accept*="image/svg+xml"]').setInputFiles({
    name: "plant.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="#eee"/><path d="M 1 5 H 19" stroke="#777"/></svg>`),
  });
  await expect(page.locator("image.background-image")).toHaveCount(1);
  await page.locator(".range-field input").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "35";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByTitle("Move and scale background").click();
  const beforeMove = await page.locator("image.background-image").getAttribute("x");
  await dragWorld(page, -1, 1, -0.5, 1.5);
  await expect.poll(() => page.locator("image.background-image").getAttribute("x")).not.toBe(beforeMove);
  const handle = page.locator(".background-scale-handle");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Background scale handle is not visible.");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 24, handleBox.y + handleBox.height / 2 + 24);
  await page.mouse.up();
  await page.getByRole("button", { name: /Lock background/i }).click();

  await page.getByTitle("Select and move nodes").click();
  // Nothing selected yet: the right-edge floating card stays collapsed.
  await expect(page.locator(".floating-card")).toBeHidden();
  const viewBoxBeforeSelect = await page.locator("svg.map-svg").getAttribute("viewBox");
  await clickWorld(page, 2.5, 0.16);
  // Selecting an edge mounts the floating card with its detail, and the map does not rescale.
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

  // Deselecting collapses the floating card and still does not rescale the map.
  const viewBoxBeforeDeselect = await page.locator("svg.map-svg").getAttribute("viewBox");
  await clickWorld(page, 12, 9);
  await expect(page.locator(".floating-card")).toBeHidden();
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeDeselect);

  const beforeZoom = await page.locator("svg.map-svg").getAttribute("viewBox");
  await page.getByTitle("Zoom in").click();
  const afterZoom = await page.locator("svg.map-svg").getAttribute("viewBox");
  expect(afterZoom).not.toBe(beforeZoom);

  await page.getByRole("button", { name: "Routes", exact: true }).click();
  // Left column shows the (empty) routes list; the right editor card stays collapsed until a
  // route is selected or a new draft is started.
  await expect(page.locator(".route-library-panel").getByRole("heading", { name: "Routes" })).toBeVisible();
  await expect(page.getByText("Map Tools")).toBeHidden();
  await expect(page.locator(".floating-card")).toBeHidden();

  // Starting a new draft floats the editor on the right; Assign-AGV + Send live in the
  // left actions panel. The map stays centered.
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
  // The saved route stays selected, so the editor card remains open.
  await expect(page.locator(".floating-card")).toBeVisible();

  // Tapping the already-selected route toggles it off; tapping again re-opens it.
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

  // Closing the editor (X) deselects the route: the card collapses and the actions go away.
  await page.locator(".floating-card").getByRole("button", { name: "Close editor" }).click();
  await expect(page.locator(".floating-card")).toBeHidden();
  await expect(page.locator(".route-row.selected")).toHaveCount(0);
  await expect(page.locator(".route-library-panel").getByRole("button", { name: /Send Route/i })).toBeHidden();

  await page.getByRole("button", { name: "Tracking", exact: true }).click();
  // Left column shows the AGV browse-list; the right detail card stays collapsed until an
  // AGV is selected.
  await expect(page.locator(".tracking-panel").getByRole("heading", { name: "Fleet Tracking" })).toBeVisible();
  await expect(page.getByText("Map Tools")).toBeHidden();
  await expect(page.locator(".floating-card")).toBeHidden();
  const trackingRow = page.locator(".tracking-panel").locator(".agv-row").filter({ hasText: "SIM-001" });
  await expect(trackingRow).toBeVisible({ timeout: 15_000 });

  // Selecting an AGV floats its detail on the right; the map does not rescale.
  const viewBoxBeforeTrack = await page.locator("svg.map-svg").getAttribute("viewBox");
  await trackingRow.click();
  await expect(page.locator(".floating-card")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("AGV Detail")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("Order status")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("New Route")).toBeVisible();
  await expect(page.locator(".floating-card").getByText("completed")).toBeVisible({ timeout: 12_000 });
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeTrack);

  // Closing the detail (X) collapses the card; the map still does not rescale.
  await page.locator(".floating-card").getByRole("button", { name: "Close editor" }).click();
  await expect(page.locator(".floating-card")).toBeHidden();
  expect(await page.locator("svg.map-svg").getAttribute("viewBox")).toBe(viewBoxBeforeTrack);

  // Tapping the same AGV re-opens it; tapping it again toggles the selection back off.
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

async function dragWorld(page: import("@playwright/test").Page, fromX: number, fromY: number, toX: number, toY: number) {
  const from = await worldToScreen(page, fromX, fromY);
  const to = await worldToScreen(page, toX, toY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

async function worldToScreen(page: import("@playwright/test").Page, x: number, y: number) {
  const svg = page.locator("svg.map-svg");
  return svg.evaluate((element, world) => {
    const svgElement = element as SVGSVGElement;
    const svgPoint = svgElement.createSVGPoint();
    svgPoint.x = world.x;
    svgPoint.y = world.y;
    const matrix = svgElement.getScreenCTM();
    if (!matrix) throw new Error("Map SVG has no screen transform.");
    const screenPoint = svgPoint.matrixTransform(matrix);
    return { x: screenPoint.x, y: screenPoint.y };
  }, { x, y });
}

function normalizeText(value: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}
