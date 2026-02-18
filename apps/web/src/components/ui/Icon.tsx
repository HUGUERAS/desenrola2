/**
 * Icon — Thin wrapper around lucide-react icons
 * Maps semantic names to lucide components for consistency
 */
import React from 'react';
import {
    Loader2, Info, Check, AlertTriangle, X,
    Sparkles, ChevronDown, ChevronRight, ChevronUp,
    Plus, Minus, Edit, Trash2, Search, Eye, EyeOff,
    Download, Upload, Settings, Menu, Home, User, MapPin,
    FileText, Save, RefreshCw, Copy, ExternalLink,
    type LucideProps
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
    spark: Sparkles,
    loader: Loader2,
    info: Info,
    check: Check,
    alert: AlertTriangle,
    close: X,
    'chevron-down': ChevronDown,
    'chevron-right': ChevronRight,
    'chevron-up': ChevronUp,
    plus: Plus,
    minus: Minus,
    edit: Edit,
    trash: Trash2,
    search: Search,
    eye: Eye,
    'eye-off': EyeOff,
    download: Download,
    upload: Upload,
    settings: Settings,
    menu: Menu,
    home: Home,
    user: User,
    'map-pin': MapPin,
    'file-text': FileText,
    save: Save,
    refresh: RefreshCw,
    copy: Copy,
    'external-link': ExternalLink,
};

const SIZES = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
};

interface IconProps {
    name: keyof typeof ICON_MAP | string;
    size?: keyof typeof SIZES;
    className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 'md', className }) => {
    const Component = ICON_MAP[name];
    if (!Component) {
        console.warn(`Icon "${name}" not found in ICON_MAP`);
        return null;
    }
    return <Component size={SIZES[size]} className={className} />;
};

export default Icon;
