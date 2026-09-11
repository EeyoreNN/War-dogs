import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TabPanel, Tabs } from "./tabs";

function Harness() {
  const [value, setValue] = React.useState("requests");
  return (
    <>
      <Tabs
        aria-label="Panels"
        value={value}
        onChange={setValue}
        items={[
          { value: "requests", label: "Requests", badge: 2 },
          { value: "roster", label: "Roster" },
        ]}
      />
      <TabPanel value="requests" active={value}>
        Requests panel
      </TabPanel>
      <TabPanel value="roster" active={value}>
        Roster panel
      </TabPanel>
    </>
  );
}

describe("Tabs", () => {
  it("moves selection and focus with the arrow keys and wires the panels", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const [requests, roster] = screen.getAllByRole("tab");
    expect(requests).toHaveAttribute("aria-selected", "true");
    expect(roster).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Requests panel");

    await user.click(requests);
    await user.keyboard("{ArrowRight}");
    expect(roster).toHaveAttribute("aria-selected", "true");
    expect(roster).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Roster panel");
    expect(roster).toHaveAttribute("aria-controls", screen.getByRole("tabpanel").id);

    await user.keyboard("{ArrowRight}");
    expect(requests).toHaveAttribute("aria-selected", "true");
  });
});
