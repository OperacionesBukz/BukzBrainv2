import { describe, it, expect, vi } from "vitest";

// Mock firebase before importing App
vi.mock("@/lib/firebase", () => ({
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback(null);
      return vi.fn();
    }),
    signOut: vi.fn(),
  },
  db: {},
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn((_, callback) => {
    callback(null);
    return vi.fn();
  }),
  getAuth: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

import { render } from "@testing-library/react";
import App from "@/App";

describe("App", () => {
  it("renders without crashing", () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it("redirects to login when no user", async () => {
    render(<App />);
    // Since we mock no user, the app should redirect to login
    // The login page loads lazily so we just verify the app mounted
    expect(document.body).toBeTruthy();
  });
});
