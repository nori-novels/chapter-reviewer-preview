import { render, screen } from "@testing-library/react";
import Page, { PreviewPage } from "./page";

it("renders the current preview fixture", () => {
  render(<Page />);

  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();
  expect(screen.getAllByText("Chapter 25")).not.toHaveLength(0);
});

it("renders a static alert when the fixture is unavailable", () => {
  render(<PreviewPage fixture={null} />);

  expect(screen.getByRole("alert")).toHaveTextContent("Preview unavailable");
  expect(
    screen.queryByRole("dialog"),
  ).not.toBeInTheDocument();
});
