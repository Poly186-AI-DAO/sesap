import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import Navbar from "../../components/Navbar";

const renderNavbar = (initialEntry = "/") => {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Navbar />
    </MemoryRouter>
  );
};

describe("Navbar", () => {
  it("renders the SESAP title", () => {
    renderNavbar();
    expect(screen.getByRole("link", { name: /sesap playground/i })).toBeInTheDocument();
  });

  it("shows a back link when not on the home route", () => {
    renderNavbar("/other");
    expect(screen.getByRole("link", { name: /back to editor/i })).toBeInTheDocument();
  });
});
