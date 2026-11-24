"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import styles from "@/features/admin/Admin.module.css";
import { preparePhoto } from "@/lib/admin/client";
import { cn } from "@/lib/cn";
import { linesOf } from "@/lib/shoots/lists";
import { POSE_LIMITS, poseTitle } from "@/lib/shoots/poses";
import { shootsApi, ShootsApiError } from "@/lib/shoots/client";
import type { SignaturePhoto, SignaturePose } from "@/lib/shoots/types";
import InspoLightbox, { type LightboxPhoto } from "./InspoLightbox";
import NotReady from "./NotReady";
import { posePhotos } from "./PoseGrid";
import ShootsTabs from "./ShootsTabs";
import { saveText, useAutosave, type SaveState } from "./useAutosave";
import { useAutoHeight } from "./useAutoHeight";
import { useTwoTap } from "./useTwoTap";
import css from "./Shoots.module.css";

/** A change to one pose's photos (applied to the newest list, so uploads one after another all stay). */
type PhotosUpdate = (photos: SignaturePhoto[]) => SignaturePhoto[];

/**
 * /admin/shoots/poses: the signature poses every shoot gets (owner, Nov 24). Each pose: its name, the photos to
 * follow (the first is shown on the shoot list) and how to set it up, one step per line. Text saves by itself.
 */
