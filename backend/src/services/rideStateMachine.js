// Section 5 of the architecture guide. This table IS the spec: the backend
// rejects any transition that isn't an arrow on the state diagram.

const TRANSITIONS = {
  REQUESTED: ["MATCHED", "CANCELLED"],
  MATCHED: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["STARTED"],
  STARTED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

// Cancellation is only allowed while REQUESTED or MATCHED (Section 5).
const CANCELLABLE_STATUSES = new Set(["REQUESTED", "MATCHED"]);

function canTransition(fromStatus, toStatus) {
  return (TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function assertTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    const err = new Error(
      `Invalid ride state transition: ${fromStatus} -> ${toStatus}`
    );
    err.status = 409;
    throw err;
  }
}

function canCancel(status) {
  return CANCELLABLE_STATUSES.has(status);
}

module.exports = { TRANSITIONS, canTransition, assertTransition, canCancel };
