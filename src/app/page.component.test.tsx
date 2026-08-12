import { render, screen } from "@testing-library/react";
import Page from "./page";

it("renders the chapter reviewer preview entry point", () => {
  render(<Page />);
  expect(screen.getByText("Chapter reviewer preview")).toBeInTheDocument();
});
