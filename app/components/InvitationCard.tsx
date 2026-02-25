type InvitationCardProps = {
  eventTitle: string;
  hostName: string;
  dateTime: string;
  backgroundImage?: string;
  overlayOpacity?: number;
  glowIntensity?: number;
  vignetteIntensity?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  titleSize?: number;
  nameSize?: number;
  dateSize?: number;
  titleX?: number;
  titleY?: number;
  nameX?: number;
  nameY?: number;
  dateX?: number;
  dateY?: number;
  titleColor?: string;
  nameColor?: string;
  dateColor?: string;
  titleFont?: string;
  nameFont?: string;
  dateFont?: string;
  onImageLoad?: () => void;
  onImageError?: () => void;
};

export default function InvitationCard({
  eventTitle,
  hostName,
  dateTime,
  backgroundImage,
  overlayOpacity = 0.3,
  glowIntensity = 7,
  vignetteIntensity = 0,
  canvasWidth = 450,
  canvasHeight = 800,
  titleSize = 72,
  nameSize = 39,
  dateSize = 56,
  titleX = 298,
  titleY = 226,
  nameX = 298,
  nameY = 319,
  dateX = 298,
  dateY = 438,
  titleColor = '#ffffff',
  nameColor = '#ffffff',
  dateColor = '#ffffff',
  titleFont = '"Playfair Display", serif',
  nameFont = 'Inter, sans-serif',
  dateFont = 'Inter, sans-serif',
  onImageLoad,
  onImageError,
}: InvitationCardProps) {
  return (
    <div style={{ width: canvasWidth, height: canvasHeight, overflow: 'hidden', position: 'relative', borderRadius: '16px', backgroundColor: '#1a1a1a' }}>

      {/* 1. AI BACKGROUND LAYER */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {backgroundImage ? (
          <>
            {/* CSS background-image preserves cover cropping in html2canvas; img tag is hidden just for load/error callbacks */}
            <div style={{ width: '100%', height: '100%', backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <img src={backgroundImage} style={{ display: 'none' }} alt="" onLoad={onImageLoad} onError={onImageError ?? onImageLoad} crossOrigin="anonymous" />
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#bf4f9d' }} />
        )}
      </div>

      {/* 2. DARKNESS OVERLAY */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, backgroundColor: `rgba(0,0,0,${overlayOpacity})` }} />

      {/* 2b. VIGNETTE */}
      {vignetteIntensity > 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${vignetteIntensity}) 100%)`,
          pointerEvents: 'none',
        }} />
      )}

      {/* 3. SVG TEXT + GLOW */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'relative', zIndex: 3, width: '100%', height: '100%' }}
      >
        <defs>
          <filter id="glow-title" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation={glowIntensity} result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glow-name" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation={glowIntensity} result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glow-date" x="-30%" y="-60%" width="160%" height="220%">
            <feGaussianBlur stdDeviation={glowIntensity} result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <text x={titleX} y={titleY} textAnchor="middle" fill={titleColor} fontSize={titleSize} fontWeight="bold" style={{ fontFamily: titleFont }} filter="url(#glow-title)">
          {eventTitle || 'Event Title'}
        </text>

        <text x={nameX} y={nameY} textAnchor="middle" fill={nameColor} fontSize={nameSize} style={{ fontFamily: nameFont }} filter="url(#glow-name)">
          {hostName || 'Host Name'}
        </text>

        <text x={dateX} y={dateY} textAnchor="middle" fill={dateColor} fontSize={dateSize} style={{ fontFamily: dateFont }} filter="url(#glow-date)">
          {dateTime || 'Date & Time'}
        </text>
      </svg>
    </div>
  );
}
