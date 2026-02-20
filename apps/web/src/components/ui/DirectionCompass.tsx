/**
 * DirectionCompass — Rosa dos ventos SVG interativa
 * Destaca direções cardeais (N/S/L/O) com vizinhos identificados
 */
type CardinalDirection = 'norte' | 'sul' | 'leste' | 'oeste';

interface DirectionCompassProps {
    highlightedDirections?: CardinalDirection[];
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: { width: 128, height: 128 },
    md: { width: 192, height: 192 },
    lg: { width: 256, height: 256 },
};

const directions = [
    { name: 'norte' as const, label: 'N', angle: 0, color: '#3b82f6' },
    { name: 'leste' as const, label: 'L', angle: 90, color: '#22c55e' },
    { name: 'sul' as const, label: 'S', angle: 180, color: '#e67e22' },
    { name: 'oeste' as const, label: 'O', angle: 270, color: '#64748b' },
];

export default function DirectionCompass({
    highlightedDirections = [],
    size = 'md',
    className = '',
}: DirectionCompassProps) {
    const dim = sizeClasses[size];

    return (
        <div
            className={className}
            style={{ width: dim.width, height: dim.height, position: 'relative' }}
        >
            <svg
                viewBox="0 0 200 200"
                className="w-full h-full"
                aria-label="Rosa dos ventos"
            >
                <circle
                    cx="100"
                    cy="100"
                    r="90"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ opacity: 0.3 }}
                />
                <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    style={{ opacity: 0.2 }}
                />
                <circle
                    cx="100"
                    cy="100"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    style={{ opacity: 0.15 }}
                />

                {directions.map(({ name, label, angle, color }) => {
                    const isHighlighted = highlightedDirections.includes(name);
                    const radians = ((angle - 90) * Math.PI) / 180;
                    const x = 100 + Math.cos(radians) * 80;
                    const y = 100 + Math.sin(radians) * 80;
                    const strokeColor = isHighlighted ? color : 'currentColor';

                    return (
                        <g key={name}>
                            <line
                                x1="100"
                                y1="100"
                                x2={100 + Math.cos(radians) * 65}
                                y2={100 + Math.sin(radians) * 65}
                                stroke={strokeColor}
                                strokeWidth={isHighlighted ? 3 : 1.5}
                                opacity={isHighlighted ? 1 : 0.5}
                            />
                            <circle
                                cx={x}
                                cy={y}
                                r={isHighlighted ? 20 : 16}
                                fill={isHighlighted ? color : 'currentColor'}
                                opacity={isHighlighted ? 1 : 0.4}
                            />
                            <text
                                x={x}
                                y={y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={isHighlighted ? 18 : 14}
                                fontWeight="600"
                                fill="white"
                            >
                                {label}
                            </text>
                        </g>
                    );
                })}

                <circle cx="100" cy="100" r="8" fill="currentColor" opacity={0.6} />
            </svg>
        </div>
    );
}
