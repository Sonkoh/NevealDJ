
import { useEffect, useState } from "react";

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
    directories: Array<{ name: string; path: string }>;
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

function Explorer() {
    const [rootNode, setRootNode] = useState<DirectoryNode | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<Array<{ name: string; path: string }>>([]);
    const [error, setError] = useState<string | null>(null);

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
                setSelectedPath(response?.path || "/");
                setSelectedFiles(response?.files ?? []);
                setError(null);
            } catch (err) {
                setError((err as Error).message);
            }
        };

        loadRoot();
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
            setError(null);
        } catch (err) {
            setRootNode((prev) =>
                prev
                    ? updateNode(prev, pathValue, (node) => ({
                          ...node,
                          isLoading: false,
                      }))
                    : prev,
            );
            setError((err as Error).message);
            setTimeout(() => {
                setError(null);
            }, 5000);
        }
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
                                <th className="py-1 px-3">Título</th>
                                <th className="py-1 px-3">Artista</th>
                                <th className="py-1 px-3">BPM</th>
                                <th className="py-1 px-3">Tiempo</th>
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
                                    <tr key={file.path} className="border-b border-white/5 hover:bg-white/5 cursor-pointer">
                                        <td className="py-2 px-3">{file.name.replace(/\.[^.]+$/, '')}</td>
                                        <td className="py-2 px-3 text-gray-400">Desconocido</td>
                                        <td className="py-2 px-3">--</td>
                                        <td className="py-2 px-3">--:--</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="module-1">
                {error ? (
                    <div className="text-red-400 break-all">Browser: {error}</div>
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

export default Explorer;
