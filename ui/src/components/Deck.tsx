import { useState, useRef, MouseEvent, useEffect, PointerEvent as ReactPointerEvent } from "react";
import Icon from "./Icon";
import expandWindow from "../hooks/ExpandWindow";
import {
    DECK_TRACK_EVENT,
    type DeckTrackDetail,
    subscribeToDeckTrackChannel,
} from "../utils/appEvents";

type DeckProps = {
    id: string | number;
    disableExpand?: boolean;
};

type DeckState = {
    id: number;
    volume: number;
    isPlaying: boolean;
    loadedTrack?: string | null;
};

function Deck({ id, disableExpand = false }: DeckProps) {
    const deckElement = useRef<HTMLElement>(null);
    const [deckData, setDeckData] = useState<DeckState | null>(null);
    const [pitch, setPitch] = useState<number>(0);
    const [trackTitle, setTrackTitle] = useState<string>("No Track");
    const [trackArtist, setTrackArtist] = useState<string | null>(null);
    const [trackBpm, setTrackBpm] = useState<number | null>(null);
    const [trackDuration, setTrackDuration] = useState<number | null>(null);
    const faderTrackRef = useRef<HTMLDivElement>(null);
    const normalizedArtist = trackArtist?.trim();
    const showArtist = Boolean(normalizedArtist && normalizedArtist.toLowerCase() !== "desconocido");
    const deckId = Number(id);

    const requestDeckState = async () => {
        try {
            const data = await (window as any).nevealdj?.getDeck?.(deckId);
            return data ?? null;
        } catch (error) {
            console.error("failed to retrieve deck info", error);
            return null;
        }
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            const data = await requestDeckState();
            if (isMounted) {
                setDeckData(data);
            }
        };
        load();

        let unsubscribe: (() => void) | undefined;
        if ((window as any).nevealdj?.subscribeToEngineState) {
            unsubscribe = (window as any).nevealdj.subscribeToEngineState((state: any) => {
                const updated = state?.decks?.find?.((deck: DeckState) => deck.id === Number(deckId));
                if (updated) {
                    setDeckData(updated);
                }
            });
        }

        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [deckId]);

    const applyMetadata = (metadata: DeckTrackDetail | null | undefined) => {
        if (!metadata) {
            return;
        }
        if (metadata.title) {
            setTrackTitle(metadata.title);
        }
        if (typeof metadata.artist !== "undefined") {
            setTrackArtist(metadata.artist);
        }
        if (typeof metadata.bpm !== "undefined") {
            setTrackBpm(
                typeof metadata.bpm === "number" && Number.isFinite(metadata.bpm)
                    ? metadata.bpm
                    : null,
            );
        }
        if (typeof metadata.durationSeconds !== "undefined") {
            setTrackDuration(
                typeof metadata.durationSeconds === "number" &&
                    Number.isFinite(metadata.durationSeconds)
                    ? metadata.durationSeconds
                    : null,
            );
        }
    };

    useEffect(() => {
        const api = (window as any).nevealdj;
        if (deckData?.loadedTrack) {
            setTrackTitle("");
            setTrackArtist(null);
            setTrackBpm(null);
            setTrackDuration(null);
            if (api?.getDeckTrackMetadata) {
                api
                    .getDeckTrackMetadata(deckId)
                    .then((metadata: DeckTrackDetail | null) => {
                        applyMetadata(metadata);
                    })
                    .catch((error: Error) => {
                        console.warn("deck: failed to refresh metadata", error);
                    });
            }
        } else {
            setTrackTitle("No Track");
            setTrackArtist(null);
            setTrackBpm(null);
            setTrackDuration(null);
        }
    }, [deckData?.loadedTrack, deckId]);

    useEffect(() => {
        const handleTrackMetadata = (event: Event) => {
            const detail = (event as CustomEvent<DeckTrackDetail>).detail;
            if (!detail || detail.deckId !== deckId) {
                return;
            }
            applyMetadata(detail);
        };

        const unsubscribeBroadcast = subscribeToDeckTrackChannel((detail) => {
            if (detail.deckId === deckId) {
                applyMetadata(detail);
            }
        });

        if (typeof window !== "undefined") {
            window.addEventListener(DECK_TRACK_EVENT, handleTrackMetadata as EventListener);
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener(DECK_TRACK_EVENT, handleTrackMetadata as EventListener);
            }
            unsubscribeBroadcast();
        };
    }, [deckId]);

    useEffect(() => {
        const api = (window as any).nevealdj;
        if (!api?.getDeckTrackMetadata) {
            return;
        }
        let isMounted = true;
        api
            .getDeckTrackMetadata(deckId)
            .then((metadata: DeckTrackDetail | null) => {
                if (!isMounted || !metadata) {
                    return;
                }
                if (metadata.title) {
                    setTrackTitle(metadata.title);
                }
                if (typeof metadata.artist !== "undefined") {
                    setTrackArtist(metadata.artist);
                }
                if (typeof metadata.bpm !== "undefined") {
                    setTrackBpm(
                        typeof metadata.bpm === "number" && Number.isFinite(metadata.bpm)
                            ? metadata.bpm
                            : null,
                    );
                }
                if (typeof metadata.durationSeconds !== "undefined") {
                    setTrackDuration(
                        typeof metadata.durationSeconds === "number" &&
                            Number.isFinite(metadata.durationSeconds)
                            ? metadata.durationSeconds
                            : null,
                    );
                }
            })
            .catch((error: Error) => {
                console.warn("deck: failed to load metadata", error);
            });
        return () => {
            isMounted = false;
        };
    }, [deckId]);

    const clampValue = (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value));

    const handleExpand = (event: MouseEvent<HTMLButtonElement>) => {
        if (disableExpand) {
            return;
        }

        expandWindow(deckElement.current, id, {
            x: event.nativeEvent.screenX,
            y: event.nativeEvent.screenY,
        });
    };

    const handlePlaybackToggle = async () => {
        try {
            const updated = await (window as any).nevealdj?.toggleDeckPlayback?.(deckId);
            if (updated) {
                setDeckData(updated);
            }
        } catch (error) {
            console.error("failed to toggle playback", error);
        }
    };

    const handleClearDeck = async () => {
        try {
            const updated = await (window as any).nevealdj?.clearDeck?.(deckId);
            if (updated) {
                setDeckData(updated);
                setTrackTitle("Sin pista");
                setTrackArtist(null);
                setTrackBpm(null);
                setTrackDuration(null);
            }
        } catch (error) {
            console.error("failed to clear deck", error);
        }
    };

    const updatePitchFromPointer = (clientY: number) => {
        const track = faderTrackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const relativeY = clampValue(clientY - rect.top, 0, rect.height);
        const percent = 1 - relativeY / rect.height;
        const newPitch = Math.round(percent * 100 - 50);
        setPitch(newPitch);
    };

    const handlePitchPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        updatePitchFromPointer(event.clientY);

        const handleMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            updatePitchFromPointer(moveEvent.clientY);
        };

        const handleUp = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    };

    const faderPositionPercent = ((50 - pitch) / 100) * 100;

    const formatDuration = (seconds?: number | null) => {
        if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) {
            return "--:--";
        }
        const totalSeconds = Math.floor(seconds);
        const mins = Math.floor(totalSeconds / 60)
            .toString()
            .padStart(2, "0");
        const secs = (totalSeconds % 60).toString().padStart(2, "0");
        return `${mins}:${secs}`;
    };

    const formatBpm = (value?: number | null) => {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
            return "--";
        }
        const fixed = value.toFixed(2);
        return fixed.endsWith(".00") ? value.toFixed(0) : fixed;
    };

    const durationLabel = formatDuration(trackDuration);
    const bpmLabel = formatBpm(trackBpm);

    return (
        <main className="w-full" ref={deckElement}>
            <main className="flex-row">
                <div className={`module-1 size-12 min-w-12 p-1 ${disableExpand ? '' : 'group'}`}>
                    <button
                        className={`flex flex-col items-center justify-center module-1 w-full h-full font-sans p-1 ${disableExpand ? 'border-2' : 'cursor-pointer'}`}
                        onClick={handleExpand}
                    >
                        <span className={`text-[8px] font-bold ${disableExpand ? '' : 'group-hover:hidden'}`}>
                            DECK
                        </span>
                        <div className={`text-[1.4em] leading-[.9] ${disableExpand ? '' : 'group-hover:hidden'}`}>
                            {id}
                        </div>
                        {!disableExpand && (
                            <Icon name="open_in_full" className="w-4 h-4 hidden group-hover:block" aria-hidden />
                        )}
                    </button>
                </div>
                <div className="module-1 w-full h-12 py-1 px-2 flex items-center justify-between gap-2">
                    <div>
                        <div className="overflow-x-hidden">
                            <h1 className="font-600 text-[.8em] me-0 truncate">
                                {trackTitle || "No Track"}
                                {showArtist && (
                                    <span className="text-[.85em] text-gray-400 font-normal">
                                        {" "}
                                        - <span className="text-gray-300">{normalizedArtist}</span>
                                    </span>
                                )}
                            </h1>
                        </div>
                        <p className="text-[.9em] font-boblackld text-orange-200">
                            {durationLabel} {bpmLabel}
                            <span className="text-[.8em]"> BPM</span>
                        </p>
                    </div>
                </div>
                {deckData?.loadedTrack ? (
                    <button
                        className="border-0 module size-12 min-w-12 cursor-pointer active:bg-[#020409]"
                        onClick={handleClearDeck}
                    >
                        <Icon name="eject_solid" className="size-6 text-gray-500" aria-hidden />
                    </button>
                ) : (
                    <></>
                )}
            </main>
            <main className="flex-row">
                {["A", "B", "C", "D", "E", "F", "G", "H"].map((hotCue) => (
                    <div key={hotCue} className="module-1 flex-1 cursor-pointer px-2 pt-2 active:bg-[#0e1116]">
                        <div className="h-px w-full bg-white"></div>
                        <div className="py-1 text-[.8em]">{hotCue}</div>
                    </div>
                ))}
            </main>
            <main className={(parseInt(id.toString())) % 2 == 1 ? 'flex-row-reverse' : 'flex-row'}>
                <div className="module flex flex-col items-center py-2 px-4 w-24 select-none">
                    <div
                        ref={faderTrackRef}
                        className="relative flex-1 w-6 my-2 cursor-grab active:cursor-grabbing"
                        onPointerDown={handlePitchPointerDown}
                    >
                        <div className="absolute inset-x-1/2 -translate-x-1/2 h-full w-[2px] bg-gray-700" />
                        <div className="absolute inset-0 flex flex-col items-center justify-between pointer-events-none">
                            {[...Array(11)].map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-[1px] ${idx === 5 ? "w-4 bg-white" : "w-2 bg-gray-500"}`}
                                />
                            ))}
                        </div>
                        <div
                            className="absolute left-1/2 w-6 h-2 bg-white rounded-xs shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                            style={{ top: `${faderPositionPercent}%` }}
                        />
                    </div>
                    <b className="text-[.6em] text-gray-500">TEMPO</b>
                </div>
                <div className="module flex p-2">
                    <div className="flex flex-col justify-end relative z-10 gap-1">
                        <button className="rounded-full border bg-transparent size-5 flex items-center justify-center cursor-pointer">
                            <b className="text-[.5em]">CUE</b>
                        </button>
                        <button className="rounded-full border bg-transparent size-5 flex items-center justify-center cursor-pointer" onClick={handlePlaybackToggle}>
                            <Icon name={deckData?.isPlaying ? "stop_solid" : "play_solid"} className="size-4 text-white" />
                        </button>
                    </div>
                    <div className="pt-6 pb-6 px-4">
                        <div className="absolute size-[150px]">
                            <svg className="relative -left-6.25 -top-6.25"
                                viewBox="0 0 100 100"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path fill="transparent"
                                    id="circlePath"
                                    d="M 10, 50 a 40,40 0 1,1 80,0 40,40 0 1,1 -80,0"
                                />
                                <path fill="transparent"
                                    id="circlePathReverse"
                                    d="M 10, 50 a 40,40 0 1,0 80,0 40,40 0 1,0 -80,0"
                                />
                                <text className="text-[.4em]"
                                    textAnchor="middle"
                                    dominantBaseline="middle">
                                    <textPath href="#circlePath" fill="#999" startOffset='25%'>
                                        SLIP   REV   VINYL
                                    </textPath>
                                </text>
                                <text className="text-[.4em]"
                                    textAnchor="middle"
                                    dominantBaseline="middle">
                                    <textPath href="#circlePathReverse" fill="#999" startOffset='25%'>
                                        SYNC          MASTER
                                    </textPath>
                                </text>
                            </svg>
                        </div>
                        <div className="module-1 rounded-full shadow-lg">
                            <div className="col-start-1 row-start-1 size-[100px] rounded-full border-9 border-white mask-conic-from-95% mask-conic-to-95% cursor-grab active:cursor-grabbing">

                            </div>
                        </div>
                    </div>
                </div>
                <div className="module w-full h-full">...</div>
            </main>
        </main>
    );
}

export default Deck;
