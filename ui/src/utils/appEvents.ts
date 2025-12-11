export const FILE_SELECTED_EVENT = "nevealdj:file-selected";
export const APP_ERROR_EVENT = "nevealdj:app-error";
export const DECK_TRACK_EVENT = "nevealdj:deck-track";

export type FileSelectedDetail = {
    path?: string | null;
};

export type AppErrorDetail = {
    message?: string | null;
    source?: string | null;
};

export type DeckTrackDetail = {
    deckId: number;
    title?: string | null;
    artist?: string | null;
    bpm?: number | null;
    durationSeconds?: number | null;
    path?: string | null;
};

const isBrowserEnvironment = () => typeof window !== "undefined";

export const dispatchFileSelection = (pathValue: string | null) => {
    if (!isBrowserEnvironment()) {
        return;
    }
    window.dispatchEvent(
        new CustomEvent<FileSelectedDetail>(FILE_SELECTED_EVENT, {
            detail: { path: pathValue },
        }),
    );
};

export const dispatchAppError = (message?: string | null, source?: string | null) => {
    if (!isBrowserEnvironment()) {
        return;
    }
    window.dispatchEvent(
        new CustomEvent<AppErrorDetail>(APP_ERROR_EVENT, {
            detail: { message, source },
        }),
    );
};

const CHANNEL_NAME = "nevealdj-deck-track";
let deckTrackChannel: BroadcastChannel | null = null;

const getDeckTrackChannel = () => {
    if (!isBrowserEnvironment()) {
        return null;
    }
    if ("BroadcastChannel" in window) {
        if (!deckTrackChannel) {
            deckTrackChannel = new BroadcastChannel(CHANNEL_NAME);
        }
        return deckTrackChannel;
    }
    return null;
};

export const subscribeToDeckTrackChannel = (listener: (detail: DeckTrackDetail) => void) => {
    const channel = getDeckTrackChannel();
    if (!channel) {
        return () => {};
    }
    const handler = (event: MessageEvent<DeckTrackDetail>) => {
        if (event?.data) {
            listener(event.data);
        }
    };
    channel.addEventListener("message", handler as EventListener);
    return () => {
        channel.removeEventListener("message", handler as EventListener);
    };
};

export const dispatchDeckTrackMetadata = (detail: DeckTrackDetail) => {
    if (!isBrowserEnvironment()) {
        return;
    }
    const channel = getDeckTrackChannel();
    if (channel) {
        channel.postMessage(detail);
    }
    window.dispatchEvent(
        new CustomEvent<DeckTrackDetail>(DECK_TRACK_EVENT, {
            detail,
        }),
    );
};
