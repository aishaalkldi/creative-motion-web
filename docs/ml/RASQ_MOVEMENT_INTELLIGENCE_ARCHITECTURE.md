# RASQ Movement Intelligence Architecture

**Status:** Active architecture direction
**Scope:** RASQ movement analysis, ML development, patient baseline, and future personalization
**Current vertical slice:** Shoulder Abduction Reach + trunk compensation

## 1. Purpose

This document defines the shared technical direction for how RASQ uses the camera, MediaPipe/Pose, movement metrics, therapist labels, machine learning, and patient history.

The goal is to keep the team aligned on one architecture and avoid treating the camera, pose model, movement metrics, and RASQ ML model as the same thing.

## 2. Core Architecture

The overall direction — a target architecture, implemented in stages — is:

```text
Camera
  ↓
MediaPipe / Pose Landmarks
  ↓
RASQ Movement Features & Metrics
  ↓
Therapist Labels
  ↓
RASQ ML Model
  ↓
Patient Baseline / History
  ↓
Progress Tracking & Personalization
```

As of this writing, the pipeline is implemented through movement-feature extraction and per-repetition research capture, with skeleton-replay and therapist-labeling tooling in place. The labeled dataset is not yet complete, and the ML model, patient baseline, and personalization stages have not been built. See Section 6 (Current Vertical Slice) and Section 15 (Development Stages) for current status.

The camera is the sensor.
MediaPipe is the body-tracking layer.
RASQ is responsible for interpreting the tracked movement in a rehabilitation context.

## 3. Role of the Camera

The camera provides the live visual input needed for movement tracking.

The raw camera video is not the clinical output RASQ wants to keep.

For the normal patient flow, video should be processed in real time and discarded rather than stored as the main patient record.

The patient can be represented using a skeleton, avatar, or other neutral movement visualization.

## 4. Role of MediaPipe

MediaPipe/Pose identifies anatomical body landmarks such as:

* shoulders
* elbows
* wrists
* hips
* knees
* ankles

RASQ uses these landmarks as the measurement foundation.

MediaPipe answers:

Where are the body points?

It does not by itself answer the rehabilitation question:

What does this movement mean clinically or functionally?

That interpretation belongs to the RASQ movement layer.

## 5. RASQ Movement Layer

RASQ converts pose landmarks into useful movement features and metrics.

Depending on the exercise, these may include:

* joint-angle / ROM estimates
* hand position
* movement trajectory
* repetitions
* movement duration
* movement speed / tempo
* movement consistency
* side-to-side differences
* trunk compensation
* body alignment
* tracking / landmark quality
* movement-plane information where technically reliable

Not every metric is implemented for every exercise.

Metrics must be validated per movement before being treated as reliable clinical information.

## 6. Current Vertical Slice

The first end-to-end ML development slice is:

Shoulder Abduction Reach

Current focus:

* Shoulder Abduction tracking
* repetition detection
* shoulder-angle geometry
* wrist movement
* trunk compensation
* anatomical visual references
* therapist labeling
* ML research dataset preparation

Current development flow:

```text
Camera
  ↓
MediaPipe
  ↓
Shoulder / Elbow / Wrist / Hip Landmarks
  ↓
Movement Features
  ↓
Per-Repetition Capture
  ↓
Skeleton Replay
  ↓
Therapist Label
```

The next stage is:

```text
Labeled Repetitions
  ↓
RASQ ML Training
  ↓
Internal Validation
```

**Current status:**

Implemented:

* Camera / MediaPipe landmark tracking
* movement feature extraction
* Shoulder Abduction vertical slice
* per-repetition research capture
* skeleton replay
* anatomical visual guide
* therapist-blind labeling tooling

Not yet completed:

* a clean, fully labeled Dataset v1
* a trained RASQ ML model
* ML validation
* patient baseline / history personalization
* clinical validation of the ML model

## 7. Therapist Labels

The therapist provides the ground truth used for ML development.

For the current Shoulder Abduction slice, examples include:

```text
NO_COMPENSATION
MILD_COMPENSATION
CLEAR_COMPENSATION
```

Technical exclusions may include:

```text
WRONG_MOVEMENT_PLANE
INCOMPLETE_REPETITION
NOT_REVIEWABLE
```

The therapist is not directly "teaching the model" with each click.

The therapist is creating the labeled dataset that will later be used to train and evaluate the model.

## 8. RASQ ML Model

RASQ does not plan to train a separate model from scratch for every patient.

The first ML model should learn from movement examples collected across multiple participants and labeled by therapists.

Conceptually:

```text
Movement Features + Therapist Labels
                ↓
           RASQ ML Model
```

The initial model should solve a bounded rehabilitation problem.

Example:

```text
Shoulder Abduction movement
            ↓
Estimate trunk-compensation pattern
```

The first model is a general RASQ movement model for that task, not a patient-specific model.

## 9. Patient Baseline (Planned)

This is a planned capability for the current Shoulder Abduction Reach slice, not yet implemented. Patient baseline/history can be built directly from reliable movement metrics (Section 5) and does not require a trained RASQ ML model to exist first. The RASQ ML model is a separate input that, once available, adds interpretation and personalization on top of the baseline/history (Section 10) — it is not a prerequisite for creating the baseline itself. It is described here to keep the target architecture visible, not as a statement of current functionality.

