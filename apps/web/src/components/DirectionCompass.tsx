/**
 * DirectionCompass — Rosa dos ventos SVG interativa
 * Destaca direções com vizinhos identificados (integração Carretel)
 */
type Direction = 'norte' | 'sul' | 'leste' | 'oeste';

interface DirectionCompassProps {
    highlightedDirections?: Direction[];
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses: Record<string, string> = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
};

const directions = [
    { name: 'norte' as Direction, label: 'N', angle: 0, color: '#3b82f6' },
    { name: 'leste' as Direction, label: 'L', angle: 90, color: '#10b981' },
    { name: 'sul' as Direction, label: 'S', angle: 180, color: '#f59e0b' },
    { name: 'oeste' as Direction, label: 'O', angle: 270, color: '#6b7280' },
];

export default function DirectionCompass({
    highlightedDirections = [],
    size = 'md',
    className = '',
}: DirectionCompassProps) {
    return (
        <div className={`relative ${sizeClasses[size]} ${className}`}>
            <svg viewBox="0 0 200 200" className="w-full h-full" aria-label="Rosa dos ventos">
                <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600" />
                <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-slate-500 opacity-30" />
                <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-slate-500 opacity-20" />

                {directions.map(({ name, label, angle, color }) => {
                    const isHighlighted = highlightedDirections.includes(name);
                    const radians = ((angle - 90) * Math.PI) / 180;
                    const x = 100 + Math.cos(radians) * 80;
                    const y = 100 + Math.sin(radians) * 80;

                    return (
                        <g key={name}>
                            <line
                                x1="100"
                                y1="100"
                                x2={100 + Math.cos(radians) * 65}
                                y2={100 + Math.sin(radians) * 65}
                                stroke={isHighlighted ? color : 'currentColor'}
                                strokeWidth={isHighlighted ? 3 : 1.5}
                                className={isHighlighted ? '' : 'text-slate-500'}
                            />
                            <circle
                                cx={x}
                                cy={y}
                                r={isHighlighted ? 20 : 16}
                                fill={isHighlighted ? color : 'currentColor'}
                                className={isHighlighted ? '' : 'text-slate-400'}
                            />
                            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={isHighlighted ? 18 : 14} fill="white" fontWeight="600">
                                {label}
                            </text>
                        </g>
                    );
                })}

                <circle cx="100" cy="100" r="8" fill="currentColor" className="text-slate-700" />
            </svg>
        </div>
    );
}
