const { assertTransition, canCancel } = require("../src/services/rideStateMachine");

describe("ride state machine", () => {
  test("REQUESTED -> MATCHED is allowed", () => {
    expect(() => assertTransition("REQUESTED", "MATCHED")).not.toThrow();
  });

  test("REQUESTED -> COMPLETED is rejected (must go through the full lifecycle)", () => {
    expect(() => assertTransition("REQUESTED", "COMPLETED")).toThrow(
      /Invalid ride state transition/
    );
  });

  test("COMPLETED is terminal — no further transitions", () => {
    expect(() => assertTransition("COMPLETED", "CANCELLED")).toThrow();
  });

  test("cancellation is only allowed while REQUESTED or MATCHED", () => {
    expect(canCancel("REQUESTED")).toBe(true);
    expect(canCancel("MATCHED")).toBe(true);
    expect(canCancel("DRIVER_ARRIVED")).toBe(false);
    expect(canCancel("STARTED")).toBe(false);
    expect(canCancel("COMPLETED")).toBe(false);
  });
});