A patient's early session can establish their personal baseline.

Examples may include:

* ROM / angle estimate
* movement speed
* repetitions
* duration
* compensation pattern
* trajectory
* consistency
* tracking quality

Future sessions can then be compared against that patient's previous performance.

Conceptually:

```text
Session 1
   ↓
Patient Baseline

Session 2
   ↓
Compare with Baseline

Session 3
   ↓
Compare with Patient History
```

This allows RASQ to answer questions such as:

* Is the movement range changing?
* Is movement becoming faster or slower?
* Is compensation increasing or decreasing?
* Is movement becoming more consistent?
* Is task performance changing over time?

These comparisons remain assistive information for therapist review.

## 10. Future Personalization

Personalization comes after the general movement model and reliable patient history exist.

The future architecture is:

```text
RASQ General Movement Model
            +
Patient Baseline / History
            ↓
Personalized Interpretation
```

Patient history may later help RASQ understand what is normal or meaningful for that specific patient.

This does not require training a completely separate ML model for every patient.

## 11. Data Strategy

RASQ should distinguish between different data layers.

### A. Raw Video

Normal patient/production direction:

```text
Process → Extract movement information → Discard
```

Raw video is not intended to be the primary stored movement record.

### B. Pose / Landmark Data

Landmarks are used to calculate movement features.

For normal production use, the goal is to persist the minimum information required for useful assessment and progress tracking.

For ML research/development, selected landmark sequences may temporarily be captured in a separate research-only pipeline to build and validate datasets.

Research capture and production persistence must remain separate.

### C. Derived Movement Metrics

These are the main useful outputs for patient progress tracking.

Examples:

```text
ROM estimate
Joint-angle estimate
Reps
Duration
Speed
Trajectory
Compensation
Consistency
Tracking Quality
```

### D. Therapist Labels

Therapist labels are stored separately from algorithmic movement features during dataset development.

This preserves independent clinical review and allows objective ML evaluation.

### E. ML Predictions

ML predictions should remain distinguishable from therapist labels and raw movement measurements.

The model must not overwrite the therapist's judgment.

## 12. Privacy Principle

The desired production pattern is:

```text
Camera
  ↓
Real-Time Processing
  ↓
Pose / Movement Calculation
  ↓
Derived Metrics
  ↓
Clinician Review
```

not:

```text
Camera
  ↓
Upload and permanently store patient video
```

Research/development datasets must remain explicitly separated from normal production patient records.

## 13. 2D and 3D Direction

Current movement processing has used 2D landmark information only — depth/world-landmark data is not currently captured or persisted anywhere in the pipeline.

For future research capture, RASQ should evaluate preserving MediaPipe depth/world-landmark information when it improves a defined problem such as:

* distinguishing Shoulder Abduction from Shoulder Flexion
* body-orientation estimation
* movement-plane analysis
* rotation analysis

This should be treated as a research/data improvement, not as automatic true anatomical 3D measurement.

A single RGB camera still has limitations.

## 14. Clinical Boundary

RASQ movement intelligence is designed to support therapist review.

It must not be described as:

* autonomous diagnosis
* automatic treatment prescription
* independent clinical scoring
* replacement for therapist judgment

The intended relationship is:

```text
RASQ measures / organizes / estimates
               ↓
Therapist reviews and decides
```

## 15. Development Stages

### Stage 1 — Movement Foundation (complete for the current Shoulder Abduction slice)

```text
Camera
→ MediaPipe
→ landmarks
→ movement metrics/features
```

### Stage 2 — Dataset Foundation (in progress — capture, replay, and labeling tooling built; dataset not yet fully labeled)

```text
Movement capture
→ replay
→ therapist labels
→ clean labeled dataset
```

### Stage 3 — RASQ ML v0.1

```text
Features + labels
→ baseline ML model
→ participant-level validation
```

### Stage 4 — Expanded Dataset

```text
Multiple healthy volunteers
→ controlled movement variations
→ therapist labels
→ model refinement
```

Healthy-volunteer simulated compensation is technical development data and must not be treated as proof of performance in neurological patients.

### Stage 5 — Clinical Pilot

```text
Appropriately approved patient pilot
→ real patient movement
→ therapist assessment
→ model comparison in shadow/advisory mode
```

### Stage 6 — Personalization

```text
Validated movement model
+
patient baseline
+
longitudinal history
→ personalized progress context
```

## 16. What We Are Not Building

RASQ is not currently trying to:

* replace MediaPipe with a new pose-estimation model
* train one model from scratch for every patient
* store all patient video
* build one giant ML model for every rehabilitation movement
* make autonomous treatment decisions
* train deep learning before obtaining reliable labeled data

The strategy is to build bounded movement capabilities one vertical slice at a time.

## 17. Current Team Direction

For the current vertical slice:

```text
Camera
→ MediaPipe
→ movement data
→ therapist labels
→ RASQ ML model
```

After that foundation is reliable:

```text
RASQ ML model
+
patient baseline / history
→ progress tracking
→ future personalization
```

This is the current shared architecture direction for RASQ Movement Intelligence.

## 18. One-Sentence Summary

MediaPipe sees the body; RASQ measures and learns how to interpret rehabilitation movement, while the therapist remains responsible for the clinical decision.
