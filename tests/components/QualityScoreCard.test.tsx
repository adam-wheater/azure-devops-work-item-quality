import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QualityScoreCard } from "@/components/QualityScoreCard";

describe("QualityScoreCard", () => {
  it("should render the score value", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 85,
        totalItems: 50,
        totalViolations: 3,
      })
    );
    const scoreEl = screen.getByTestId("quality-score");
    expect(scoreEl).toBeInTheDocument();
    expect(scoreEl.textContent).toContain("85");
  });

  it("should render with the success tone for score >= 80", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 95,
        totalItems: 100,
        totalViolations: 1,
      })
    );
    const scoreEl = screen.getByTestId("quality-score");
    expect(scoreEl).toHaveClass("ax-metric--success");
    expect(scoreEl.textContent).toContain("Good");
  });

  it("should render with the warning tone for score 60-79", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 65,
        totalItems: 100,
        totalViolations: 7,
      })
    );
    const scoreEl = screen.getByTestId("quality-score");
    expect(scoreEl).toHaveClass("ax-metric--warn");
    expect(scoreEl.textContent).toContain("Needs work");
  });

  it("should render with the danger tone for score < 60", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 30,
        totalItems: 100,
        totalViolations: 14,
      })
    );
    const scoreEl = screen.getByTestId("quality-score");
    expect(scoreEl).toHaveClass("ax-metric--danger");
    expect(scoreEl.textContent).toContain("Critical");
  });

  it("should display total items and violations", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 85,
        totalItems: 50,
        totalViolations: 3,
      })
    );
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Work Items")).toBeInTheDocument();
    expect(screen.getByText("Violations")).toBeInTheDocument();
  });

  it("should show upward trend arrow when score improved", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 90,
        previousScore: 80,
        totalItems: 50,
        totalViolations: 2,
      })
    );
    const scoreEl = screen.getByTestId("quality-score");
    expect(scoreEl.textContent).toContain("\u2191");
  });

  it("should show downward trend arrow when score decreased", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 70,
        previousScore: 85,
        totalItems: 50,
        totalViolations: 6,
      })
    );
    const scoreEl = screen.getByTestId("quality-score");
    expect(scoreEl.textContent).toContain("\u2193");
  });

  it("should show right arrow when score unchanged", () => {
    render(
      React.createElement(QualityScoreCard, {
        score: 85,
        previousScore: 85,
        totalItems: 50,
        totalViolations: 3,
      })
    );
    const scoreEl = screen.getByTestId("quality-score");
    expect(scoreEl.textContent).toContain("\u2192");
  });
});
