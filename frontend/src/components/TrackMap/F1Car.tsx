/** Both car symbols share the viewBox "-22 -12 44 24". */
export const CAR_LENGTH = 44;
export const CAR_HEIGHT = 24;

export function CarSymbols() {
  return (
    <defs>
      <symbol id="f1-car" viewBox="-22 -12 44 24" overflow="visible">
        <ellipse cx="-1" cy="0" rx="17" ry="7.5" fill="#000" opacity="0.38" />

        <rect x="-21" y="-9.4" width="4.2" height="18.8" rx="1" fill="var(--accent)" />
        <rect x="-21" y="-9.4" width="4.2" height="18.8" rx="1" fill="#000" opacity="0.18" />
        <rect x="-21.6" y="-9.8" width="1.6" height="4" rx="0.5" fill="var(--shadow)" />
        <rect x="-21.6" y="5.8" width="1.6" height="4" rx="0.5" fill="var(--shadow)" />

        <g fill="#111117">
          <rect x="-15.5" y="-12.2" width="7.4" height="4.6" rx="1.6" />
          <rect x="-15.5" y="7.6" width="7.4" height="4.6" rx="1.6" />
          <rect x="6.6" y="-11.4" width="6.6" height="4.1" rx="1.4" />
          <rect x="6.6" y="7.3" width="6.6" height="4.1" rx="1.4" />
        </g>
        <g fill="#2C2C36">
          <rect x="-14.6" y="-11.4" width="5.6" height="0.9" rx="0.45" />
          <rect x="-14.6" y="10.5" width="5.6" height="0.9" rx="0.45" />
          <rect x="7.4" y="-10.7" width="5" height="0.8" rx="0.4" />
          <rect x="7.4" y="9.9" width="5" height="0.8" rx="0.4" />
        </g>

        <g stroke="var(--shadow)" strokeWidth="1.1" strokeLinecap="round">
          <path d="M-9.5 -4.4 L-12 -8.6 M-9.5 4.4 L-12 8.6" />
          <path d="M9 -3.6 L9.8 -8 M9 3.6 L9.8 8" />
        </g>

        <path
          d="M17 -2.4 L17 2.4 L8 4.9 L2 6.4 L-5 7.6 L-12 6.3 L-16.4 4.5 L-16.4 -4.5 L-12 -6.3 L-5 -7.6 L2 -6.4 L8 -4.9 Z"
          fill="var(--primary)"
        />
        <path
          d="M15 -1.5 L15 1.5 L7 3.3 L1 4.4 L-5 5.2 L-11 4.2 L-14.6 2.9 L-14.6 -2.9 L-11 -4.2 L-5 -5.2 L1 -4.4 L7 -3.3 Z"
          fill="var(--highlight)"
          opacity="0.5"
        />
        <path d="M1 -6.2 L-4 -7.4 L-4 -4.6 L1 -3.8 Z" fill="var(--shadow)" />
        <path d="M1 6.2 L-4 7.4 L-4 4.6 L1 3.8 Z" fill="var(--shadow)" />
        <path d="M14 -0.9 L-15 -1.5 L-15 1.5 L14 0.9 Z" fill="var(--accent)" opacity="0.9" />
        <path d="M20.4 -1.9 L20.4 1.9 L17 2.6 L17 -2.6 Z" fill="var(--highlight)" />
        <rect x="19.4" y="-10.6" width="3.4" height="21.2" rx="0.9" fill="var(--accent)" />
        <rect x="19.4" y="-10.6" width="3.4" height="21.2" rx="0.9" fill="#000" opacity="0.14" />
        <rect x="22.2" y="-11" width="1.4" height="3.6" rx="0.5" fill="var(--shadow)" />
        <rect x="22.2" y="7.4" width="1.4" height="3.6" rx="0.5" fill="var(--shadow)" />
        <ellipse cx="2.6" cy="0" rx="3.6" ry="2.5" fill="#07070C" />
        <path
          d="M-0.6 -3 Q6.4 -3.4 7.4 0 Q6.4 3.4 -0.6 3"
          fill="none"
          stroke="#1A1A22"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M6.6 0 L7.6 0" stroke="#1A1A22" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M-1.4 -2.3 L-6.4 -3 L-6.4 3 L-1.4 2.3 Z" fill="var(--shadow)" />
      </symbol>

      <symbol id="f1-car-lod" viewBox="-22 -12 44 24" overflow="visible">
        <rect x="-20" y="-7" width="40" height="14" rx="6" fill="var(--primary)" />
        <rect x="-20" y="-7" width="14" height="14" rx="6" fill="var(--shadow)" opacity="0.55" />
        <circle cx="12" cy="0" r="3.2" fill="var(--highlight)" />
      </symbol>
    </defs>
  );
}
