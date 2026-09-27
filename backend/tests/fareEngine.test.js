const { calculateFarePaisa } = require("../src/services/fareEngine");

describe("fare engine — Section 7 worked example", () => {
  test("Nusrat (Banani -> Mohakhali, pooled): 50 + 80 - 20 = 110 taka", () => {
    const paisa = calculateFarePaisa("Mohakhali", true);
    expect(paisa).toBe(11000); // ৳110.00
  });

  test("Rafiq (Banani -> Gulshan 1, pooled): 50 + 65 - 20 = 95 taka", () => {
    const paisa = calculateFarePaisa("Gulshan 1", true);
    expect(paisa).toBe(9500); // ৳95.00
  });

  test("solo ride gets no pool discount", () => {
    const pooled = calculateFarePaisa("Mohakhali", true);
    const solo = calculateFarePaisa("Mohakhali", false);
    expect(solo).toBe(pooled + 2000);
  });
});
