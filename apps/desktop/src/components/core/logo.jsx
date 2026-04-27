import React from 'react'

function PayloadX({ className = "w-8 h-8", fontSize = "12px", ...props }) {
    return (
        <div className={`relative group ${className}`} {...props}>
            <div className="w-full h-full rounded-2xl flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--grad-logo)' }}>
                <span style={{ fontFamily: 'Syne', fontWeight: 900, fontSize: fontSize, color: '#0D1017', letterSpacing: '-1.5px' }}>PX</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.1] to-transparent -skew-x-12 animate-shimmer" />
            </div>
        </div>
    )
}

export default PayloadX