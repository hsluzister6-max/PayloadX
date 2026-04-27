import React from 'react'

function PayloadX({ className = "", fontSize = "16px", size = "44px", ...props }) {
    const containerStyle = {
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const logoInnerStyle = {
        width: '100%',
        height: '100%',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--grad-logo)',
    };

    const textStyle = {
        fontFamily: 'Syne, sans-serif',
        fontWeight: 900,
        fontSize: fontSize,
        color: '#0D1017',
        letterSpacing: '-1.5px',
        zIndex: 1,
    };

    const shimmerStyle = {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent)',
    };

    const glowStyle = {
        position: 'absolute',
        inset: '-16px',
        borderRadius: '24px',
        background: 'rgba(255, 255, 255, 0.02)',
        zIndex: -1,
    };

    return (
        <div style={containerStyle} className={className} {...props}>
            <div style={logoInnerStyle}>
                <span style={textStyle}>PX</span>
                <div style={shimmerStyle} className="animate-shimmer" />
            </div>
            {/* Logo Glow */}
            <div style={glowStyle} className="animate-pulse" />
        </div>
    )
}

export default PayloadX
