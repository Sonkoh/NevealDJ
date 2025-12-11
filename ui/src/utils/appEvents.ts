export const FILE_SELECTED_EVENT = "nevealdj:file-selected";
export const APP_ERROR_EVENT = "nevealdj:app-error";

export type FileSelectedDetail = {
    path?: string | null;
};

export type AppErrorDetail = {
    message?: string | null;
    source?: string | null;
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
