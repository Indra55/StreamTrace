import { expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VolunteerOutreach } from "./VolunteerOutreach.tsx";

test("recommended site volunteers render and Resend updates the mock status and time", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<VolunteerOutreach sites={[{ code: "001" }, { code: "009" }]} recommendedSite="009"/>);
  expect((screen.getByRole("combobox", { name: "Observation site" }) as HTMLSelectElement).value).toBe("009");
  expect(screen.getByText("4 volunteers, 3 messaged, 2 replied")).toBeTruthy();
  const list = screen.getByRole("list", { name: "Fictional volunteers at site 009" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  const failed = within(list).getByText("Fabio Z.").closest("li")!;
  const oldTime = failed.querySelector("time")!.dateTime;
  expect(within(failed).getByText("Failed")).toBeTruthy();
  const user = userEvent.setup(); await user.click(within(failed).getByRole("button", { name: /Resend/ }));
  expect(within(failed).getByText("Delivered")).toBeTruthy();
  expect(failed.querySelector("time")!.dateTime).not.toBe(oldTime);
  expect(screen.getByRole("status").textContent).toBe("Resent (simulated)");
  expect(screen.getByText("4 volunteers, 4 messaged, 2 replied")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Resend to Carla W. (simulated)" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
