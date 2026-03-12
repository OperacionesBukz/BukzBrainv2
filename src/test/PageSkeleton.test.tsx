import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageSkeleton } from "@/components/PageSkeleton";

describe("PageSkeleton", () => {
  it("renders default variant without crashing", () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstChild).toBeTruthy();
    // Default variant should have skeleton blocks
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders cards variant", () => {
    const { container } = render(<PageSkeleton variant="cards" />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders table variant", () => {
    const { container } = render(<PageSkeleton variant="table" />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("accepts custom className", () => {
    const { container } = render(<PageSkeleton className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
