import type { SignaturePose } from "./types";

/**
 * Signature poses (owner, Nov 24): the poses every shoot gets, set up once in /admin → Shoots → Signature poses.
 * Limits keep a runaway script from filling the database (also enforced by lib/shoots/validation.ts).
 */
export const POSE_LIMITS = { poses: 40, photos: 8, nameLength: 80, steps: 20, stepLength: 200 } as const;

/** The pose's name as shown ("Untitled pose" until it has one). */
export const poseTitle = (pose: Pick<SignaturePose, "name">) => pose.name.trim() || "Untitled pose";
