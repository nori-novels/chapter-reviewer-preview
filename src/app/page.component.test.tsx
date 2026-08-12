import { render, screen } from "@testing-library/react";
import Page, { PreviewPage } from "./page";

it("renders the current preview fixture", () => {
  render(<Page />);

  expect(screen.getByText("Chapter reviewer preview")).toBeInTheDocument();
  expect(screen.getByText("Obsessed - Chapter 25")).toBeInTheDocument();
});

it("renders a static alert when the fixture is unavailable", () => {
  render(<PreviewPage fixture={null} />);

  expect(screen.getByRole("alert")).toHaveTextContent("Preview unavailable");
  expect(
    screen.queryByText("Chapter reviewer preview"),
  ).not.toBeInTheDocument();
});
