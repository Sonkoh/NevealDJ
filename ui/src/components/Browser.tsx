
import { useEffect, useRef, useState } from "react";
import {
    APP_ERROR_EVENT,
    type AppErrorDetail,
    dispatchAppError,
    dispatchFileSelection,
} from "../utils/appEvents";

type HotCueMetadata = {
    positionSeconds: number;
    label?: string | null;
};

type DirectoryNode = {
    name: string;
    path: string;
    isExpanded: boolean;
    isLoading: boolean;
    hasLoadedChildren: boolean;
    children?: DirectoryNode[];
};

type DirectoryListResponse = {
    path: string;
    parent: string | null;
    files?: BrowserFile[];
    directories: Array<{ name: string; path: string }>;
};

type BrowserFile = {
    name: string;
    path: string;
    title: string;
    artist?: string | null;
    bpm?: number | null;
    durationSeconds?: number | null;
    hotCues: HotCueMetadata[];
};

const formatBpm = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
        return "--";
    }
    return value.toFixed(2);
};

const formatDuration = (value?: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return "--:--";
    }
    const totalSeconds = Math.max(0, Math.floor(value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const createNode = (name: string, pathValue: string): DirectoryNode => ({
    name,
    path: pathValue,
    isExpanded: false,
    isLoading: false,
    hasLoadedChildren: false,
    children: undefined,
});

const updateNode = (
    node: DirectoryNode,
    targetPath: string,
    updater: (node: DirectoryNode) => DirectoryNode,
): DirectoryNode => {
    if (node.path === targetPath) {
        return updater(node);
    }
    if (!node.children) {
        return node;
    }
    return {
        ...node,
        children: node.children.map((child) => updateNode(child, targetPath, updater)),
    };
};

const findNode = (node: DirectoryNode | null, targetPath: string): DirectoryNode | null => {
    if (!node) return null;
    if (node.path === targetPath) {
        return node;
    }
    if (!node.children) {
        return null;
    }
    for (const child of node.children) {
        const found = findNode(child, targetPath);
        if (found) return found;
    }
    return null;
};

function Browser() {
    const [rootNode, setRootNode] = useState<DirectoryNode | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<BrowserFile[]>([]);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ message: string; source?: string | null } | null>(null);
    const statusTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const loadRoot = async () => {
            try {
                const response: DirectoryListResponse = await (window as any).nevealdj?.listDirectories?.();
                const children = response?.directories?.map((entry) => createNode(entry.name, entry.path)) ?? [];
                setRootNode({
                    name: response?.path || "/",
                    path: response?.path || "/",
                    isExpanded: true,
                    isLoading: false,
                    hasLoadedChildren: true,
                    children,
                });
                const rootPath = response?.path || "/";
                setSelectedPath(rootPath);
                setSelectedFiles(response?.files ?? []);
                setSelectedFilePath(null);
                dispatchFileSelection(null);
            } catch (err) {
                const message = (err as Error).message || "No se pudo cargar el directorio raíz";
                dispatchAppError(message, "Browser");
            }
        };

        loadRoot();
    }, []);

    useEffect(() => {
        const handleAppError = (event: Event) => {
            const detail = (event as CustomEvent<AppErrorDetail>).detail;
            if (!detail?.message) {
                setStatusMessage(null);
                if (statusTimeoutRef.current) {
                    window.clearTimeout(statusTimeoutRef.current);
                    statusTimeoutRef.current = null;
                }
                return;
            }
            setStatusMessage({
                message: detail.message,
                source: detail.source ?? null,
            });
            if (statusTimeoutRef.current) {
                window.clearTimeout(statusTimeoutRef.current);
            }
            statusTimeoutRef.current = window.setTimeout(() => {
                setStatusMessage(null);
                statusTimeoutRef.current = null;
            }, 5000);
        };

        if (typeof window !== "undefined") {
            window.addEventListener(APP_ERROR_EVENT, handleAppError as EventListener);
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener(APP_ERROR_EVENT, handleAppError as EventListener);
            }
            if (statusTimeoutRef.current) {
                window.clearTimeout(statusTimeoutRef.current);
            }
        };
    }, []);

    const handleToggleNode = async (pathValue: string) => {
        setSelectedPath(pathValue);
        const existingNode = findNode(rootNode, pathValue);
        if (!existingNode) {
            return;
        }

        const willCollapse = existingNode.isExpanded && existingNode.hasLoadedChildren;
        if (willCollapse) {
            setRootNode((prev) =>
                prev
                    ? updateNode(prev, pathValue, (node) => ({
                          ...node,
                          isExpanded: false,
                      }))
                    : prev,
            );
            return;
        }

        setRootNode((prev) =>
            prev
                ? updateNode(prev, pathValue, (node) => ({
                      ...node,
                      isExpanded: true,
                      isLoading: !node.hasLoadedChildren,
                  }))
                : prev,
        );

        try {
            const response: DirectoryListResponse = await (window as any).nevealdj?.listDirectories?.(pathValue);
            const children = response?.directories?.map((entry) => createNode(entry.name, entry.path)) ?? [];
            setRootNode((prev) =>
                prev
                    ? updateNode(prev, pathValue, (node) => ({
                          ...node,
                          isExpanded: true,
                          isLoading: false,
                          hasLoadedChildren: true,
                          children,
                      }))
                    : prev,
            );
            setSelectedFiles(response?.files ?? []);
            setSelectedFilePath(null);
            dispatchFileSelection(null);
        } catch (err) {
            setRootNode((prev) =>
                prev
                    ? updateNode(prev, pathValue, (node) => ({
                          ...node,
                          isLoading: false,
                      }))
                    : prev,
            );
            const message = (err as Error).message || "No se pudo leer la carpeta seleccionada";
            dispatchAppError(message, "Browser");
        }
    };

    const handleFileSelection = (pathValue: string) => {
        setSelectedFilePath(pathValue);
        dispatchFileSelection(pathValue);
    };

    const renderNode = (node: DirectoryNode, depth = 0) => (
        <div key={node.path} className="text-sm">
            <button
                onClick={() => handleToggleNode(node.path)}
                className={`w-full text-left flex items-center gap-2 py-1 px-2 border-0 cursor-pointer ${selectedPath === node.path ? "module text-white" : "text-gray-200 module-1 hover:bg-white/5"
                    }`}
                style={{ paddingLeft: depth * 12 + 8 }}
            >
                <span className="text-xs">{node.isExpanded ? "▾" : "▸"}</span>
                <span className="truncate">{node.name}</span>
                {node.isLoading && <span className="text-[10px] text-gray-400">...</span>}
            </button>
            {node.isExpanded && node.children?.map((child) => renderNode(child, depth + 1))}
        </div>
    );

    return (
        <>
            <div className="flex flex-1 min-h-0 gap-px overflow-hidden">
                <div className="module-1 w-[320px] h-full overflow-y-scroll">
                    {rootNode ? renderNode(rootNode) : <div className="p-3 text-sm text-gray-400">Cargando árbol...</div>}
                </div>
                <div className="module-1 flex-1 h-full text-sm overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-gray-400">
                            <tr>
                                <th className="py-1 px-3">Title</th>
                                <th className="py-1 px-3">Artist</th>
                                <th className="py-1 px-3">BPM</th>
                                <th className="py-1 px-3">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedFiles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-2 px-3 text-gray-500 text-sm">
                                        No hay archivos .mp3 o .wav en esta carpeta.
                                    </td>
                                </tr>
                            ) : (
                                selectedFiles.map((file) => (
                                    <tr
                                        key={file.path}
                                        onClick={() => handleFileSelection(file.path)}
                                        className={`border-b border-white/5 cursor-pointer ${
                                            selectedFilePath === file.path
                                                ? "bg-white/10 text-white"
                                                : "hover:bg-white/5"
                                        }`}
                                        aria-selected={selectedFilePath === file.path}
                                    >
                                        <td className="py-2 px-3">{file.title || file.name.replace(/\.[^.]+$/, "")}</td>
                                        <td className="py-2 px-3 text-gray-300">{file.artist?.trim() || "Desconocido"}</td>
                                        <td className="py-2 px-3">{formatBpm(file.bpm)}</td>
                                        <td className="py-2 px-3">{formatDuration(file.durationSeconds)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="module-1 px-2">
                {statusMessage ? (
                    <div className="text-red-400 break-all">
                        {statusMessage.source ? `[${statusMessage.source}] ` : ""}
                        {statusMessage.message}
                    </div>
                ) : selectedPath ? (
                    <div>
                        <p className="text-gray-300 break-all">Browser: {selectedPath}</p>
                    </div>
                ) : (
                    <p className="text-gray-400">Selecciona una carpeta del árbol.</p>
                )}
            </div>
        </>
    );
}

export default Browser;
