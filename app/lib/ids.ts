export function createPatientId() {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PT-${random}`;
  }