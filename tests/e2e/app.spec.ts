import { expect, test } from "@playwright/test";

test("runs the map editor simulator path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AGV Map Simulator")).toBeVisible();
  await expect(page.getByTitle("Node")).toBeVisible();

  await expect(page.locator(".agv-row").filter({ hasText: "SIM-001" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTitle("Route").click();
  await clickWorld(page, 0, 0);
  await clickWorld(page, 5, 0);

  await expect(page.getByText("dock-a -> corr-1")).toBeVisible();
  const sendOrder = page.getByRole("button", { name: /Send Order/i });
  await expect(sendOrder).toBeEnabled();
  await sendOrder.click();

  await expect(page.getByText(/SIM-001 order .*: completed/)).toBeVisible({ timeout: 12_000 });
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
