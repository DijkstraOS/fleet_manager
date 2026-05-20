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

  const beforeZoom = await page.locator("svg.map-svg").getAttribute("viewBox");
  await page.getByTitle("Zoom in").click();
  const afterZoom = await page.locator("svg.map-svg").getAttribute("viewBox");
  expect(afterZoom).not.toBe(beforeZoom);

  await page.getByRole("button", { name: "Routes", exact: true }).click();
  await expect(page.getByText("Route Editor")).toBeVisible();
  await expect(page.getByText("Map Tools")).toBeHidden();
  await expect(page.locator(".agv-row").filter({ hasText: "SIM-001" })).toBeVisible({
    timeout: 15_000,
  });
  await clickWorld(page, 0, 0);
  await clickWorld(page, 5, 0);

  await expect(page.getByText("dock-a -> corr-1")).toBeVisible();
  await page.getByRole("button", { name: /Save route/i }).click();
  await expect(page.locator(".route-row").filter({ hasText: "New Route" })).toBeVisible();

  const sendOrder = page.getByRole("button", { name: /Send Route/i });
  await expect(sendOrder).toBeEnabled();
  await sendOrder.click();

  await page.getByRole("button", { name: "Tracking", exact: true }).click();
  await expect(page.getByText("Fleet Tracking")).toBeVisible();
  await expect(page.getByText("New Route")).toBeVisible();
  await expect(page.getByText("completed")).toBeVisible({ timeout: 12_000 });
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
