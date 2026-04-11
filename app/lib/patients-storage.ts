export type StoredPatient = {
    id: string;
    fullName: string;
    phone: string;
    age: string;
    gender: string;
    diagnosis: string;
    notes: string;
    initialAssessment: string;
    status: string;
    createdAt: string;
  };
  
  const STORAGE_KEY = "creative_motion_patients";
  
  export function getStoredPatients(): StoredPatient[] {
    if (typeof window === "undefined") return [];
  
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
  
    try {
      return JSON.parse(raw) as StoredPatient[];
    } catch {
      return [];
    }
  }
  
  export function savePatientToStorage(patient: StoredPatient) {
    if (typeof window === "undefined") return;
  
    const patients = getStoredPatients();
    const existingIndex = patients.findIndex((p) => p.id === patient.id);
  
    if (existingIndex !== -1) {
      patients[existingIndex] = patient;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
      return;
    }
  
    const updated = [patient, ...patients];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }