import type { SVGProps } from "react";

type IconName = "open_in_full";

const ICON_PATHS: Record<IconName, string> = {
  open_in_full: "M120-120v-320h80v184l504-504H520v-80h320v320h-80v-184L256-200h184v80H120Z",
};

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
  title?: string;
};

function Icon({ name, title, ...svgProps }: IconProps) {
  const path = ICON_PATHS[name];

  if (!path) {
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={24}
      width={24}
      viewBox="0 -960 960 960"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      {...svgProps}
    >
      {title ? <title>{title}</title> : null}
      <path d={path} fill="currentColor" />
    </svg>
  );
}

export default Icon;