export default function SignaturePoses() {
  const [poses, setPoses] = useState<SignaturePose[] | null>(null);
  const [error, setError] = useState<ShootsApiError | null>(null);
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ photos: LightboxPhoto[]; index: number } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    shootsApi
      .poses()
      .then(setPoses)
      .catch((e: ShootsApiError) => setError(e));
  }, []);

  const onState = useCallback((id: string, state: SaveState) => setStates((s) => (s[id]?.kind === state.kind ? s : { ...s, [id]: state })), []);
  const onPhotos = useCallback((id: string, update: PhotosUpdate) => setPoses((list) => (list ?? []).map((p) => (p.id === id ? { ...p, photos: update(p.photos) } : p))), []);
  const view = useCallback((pose: SignaturePose, photoId: string) => {
    const photos = posePhotos([pose]);
    setViewing({ photos, index: Math.max(0, photos.findIndex((p) => p.id === photoId)) });
  }, []);

  const add = async () => {
    setAdding(true);
    setNote(null);
    try {
      const pose = await shootsApi.addPose();
      setPoses((s) => [...(s ?? []), pose]);
      setFocusId(pose.id);
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const removed = (id: string) => {
    setPoses((s) => (s ?? []).filter((x) => x.id !== id));
    setStates(({ [id]: _gone, ...rest }) => rest);
    setNote("Pose removed.");
    addRef.current?.focus();
  };

  const move = async (id: string, step: -1 | 1) => {
    if (!poses) return;
    const from = poses.findIndex((p) => p.id === id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= poses.length) return;
    const before = poses;
    const next = [...poses];
    [next[from], next[to]] = [next[to], next[from]];
    setPoses(next);
    setMoving(true);
    setNote(null);
    try {
      await shootsApi.orderPoses(next.map((p) => p.id));
      setNote(`Moved ${poseTitle(next[to])} ${step < 0 ? "up" : "down"}.`);
    } catch (err) {
      setPoses(before);
      setNote((err as Error).message);
    } finally {
      setMoving(false);
    }
  };

  // one line for the whole page, the most urgent first
  const all = Object.values(states);
  const pageState: SaveState =
    all.find((s) => s.kind === "error") ??
    all.find((s) => s.kind === "retrying") ??
    all.find((s) => s.kind === "saving") ??
    all.find((s) => s.kind === "saved") ?? { kind: "idle" };

  return (
    <div>
      <div className={css.top}>
        <p className={cn(styles.muted, "chalk-soft")}>
          The poses you do at every shoot, in this order. Add the photos to follow and how to set it up. Every shoot folder
          lists them, and on the day sheet you tick each one off for each family.
        </p>
      </div>
      <ShootsTabs current="poses" />

      {error?.notReady ? (
        <NotReady />
      ) : error ? (
        <p className={cn(styles.error, "chalk-soft")} role="alert">{error.message}</p>
      ) : !poses ? (
        <p className={cn(styles.hintSmall, "chalk-soft")} role="status">Loading…</p>
      ) : (
        <>
          {poses.length === 0 ? (
            <p className={cn(styles.muted, css.posesEmpty, "chalk-soft")}>No signature poses yet. Add your first one.</p>
          ) : (
            <ol className={css.poses}>
              {poses.map((p, i) => (
                <PoseCard
                  key={p.id}
                  pose={p}
                  n={i + 1}
                  focus={focusId === p.id}
                  canUp={i > 0 && !moving}
                  canDown={i < poses.length - 1 && !moving}
                  onMove={(step) => void move(p.id, step)}
                  onState={onState}
                  onPhotos={onPhotos}
                  onView={view}
                  onRemoved={removed}
                />
              ))}
            </ol>
          )}
          <div className={css.addRow}>
            {poses.length >= POSE_LIMITS.poses ? (
              <p className={cn(styles.hintSmall, "chalk-soft")}>That&apos;s the most poses ({POSE_LIMITS.poses}).</p>
            ) : (
              <button ref={addRef} type="button" className={cn(styles.addButton, css.addReset)} onClick={add} disabled={adding}>
                {adding ? "Adding…" : "+ Add a pose"}
              </button>
            )}
          </div>
          <p className={cn(css.saved, pageState.kind === "error" ? css.savedError : "", "chalk-soft")} role="status">
            {note ?? saveText(pageState)}
          </p>
        </>
      )}

      {viewing && (
        <InspoLightbox photos={viewing.photos} index={viewing.index} onIndex={(index) => setViewing((v) => (v ? { ...v, index } : v))} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function PoseCard({
  pose,
  n,
  focus,
  canUp,
  canDown,
  onMove,
  onState,
  onPhotos,
  onView,
  onRemoved,
}: {
  pose: SignaturePose;
  n: number;
  focus: boolean;
  canUp: boolean;
  canDown: boolean;
  onMove: (step: -1 | 1) => void;
  onState: (id: string, state: SaveState) => void;
  onPhotos: (id: string, update: PhotosUpdate) => void;
  onView: (pose: SignaturePose, photoId: string) => void;
  onRemoved: (id: string) => void;
}) {
  const [name, setName] = useState(pose.name);
  const [steps, setSteps] = useState(pose.steps.join("\n"));
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const stepsRef = useAutoHeight(steps);
  const twoTap = useTwoTap();
  const save = useCallback(async (value: { name: string; steps: string }) => {
    await shootsApi.savePose(pose.id, value);
  }, [pose.id]);
  const autosave = useAutosave(save);
  const title = name.trim() || `Pose ${n}`;

  useEffect(() => {
    onState(pose.id, autosave.state);
  }, [autosave.state, onState, pose.id]);

  useEffect(() => {
    if (focus) nameRef.current?.focus();
  }, [focus]);

  const change = (next: { name?: string; steps?: string }) => {
    const value = { name: next.name ?? name, steps: next.steps ?? steps };
    if (next.name !== undefined) setName(next.name);
    if (next.steps !== undefined) setSteps(next.steps);
    autosave.queue(value);
  };

  const remove = () =>
    twoTap.tap(async () => {
      autosave.cancel();
      setRemoving(true);
      setRemoveError(null);
      try {
        await shootsApi.removePose(pose.id);
        onRemoved(pose.id);
      } catch (err) {
        setRemoveError((err as Error).message);
        setRemoving(false);
        twoTap.reset();
      }
    });

  return (
    <li className={css.card} aria-label={title}>
      <div className={css.poseEdit}>
        <p className={cn(css.poseNum, "chalk-soft")} aria-hidden="true">Pose {n}</p>
        <div className={css.field}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor={`pn-${pose.id}`}>Pose name</label>
          <input
            ref={nameRef}
            id={`pn-${pose.id}`}
            className={styles.input}
            value={name}
            maxLength={POSE_LIMITS.nameLength}
            placeholder="e.g. Chin on hands"
            onChange={(e) => change({ name: e.target.value })}
            onBlur={() => void autosave.flush()}
          />
        </div>
        {/* the viewer's caption: the name and steps as typed so far */}
        <PosePhotosField pose={{ ...pose, name, steps: linesOf(steps) }} title={title} onPhotos={onPhotos} onView={onView} />
        <div className={css.field}>
          <label className={cn(styles.label, "chalk-soft")} htmlFor={`ps-${pose.id}`}>How to set it up</label>
          <textarea
            ref={stepsRef}
            id={`ps-${pose.id}`}
            className={cn(styles.input, css.items)}
            rows={Math.max(3, steps.split("\n").length + 1)}
            value={steps}
            aria-describedby={`psh-${pose.id}`}
            onChange={(e) => change({ steps: e.target.value })}
            onBlur={() => void autosave.flush()}
          />
          <p id={`psh-${pose.id}`} className={cn(styles.hintSmall, "chalk-soft")}>One step per line: where each pillow goes, how baby lies, what to watch for.</p>
        </div>
        <div className={css.sectionFoot}>
          <span className={css.moveRow}>
            <button type="button" className={styles.smallButton} onClick={() => onMove(-1)} disabled={!canUp}>
              Move up<span className={styles.visuallyHidden}> ({title})</span>
            </button>
            <button type="button" className={styles.smallButton} onClick={() => onMove(1)} disabled={!canDown}>
              Move down<span className={styles.visuallyHidden}> ({title})</span>
            </button>
          </span>
          <button type="button" className={cn(styles.linkButton, "chalk-soft")} onClick={remove} disabled={removing}>
            {removing ? "Removing…" : twoTap.confirming ? "Tap again to remove it and its photos" : "Remove this pose"}
            <span className={styles.visuallyHidden}> ({title})</span>
          </button>
        </div>
        {removeError && <p className={cn(styles.error, "chalk-soft")} role="alert">{removeError}</p>}
      </div>
    </li>
  );
}

/** The pose's photos: tap one to see it big, "Remove" (two taps), and "+ Add photos" (tap or drop, several at once). */
function PosePhotosField({
  pose,
  title,
  onPhotos,
  onView,
}: {
  pose: SignaturePose;
  title: string;
  onPhotos: (id: string, update: PhotosUpdate) => void;
  onView: (pose: SignaturePose, photoId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const room = POSE_LIMITS.photos - pose.photos.length;
  const hintId = `pph-${pose.id}`;

  const addFiles = async (list: FileList | File[]) => {
    const pictures = [...list].filter((f) => f.type.startsWith("image/"));
    if (!pictures.length) {
      setMessage({ text: "Those weren't photos.", error: true });
      return;
    }
    const taken = pictures.slice(0, Math.max(0, room));
    const left = pictures.length - taken.length;
    setBusy(true);
    let added = 0;
    const failed: string[] = [];
    for (const [i, file] of taken.entries()) {
      setMessage({ text: `Uploading ${i + 1} of ${taken.length}…`, error: false });
      try {
        const photo = await shootsApi.uploadPosePhoto(pose.id, await preparePhoto(file));
        onPhotos(pose.id, (list) => [...list, photo]);
        added += 1;
      } catch (err) {
        failed.push(`${file.name || "a photo"}: ${(err as Error).message}`);
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    const parts = [
      added ? `${added} ${added === 1 ? "photo" : "photos"} added.` : "",
      left ? `${left} not added: a pose can have ${POSE_LIMITS.photos} photos.` : "",
      failed.length ? `Not added: ${failed.join("; ")}` : "",
    ].filter(Boolean);
    setMessage({ text: parts.join(" "), error: added === 0 });
  };

  const drop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    if (!busy && e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div className={css.field}>
      <p className={cn(styles.label, "chalk-soft")} id={`ppl-${pose.id}`}>Photos to follow</p>
      <ul className={css.posePhotos} aria-labelledby={`ppl-${pose.id}`}>
        {pose.photos.map((photo, i) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            first={i === 0}
            label={`photo ${i + 1} of ${title}`}
            onOpen={() => onView(pose, photo.id)}
            onRemove={async () => {
              await shootsApi.removePosePhoto(pose.id, photo.id);
              onPhotos(pose.id, (list) => list.filter((x) => x.id !== photo.id));
              setMessage({ text: "Photo removed.", error: false });
            }}
          />
        ))}
        {room > 0 && (
          <li>
            <label
              className={cn(css.addPhoto, over ? css.dropZoneOver : "")}
              onDragEnter={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setOver(false)}
              onDrop={drop}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className={styles.visuallyHidden}
                disabled={busy}
                aria-describedby={hintId}
                onChange={(e) => e.target.files && void addFiles(e.target.files)}
              />
              <span className={css.dropBig}>{busy ? "Uploading…" : "+ Add photos"}</span>
              <span className={cn(css.dropSmall, "chalk-soft")}>tap, or drop them here</span>
              <span className={styles.visuallyHidden}> for {title}</span>
            </label>
          </li>
        )}
      </ul>
      <p id={hintId} className={cn(styles.hintSmall, "chalk-soft")}>
        The first photo is the one on the shoot list. Add one of the setup too, if it helps (up to {POSE_LIMITS.photos}).
      </p>
      <p className={cn(css.formMsg, message?.error ? css.formError : "", "chalk-soft")} role="status">{message?.text ?? ""}</p>
    </div>
  );
}

function PhotoTile({ photo, first, label, onOpen, onRemove }: { photo: SignaturePhoto; first: boolean; label: string; onOpen: () => void; onRemove: () => Promise<void> }) {
  const twoTap = useTwoTap();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <li className={css.posePhoto}>
      <button type="button" className={css.thumb} onClick={onOpen}>
        {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photos: never through the public image optimizer */}
        <img src={photo.url} alt="" loading="lazy" />
        <span className={styles.visuallyHidden}>See {label} big</span>
      </button>
      {first && <span className={cn(css.firstTag, "chalk-soft")}>On the shoot list</span>}
      <button
        type="button"
        className={cn(styles.linkButton, "chalk-soft")}
        disabled={busy}
        onClick={() =>
          twoTap.tap(async () => {
            setBusy(true);
            setError(null);
            try {
              await onRemove();
            } catch (err) {
              setError((err as Error).message);
              setBusy(false);
              twoTap.reset();
            }
          })
        }
      >
        {busy ? "Removing…" : twoTap.confirming ? "Tap again" : "Remove"}
        <span className={styles.visuallyHidden}> {label}</span>
      </button>
      {error && <p className={cn(styles.error, "chalk-soft")} role="alert">{error}</p>}
    </li>
  );
}
