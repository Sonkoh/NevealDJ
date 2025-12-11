type RectPayload = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CursorPosition = {
  x: number;
  y: number;
};

type ExpandWindowPayload = {
  id?: string | number;
  rect: RectPayload;
  cursor?: CursorPosition;
};

type WindowApi = {
  expandWindow?: (payload: ExpandWindowPayload) => void;
};

const expandWindow = (
  element: HTMLElement | null,
  id?: string | number,
  cursor?: CursorPosition,
) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!element) {
    console.warn("expandWindow: element not available");
    return;
  }

  const rect = element.getBoundingClientRect();
  const payload: ExpandWindowPayload = {
    id,
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    cursor,
  };

  const api = (window as Window & { nevealdj?: WindowApi }).nevealdj;

  if (api?.expandWindow) {
    api.expandWindow(payload);
    return;
  }

  console.log("expandWindow payload", payload);
};

export type { ExpandWindowPayload };
export default expandWindow;
