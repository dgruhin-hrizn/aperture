import { SvgIcon, type SvgIconProps } from '@mui/material'

/** One stroke language for the dock, with a conversational mark for Encore. */
export function MobileNavIcon({
  name,
  ...props
}: SvgIconProps & { name: 'discover' | 'library' | 'encore' | 'watching' | 'you' }) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
        {name === 'discover' && (
          <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m15.7 8.3-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2Z" />
          </>
        )}
        {name === 'library' && (
          <>
            <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
            <path d="M6 7h.01M6 17h.01" />
            <rect x="11" y="4.5" width="5.5" height="15.5" rx="1.5" transform="rotate(-14 11 4.5)" />
            <path d="m13 7 1.5-.4" />
          </>
        )}
        {name === 'encore' && (
          <>
            <path d="M20.3 11.2a8.1 8.1 0 0 1-8.3 8 9 9 0 0 1-3.4-.6L3.5 20l1.3-4.7a7.6 7.6 0 0 1-1-4.1 8.2 8.2 0 0 1 16.5 0Z" />
            <path d="m12 7 .9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9L12 7Z" strokeWidth="1.35" />
          </>
        )}
        {name === 'watching' && (
          <>
            <rect x="3.5" y="7.5" width="17" height="13" rx="3" />
            <path d="M7 3.5h10M5.5 5.5h13M10 11l5 3-5 3v-6Z" />
          </>
        )}
        {name === 'you' && (
          <>
            <circle cx="12" cy="7.5" r="3.25" />
            <path d="M5 20v-1.5a7 7 0 0 1 14 0V20" />
          </>
        )}
      </g>
    </SvgIcon>
  )
}
