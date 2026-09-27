// Section 7 of the PRD: passengerFare = baseFare + distanceCharge - poolDiscount
// Everything is stored/computed in integer PAISA (1 taka = 100 paisa) to avoid
// float rounding bugs. Convert to taka only when displaying to the user.

const BASE_FARE_PAISA = 5000; // ৳50
const POOL_DISCOUNT_PAISA = 2000; // ৳20, applied only when the ride is pooled (2+ members)

// Zone-based flat distance charges, keyed by destination zone. In a real
// system this would come from a distance/zone matrix; for the MVP a flat
// per-zone lookup is enough and is easy to hand-verify.
const DISTANCE_CHARGE_PAISA = {
  Mohakhali: 8000, // ৳80
  "Gulshan 1": 6500, // ৳65
  "Gulshan 2": 7000,
  Banani: 4000,
  Dhanmondi: 9000,
  Mirpur: 11000,
  Uttara: 12000,
  Farmgate: 7500,
  Bashundhara: 8500,
};

const DEFAULT_DISTANCE_CHARGE_PAISA = 7000;

/**
 * Computes one passenger's individual fare in paisa.
 * @param {string} destinationZone
 * @param {boolean} isPooled - true if this ride shares a pool with >=1 other passenger
 */
function calculateFarePaisa(destinationZone, isPooled) {
  const distanceCharge =
    DISTANCE_CHARGE_PAISA[destinationZone] ?? DEFAULT_DISTANCE_CHARGE_PAISA;
  const poolDiscount = isPooled ? POOL_DISCOUNT_PAISA : 0;
  return BASE_FARE_PAISA + distanceCharge - poolDiscount;
}

function paisaToDisplay(paisa) {
  return `৳${(paisa / 100).toFixed(2)}`;
}

module.exports = {
  BASE_FARE_PAISA,
  POOL_DISCOUNT_PAISA,
  DISTANCE_CHARGE_PAISA,
  calculateFarePaisa,
  paisaToDisplay,
};
