"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { reduceFaceEvent, type FaceEvent, type FaceSnapshot, type FaceState } from "./face-machine";

const INITIAL: FaceSnapshot = { state: "IDLE", revertInMs: null, detail: null };

function reducer(current: FaceSnapshot, event: FaceEvent): FaceSnapshot {
  return reduceFaceEvent(current.state, event);
}

/**
 * Drives RobotFace from platform events. Transient states auto-revert to IDLE after
 * their timeout; explicit events always win over a pending revert.
 */
export function useRobotFace() {
  const [snapshot, dispatch] = useReducer(reducer, INITIAL);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (snapshot.revertInMs == null) return;
    timer.current = setTimeout(() => dispatch({ type: "RESET" }), snapshot.revertInMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [snapshot]);

  const emit = useCallback((event: FaceEvent) => dispatch(event), []);

  return { state: snapshot.state as FaceState, detail: snapshot.detail, emit };
}
