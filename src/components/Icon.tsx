import type { CSSProperties } from "react";
const paths = {
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4 10 14" />
      <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
    </>
  ),
  expand: (
    <>
      <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  play: (
    <>
      <path d="m8 4 12 8-12 8Z" />
    </>
  ),
  pen: (
    <>
      <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L5 15Z" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L19 6" />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3v7m9 2h-7m-2 9v-7m-9-2h7m-4.4-6.4 5 5m6.8-5-5 5m5 6.8-5-5m-6.8 5 5-5" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 5v14a2 2 0 0 0 2 2h14V7M20 12h-5v5h5M17 14.5h.1" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3" />
    </>
  ),
  x: (
    <>
      <path d="M4 4h4l12 16h-4ZM20 4 4 20" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-11v1" />
    </>
  ),
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function Hamster({
  size = 32,
  sleeping = false,
}: {
  size?: number;
  sleeping?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path fill="#a65f32" d="M5 3h7v3h8V3h7v10h2v11h-3v4H6v-4H3V13h2Z" />
      <path fill="#f6ad57" d="M7 7h5v4h8V7h5v8h2v8h-4v3H9v-3H5v-8h2Z" />
      <path fill="#f5d1a0" d="M11 17h10v3h3v5H8v-5h3Z" />
      <path
        fill="#211b17"
        d={
          sleeping
            ? "M8 13h5v2H8Zm11 0h5v2h-5ZM14 19h4v2h-4Z"
            : "M9 12h3v4H9Zm11 0h3v4h-3ZM14 19h4v2h-4Z"
        }
      />
      <path fill="#e98d6d" d="M7 7h3v3H7Zm15 0h3v3h-3Z" />
    </svg>
  );
}
