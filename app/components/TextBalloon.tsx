import React from 'react'

interface TextBalloonProps {
  message: string
  x: number
  y: number
  tokenWidth: number
  tokenHeight: number
  onClose: () => void
}

export default function TextBalloon({ message, x, y, tokenWidth, tokenHeight, onClose }: TextBalloonProps) {
  // Position the balloon above the token
  const balloonX = x + tokenWidth / 2
  const balloonY = y - 60 // 60px above the token

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: balloonX,
        top: balloonY,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Balloon background */}
      <div className="bg-yellow-50 rounded-xl px-4 py-3 shadow-lg min-w-[100px] max-w-xs">
        <div className="text-sm text-gray-800 break-words">
          {message}
        </div>
        
        {/* Balloon tail pointing down to the token */}
        <div 
          className="absolute top-full left-1/2 transform -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #fefce8',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
          }}
        />
      </div>
    </div>
  )
} 