// Section 4 of the PRD: "Keep geography simple" — a predefined list of Dhaka
// areas, no real map routing. This is the single source of truth both the
// matching engine and the fare engine read from.

const ZONES = [
  "Banani",
  "Gulshan 1",
  "Gulshan 2",
  "Mohakhali",
  "Dhanmondi",
  "Mirpur",
  "Uttara",
  "Farmgate",
  "Bashundhara",
];

// Documented matching rule (Section 6 of the architecture guide):
// two destinations are "compatible" if they're roughly the same direction
// from a shared pickup zone. This is intentionally a hand-maintained table,
// not real routing — the brief explicitly says that's fine.
//
// Applied to the story: Banani -> Mohakhali and Banani -> Gulshan 1 are
// compatible (same general east/south direction out of Banani). Banani ->
// Mirpur is a very different direction, so it is deliberately NOT listed.
const COMPATIBLE_DESTINATIONS = {
  Banani: ["Mohakhali", "Gulshan 1", "Gulshan 2"],
  "Gulshan 1": ["Banani", "Gulshan 2", "Mohakhali"],
  "Gulshan 2": ["Banani", "Gulshan 1", "Bashundhara"],
  Mohakhali: ["Banani", "Farmgate"],
  Dhanmondi: ["Farmgate", "Mohakhali"],
  Mirpur: ["Uttara"],
  Uttara: ["Mirpur"],
  Farmgate: ["Dhanmondi", "Mohakhali"],
  Bashundhara: ["Gulshan 2"],
};

/**
 * Two destinations are compatible enough to pool if they're the same zone,
 * or appear on each other's compatible-destination list.
 */
function destinationsCompatible(destA, destB) {
  if (destA === destB) return true;
  const listForA = COMPATIBLE_DESTINATIONS[destA] || [];
  return listForA.includes(destB);
}

module.exports = { ZONES, COMPATIBLE_DESTINATIONS, destinationsCompatible };
